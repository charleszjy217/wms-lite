import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { RecordCountDto } from './dto/record-count.dto';
import { QueryStocktakeDto } from './dto/query-stocktake.dto';

@Injectable()
export class StocktakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateStocktakeDto, operator: string) {
    // Validate warehouse & location
    const [warehouse, location] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
      this.prisma.location.findUnique({ where: { id: dto.locationId } }),
    ]);

    if (!warehouse) throw new NotFoundException('仓库不存在');
    if (!location) throw new NotFoundException('库位不存在');

    // Validate items and look up current inventory balance as expected quantity
    const itemData: Array<{
      productId: string;
      batchId: string;
      expectedQuantity: number;
    }> = [];

    for (const item of dto.items) {
      const [product, batch] = await Promise.all([
        this.prisma.product.findUnique({ where: { id: item.productId } }),
        this.prisma.batch.findUnique({ where: { id: item.batchId } }),
      ]);
      if (!product) throw new NotFoundException(`商品 ${item.productId} 不存在`);
      if (!batch) throw new NotFoundException(`批次 ${item.batchId} 不存在`);

      // Get current inventory balance
      const balance = await this.prisma.inventoryBalance.findUnique({
        where: {
          productId_locationId_batchId: {
            productId: item.productId,
            locationId: dto.locationId,
            batchId: item.batchId,
          },
        },
      });

      const expectedQuantity = balance?.quantity ?? 0;
      itemData.push({
        productId: item.productId,
        batchId: item.batchId,
        expectedQuantity,
      });
    }

    // Create stocktake order in DRAFT
    const stocktake = await this.prisma.stocktakeOrder.create({
      data: {
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        referenceNo: dto.referenceNo ?? this.generateReferenceNo(),
        status: 'DRAFT',
        operator,
        items: {
          create: itemData.map((item) => ({
            productId: item.productId,
            batchId: item.batchId,
            expectedQuantity: item.expectedQuantity,
            actualQuantity: 0,
            difference: 0,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    await this.auditService.log({
      entityType: 'StocktakeOrder',
      entityId: stocktake.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(stocktake),
      operator,
      reason: null,
    });

    return stocktake;
  }

  async recordCount(id: string, dto: RecordCountDto, operator: string) {
    const stocktake = await this.prisma.stocktakeOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!stocktake) throw new NotFoundException('盘点单不存在');
    if (stocktake.status !== 'DRAFT') {
      throw new BadRequestException('仅 DRAFT 状态盘点单可录入实盘数量');
    }

    // Build a lookup of item id -> actual quantity
    const countMap = new Map(dto.items.map((i) => [i.id, i.actualQuantity]));

    // Validate all items exist in the stocktake
    for (const item of dto.items) {
      const exists = stocktake.items.find((si) => si.id === item.id);
      if (!exists) {
        throw new NotFoundException(`盘点项 ${item.id} 不存在于当前盘点单`);
      }
    }

    // Update each item
    await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const si of stocktake.items) {
        const actual = countMap.get(si.id) ?? si.actualQuantity ?? 0;
        const difference = actual - si.expectedQuantity;
        const itemStatus = Math.abs(difference) < 0.001 ? 'MATCH' : 'MISMATCH';

        const updated = await tx.stocktakeItem.update({
          where: { id: si.id },
          data: {
            actualQuantity: actual,
            difference,
            status: itemStatus,
          },
        });
        results.push(updated);
      }
      return results;
    });

    // Update stocktake status
    const updated = await this.prisma.stocktakeOrder.update({
      where: { id },
      data: { status: 'COUNTED' },
      include: { items: true },
    });

    await this.auditService.log({
      entityType: 'StocktakeOrder',
      entityId: id,
      action: 'RECORD_COUNT',
      before: JSON.stringify({ status: 'DRAFT', items: stocktake.items }),
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  async confirm(id: string, operator: string) {
    const stocktake = await this.prisma.stocktakeOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!stocktake) throw new NotFoundException('盘点单不存在');
    if (stocktake.status !== 'COUNTED') {
      throw new BadRequestException('仅 COUNTED 状态盘点单可确认差异');
    }

    // Transaction: adjust balances + create stock movements
    await this.prisma.$transaction(async (tx) => {
      for (const item of stocktake.items) {
        const diff = item.difference ?? 0;
        if (Math.abs(diff) < 0.001) continue;

        // Lock the balance row (if exists)
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; quantity: number }>>(
          `SELECT id, quantity FROM inventory_balance
           WHERE product_id = $1 AND location_id = $2 AND batch_id = $3
           FOR UPDATE`,
          item.productId,
          stocktake.locationId,
          item.batchId,
        );

        if (diff > 0) {
          // Stock increase — upsert
          await tx.$executeRawUnsafe(
            `INSERT INTO inventory_balance (id, product_id, location_id, batch_id, quantity, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (product_id, location_id, batch_id)
             DO UPDATE SET quantity = inventory_balance.quantity + $4, updated_at = NOW()`,
            item.productId,
            stocktake.locationId,
            item.batchId,
            diff,
          );
        } else {
          // Stock decrease
          const balance = rows[0];
          const currentQty = balance ? Number(balance.quantity) : 0;
          const absDiff = Math.abs(diff);
          const newQty = Math.max(0, currentQty - absDiff);

          if (balance) {
            await tx.$executeRawUnsafe(
              `UPDATE inventory_balance
               SET quantity = $1, updated_at = NOW()
               WHERE id = $2`,
              newQty,
              balance.id,
            );
          }
        }

        // Create ADJUSTMENT stock movement
        // Positive difference = stock increase (toLocation), negative = decrease (fromLocation)
        await tx.stockMovement.create({
          data: {
            type: 'ADJUSTMENT',
            productId: item.productId,
            batchId: item.batchId,
            fromLocationId: diff < 0 ? stocktake.locationId : null,
            toLocationId: diff > 0 ? stocktake.locationId : null,
            quantity: diff,
            referenceNo: stocktake.referenceNo ?? stocktake.id,
            operator,
            reason: `盘点调整: 预期=${item.expectedQuantity}, 实盘=${item.actualQuantity}, 差异=${diff}`,
          },
        });

        // Mark item as ADJUSTED
        await tx.stocktakeItem.update({
          where: { id: item.id },
          data: { status: 'ADJUSTED' },
        });
      }

      // Update stocktake status
      await tx.stocktakeOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      });
    });

    const updated = await this.findOne(id);

    await this.auditService.log({
      entityType: 'StocktakeOrder',
      entityId: id,
      action: 'CONFIRM',
      before: JSON.stringify({ status: 'COUNTED' }),
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  async cancel(id: string, operator: string) {
    const stocktake = await this.prisma.stocktakeOrder.findUnique({
      where: { id },
    });

    if (!stocktake) throw new NotFoundException('盘点单不存在');
    if (stocktake.status === 'CONFIRMED' || stocktake.status === 'CANCELLED') {
      throw new BadRequestException('已完成或已取消的盘点单不可取消');
    }

    const updated = await this.prisma.stocktakeOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });

    await this.auditService.log({
      entityType: 'StocktakeOrder',
      entityId: id,
      action: 'CANCEL',
      before: JSON.stringify({ status: stocktake.status }),
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  async findAll(query: QueryStocktakeDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StocktakeOrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.locationId) where.locationId = query.locationId;

    const [items, total] = await Promise.all([
      this.prisma.stocktakeOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { product: true, batch: true },
          },
          location: true,
        },
      }),
      this.prisma.stocktakeOrder.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const stocktake = await this.prisma.stocktakeOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true, batch: true },
        },
        location: true,
      },
    });

    if (!stocktake) throw new NotFoundException('盘点单不存在');

    return stocktake;
  }

  private generateReferenceNo(): string {
    const dateStr = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const randomStr = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `ST-${dateStr}-${randomStr}`;
  }
}
