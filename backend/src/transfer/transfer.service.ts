import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { QueryTransferDto } from './dto/query-transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTransferDto, operator: string) {
    // Validate source warehouse & location
    const [sourceWarehouse, sourceLocation, targetWarehouse, targetLocation] =
      await Promise.all([
        this.prisma.warehouse.findUnique({ where: { id: dto.sourceWarehouseId } }),
        this.prisma.location.findUnique({ where: { id: dto.sourceLocationId } }),
        this.prisma.warehouse.findUnique({ where: { id: dto.targetWarehouseId } }),
        this.prisma.location.findUnique({ where: { id: dto.targetLocationId } }),
      ]);

    if (!sourceWarehouse) throw new NotFoundException('来源仓库不存在');
    if (!sourceLocation) throw new NotFoundException('来源库位不存在');
    if (!targetWarehouse) throw new NotFoundException('目标仓库不存在');
    if (!targetLocation) throw new NotFoundException('目标库位不存在');

    // Validate items — product & batch exist
    for (const item of dto.items) {
      const [product, batch] = await Promise.all([
        this.prisma.product.findUnique({ where: { id: item.productId } }),
        this.prisma.batch.findUnique({ where: { id: item.batchId } }),
      ]);
      if (!product) throw new NotFoundException(`商品 ${item.productId} 不存在`);
      if (!batch) throw new NotFoundException(`批次 ${item.batchId} 不存在`);
    }

    // Create transfer order in DRAFT
    const transfer = await this.prisma.transferOrder.create({
      data: {
        sourceWarehouseId: dto.sourceWarehouseId,
        sourceLocationId: dto.sourceLocationId,
        targetWarehouseId: dto.targetWarehouseId,
        targetLocationId: dto.targetLocationId,
        referenceNo: dto.referenceNo,
        status: 'DRAFT',
        operator,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            batchId: item.batchId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    await this.auditService.log({
      entityType: 'TransferOrder',
      entityId: transfer.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(transfer),
      operator,
      reason: null,
    });

    return transfer;
  }

  async submit(id: string, operator: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) throw new NotFoundException('调拨单不存在');
    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException('仅 DRAFT 状态调拨单可提交');
    }

    // Transaction with row-level locking
    await this.prisma.$transaction(async (tx) => {
      // Lock & check inventory for each item
      for (const item of transfer.items) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; quantity: number }>>(
          `SELECT id, quantity FROM inventory_balance
           WHERE product_id = $1 AND location_id = $2 AND batch_id = $3
           FOR UPDATE`,
          item.productId,
          transfer.sourceLocationId,
          item.batchId,
        );

        const balance = rows[0];
        if (!balance || Number(balance.quantity) < item.quantity) {
          throw new BadRequestException(
            `库存不足: productId=${item.productId}, batchId=${item.batchId}, ` +
            `需要=${item.quantity}, 可用=${balance ? Number(balance.quantity) : 0}`,
          );
        }
      }

      // Deduct source balances
      for (const item of transfer.items) {
        await tx.$executeRawUnsafe(
          `UPDATE inventory_balance
           SET quantity = quantity - $1, updated_at = NOW()
           WHERE product_id = $2 AND location_id = $3 AND batch_id = $4`,
          item.quantity,
          item.productId,
          transfer.sourceLocationId,
          item.batchId,
        );
      }

      // Add target balances (upsert)
      for (const item of transfer.items) {
        await tx.$executeRawUnsafe(
          `INSERT INTO inventory_balance (id, product_id, location_id, batch_id, quantity, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (product_id, location_id, batch_id)
           DO UPDATE SET quantity = inventory_balance.quantity + $4, updated_at = NOW()`,
          item.productId,
          transfer.targetLocationId,
          item.batchId,
          item.quantity,
        );
      }

      // Create stock movement records (one per item, with both from/to set)
      for (const item of transfer.items) {
        const ref = transfer.referenceNo ?? transfer.id;

        await tx.stockMovement.create({
          data: {
            type: 'TRANSFER',
            productId: item.productId,
            batchId: item.batchId,
            fromLocationId: transfer.sourceLocationId,
            toLocationId: transfer.targetLocationId,
            quantity: item.quantity,
            referenceNo: ref,
            operator,
            reason: '调拨',
          },
        });
      }

      // Update status
      await tx.transferOrder.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      });
    });

    const updated = await this.findOne(id);

    await this.auditService.log({
      entityType: 'TransferOrder',
      entityId: id,
      action: 'SUBMIT',
      before: JSON.stringify({ status: 'DRAFT' }),
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  async complete(id: string, operator: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id },
    });

    if (!transfer) throw new NotFoundException('调拨单不存在');
    if (transfer.status !== 'SUBMITTED') {
      throw new BadRequestException('仅 SUBMITTED 状态调拨单可完成');
    }

    const updated = await this.prisma.transferOrder.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { items: true },
    });

    await this.auditService.log({
      entityType: 'TransferOrder',
      entityId: id,
      action: 'COMPLETE',
      before: JSON.stringify({ status: 'SUBMITTED' }),
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  async cancel(id: string, operator: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) throw new NotFoundException('调拨单不存在');
    if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
      throw new BadRequestException('已完成或已取消的调拨单不可取消');
    }

    if (transfer.status === 'SUBMITTED') {
      // Reverse inventory movements
      await this.prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          // Remove what was added to target
          await tx.$executeRawUnsafe(
            `UPDATE inventory_balance
             SET quantity = quantity - $1, updated_at = NOW()
             WHERE product_id = $2 AND location_id = $3 AND batch_id = $4`,
            item.quantity,
            item.productId,
            transfer.targetLocationId,
            item.batchId,
          );

          // Restore source
          await tx.$executeRawUnsafe(
            `UPDATE inventory_balance
             SET quantity = quantity + $1, updated_at = NOW()
             WHERE product_id = $2 AND location_id = $3 AND batch_id = $4`,
            item.quantity,
            item.productId,
            transfer.sourceLocationId,
            item.batchId,
          );

          // Reversal stock movement (from target back to source)
          await tx.stockMovement.create({
            data: {
              type: 'TRANSFER',
              productId: item.productId,
              batchId: item.batchId,
              fromLocationId: transfer.targetLocationId,
              toLocationId: transfer.sourceLocationId,
              quantity: item.quantity,
              referenceNo: transfer.referenceNo ?? transfer.id,
              operator,
              reason: '调拨取消-反向调整',
            },
          });
        }

        await tx.transferOrder.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      });
    } else {
      // DRAFT — just cancel
      await this.prisma.transferOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    }

    const updated = await this.findOne(id);

    await this.auditService.log({
      entityType: 'TransferOrder',
      entityId: id,
      action: 'CANCEL',
      before: JSON.stringify({ status: transfer.status }),
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  async findAll(query: QueryTransferDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransferOrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.operator) where.operator = { contains: query.operator, mode: 'insensitive' };
    if (query.referenceNo) where.referenceNo = { contains: query.referenceNo, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.transferOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { product: true, batch: true },
          },
          sourceWarehouse: true,
          sourceLocation: true,
          targetWarehouse: true,
          targetLocation: true,
        },
      }),
      this.prisma.transferOrder.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true, batch: true },
        },
        sourceWarehouse: true,
        sourceLocation: true,
        targetWarehouse: true,
        targetLocation: true,
      },
    });

    if (!transfer) throw new NotFoundException('调拨单不存在');

    return transfer;
  }
}
