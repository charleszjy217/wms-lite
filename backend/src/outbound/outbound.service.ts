import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BatchesService } from '../batches/batches.service';
import { CreateShippingOrderDto } from './dto/create-shipping-order.dto';
import { UpdateShippingOrderDto } from './dto/update-shipping-order.dto';
import { QueryShippingOrderDto } from './dto/query-shipping-order.dto';

/** Result of a FEFO allocation for a single item */
interface FefoAllocation {
  productId: string;
  productName: string;
  requestedQty: number;
  allocatedQty: number;
  allocations: Array<{
    batchId: string;
    batchNo: string;
    expiryDate: Date | null;
    quantity: number;
  }>;
}

/** A batch with available inventory for FEFO */
interface AvailableBatch {
  batchId: string;
  batchNo: string;
  expiryDate: Date | null;
  productId: string;
  availableQty: number;
}

@Injectable()
export class OutboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly batchesService: BatchesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateShippingOrderDto, operator: string) {
    // Validate warehouse
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('仓库不存在');
    }

    // Validate location
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException('库位不存在');
    }
    if (location.status !== 'ACTIVE') {
      throw new BadRequestException('库位已停用');
    }

    // Validate each item's product
    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`商品 ${item.productId} 不存在`);
      }
      if (product.status !== 'ACTIVE') {
        throw new BadRequestException(`商品 ${product.name} 已停用`);
      }
    }

    // Check reference number uniqueness if provided
    if (dto.referenceNo) {
      const existing = await this.prisma.shippingOrder.findUnique({
        where: { referenceNo: dto.referenceNo },
      });
      if (existing) {
        throw new ConflictException('发货单编号已存在');
      }
    }

    const referenceNo = dto.referenceNo ?? this.generateReferenceNo();

    const order = await this.prisma.shippingOrder.create({
      data: {
        referenceNo,
        status: 'DRAFT',
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        operator,
        notes: dto.notes ?? null,
        shipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : null,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    await this.auditService.log({
      entityType: 'ShippingOrder',
      entityId: order.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(order),
      operator,
      reason: null,
    });

    return order;
  }

  // ---------------------------------------------------------------------------
  // Find All (paginated)
  // ---------------------------------------------------------------------------

  async findAll(query: QueryShippingOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ShippingOrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.referenceNo) {
      where.referenceNo = { contains: query.referenceNo, mode: 'insensitive' };
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.locationId) where.locationId = query.locationId;

    const [items, total] = await Promise.all([
      this.prisma.shippingOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
        },
      }),
      this.prisma.shippingOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // Find One
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const order = await this.prisma.shippingOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('发货单不存在');
    }

    return order;
  }

  // ---------------------------------------------------------------------------
  // FEFO Suggestions (preview without committing)
  // ---------------------------------------------------------------------------

  async getFefoSuggestions(orderId: string): Promise<FefoAllocation[]> {
    const order = await this.prisma.shippingOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('发货单不存在');
    }

    const suggestions: FefoAllocation[] = [];

    for (const item of order.items) {
      const availableBatches = await this.findAvailableBatches(
        item.productId,
        order.locationId,
      );

      let remaining = item.quantity;
      const allocations: FefoAllocation['allocations'] = [];

      for (const ab of availableBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, ab.availableQty);
        allocations.push({
          batchId: ab.batchId,
          batchNo: ab.batchNo,
          expiryDate: ab.expiryDate,
          quantity: take,
        });
        remaining -= take;
      }

      suggestions.push({
        productId: item.productId,
        productName: item.product.name,
        requestedQty: item.quantity,
        allocatedQty: item.quantity - remaining,
        allocations,
      });
    }

    return suggestions;
  }

  // ---------------------------------------------------------------------------
  // Update (DRAFT only)
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateShippingOrderDto, operator: string) {
    const existing = await this.prisma.shippingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('发货单不存在');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的发货单可以修改');
    }

    // Validate items if provided
    if (dto.items) {
      for (const item of dto.items) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) {
          throw new NotFoundException(`商品 ${item.productId} 不存在`);
        }
      }
    }

    const before = JSON.stringify(existing);

    const updateData: Prisma.ShippingOrderUncheckedUpdateInput = {};
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.shipmentDate !== undefined) {
      updateData.shipmentDate = dto.shipmentDate
        ? new Date(dto.shipmentDate)
        : null;
    }

    const updated = await this.prisma.shippingOrder.update({
      where: { id },
      data: {
        ...updateData,
        ...(dto.items
          ? {
              items: {
                deleteMany: {},
                create: dto.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                })),
              },
            }
          : {}),
      },
      include: { items: { include: { product: true } } },
    });

    await this.auditService.log({
      entityType: 'ShippingOrder',
      entityId: id,
      action: 'UPDATE',
      before,
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Submit (DRAFT -> SUBMITTED) with FEFO stock deduction
  // ---------------------------------------------------------------------------

  async submit(id: string, operator: string) {
    const order = await this.prisma.shippingOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!order) {
      throw new NotFoundException('发货单不存在');
    }
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的发货单可以提交');
    }

    return this.prisma.$transaction(async (tx) => {
      // Track allocations for audit
      const allAllocations: Array<{
        productId: string;
        batchId: string;
        batchNo: string;
        quantity: number;
        productName: string;
      }> = [];

      for (const item of order.items) {
        // Find available batches (FEFO order, skip expired)
        const availableBatches = await this.txFindAvailableBatches(
          tx,
          item.productId,
          order.locationId,
        );

        // Check stock sufficiency
        const totalAvailable = availableBatches.reduce(
          (sum, ab) => sum + ab.availableQty,
          0,
        );
        if (totalAvailable < item.quantity) {
          throw new BadRequestException(
            `商品 ${item.product.name} 库存不足：需要 ${item.quantity}，可用 ${totalAvailable}`,
          );
        }

        let remaining = item.quantity;

        for (const ab of availableBatches) {
          if (remaining <= 0) break;

          const take = Math.min(remaining, ab.availableQty);

          // Lock and decrement InventoryBalance
          const balance = await tx.inventoryBalance.findUnique({
            where: {
              productId_locationId_batchId: {
                productId: item.productId,
                locationId: order.locationId,
                batchId: ab.batchId,
              },
            },
          });

          if (!balance) {
            throw new BadRequestException(
              `库存记录丢失：${item.product.name} / ${ab.batchNo}`,
            );
          }

          if (balance.quantity < take) {
            throw new BadRequestException(
              `批次 ${ab.batchNo} 库存不足：需要 ${take}，实际 ${balance.quantity}`,
            );
          }

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { quantity: { decrement: take } },
          });

          // Create OUTBOUND StockMovement
          const movement = await tx.stockMovement.create({
            data: {
              type: 'OUTBOUND',
              productId: item.productId,
              batchId: ab.batchId,
              fromLocationId: order.locationId,
              quantity: -take,
              referenceNo: order.referenceNo,
              operator,
              reason: `Outbound for SO: ${order.referenceNo}`,
            },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'StockMovement',
              entityId: movement.id,
              action: 'CREATE',
              before: null,
              after: JSON.stringify(movement),
              operator,
              reason: `Outbound deduction for SO: ${order.referenceNo}`,
            },
          });

          allAllocations.push({
            productId: item.productId,
            batchId: ab.batchId,
            batchNo: ab.batchNo,
            quantity: take,
            productName: item.product.name,
          });

          remaining -= take;
        }
      }

      const before = JSON.stringify(order);
      const updated = await tx.shippingOrder.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: { items: { include: { product: true } } },
      });

      const allocationSummary = allAllocations.map((a) => ({
        product: a.productName,
        batch: a.batchNo,
        qty: a.quantity,
      }));

      await tx.auditLog.create({
        data: {
          entityType: 'ShippingOrder',
          entityId: id,
          action: 'SUBMIT',
          before,
          after: JSON.stringify(updated),
          operator,
          reason: `FEFO allocations: ${JSON.stringify(allocationSummary)}`,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Complete (SUBMITTED -> COMPLETED)
  // ---------------------------------------------------------------------------

  async complete(id: string, operator: string) {
    const order = await this.prisma.shippingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('发货单不存在');
    }
    if (order.status !== 'SUBMITTED') {
      throw new BadRequestException('只有已提交的发货单可以完成');
    }

    const before = JSON.stringify(order);
    const updated = await this.prisma.shippingOrder.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { items: { include: { product: true } } },
    });

    await this.auditService.log({
      entityType: 'ShippingOrder',
      entityId: id,
      action: 'COMPLETE',
      before,
      after: JSON.stringify(updated),
      operator,
      reason: null,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Cancel (any status -> CANCELLED)
  // ---------------------------------------------------------------------------

  async cancel(id: string, operator: string) {
    const order = await this.prisma.shippingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('发货单不存在');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('发货单已取消');
    }

    // DRAFT -> CANCELLED: no stock impact
    if (order.status === 'DRAFT') {
      const before = JSON.stringify(order);
      const updated = await this.prisma.shippingOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { items: { include: { product: true } } },
      });

      await this.auditService.log({
        entityType: 'ShippingOrder',
        entityId: id,
        action: 'CANCEL',
        before,
        after: JSON.stringify(updated),
        operator,
        reason: null,
      });

      return updated;
    }

    // SUBMITTED / COMPLETED -> CANCELLED: reverse stock movements
    return this.prisma.$transaction(async (tx) => {
      const movements = await tx.stockMovement.findMany({
        where: {
          type: 'OUTBOUND',
          referenceNo: order.referenceNo,
        },
      });

      for (const movement of movements) {
        const reverseQty = Math.abs(movement.quantity);
        const reverseMovement = await tx.stockMovement.create({
          data: {
            type: 'INBOUND',
            productId: movement.productId,
            batchId: movement.batchId,
            toLocationId: movement.fromLocationId ?? order.locationId,
            quantity: reverseQty,
            referenceNo: order.referenceNo,
            operator,
            reason: `Cancel SO: ${order.referenceNo} — reverse outbound`,
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'StockMovement',
            entityId: reverseMovement.id,
            action: 'CREATE',
            before: null,
            after: JSON.stringify(reverseMovement),
            operator,
            reason: `Reverse stock for SO: ${order.referenceNo}`,
          },
        });

        // Restore InventoryBalance
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            productId_locationId_batchId: {
              productId: movement.productId,
              locationId: movement.fromLocationId ?? order.locationId,
              batchId: movement.batchId,
            },
          },
        });

        if (balance) {
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { quantity: { increment: reverseQty } },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'InventoryBalance',
              entityId: balance.id,
              action: 'UPDATE',
              before: JSON.stringify(balance),
              after: JSON.stringify({
                ...balance,
                quantity: balance.quantity + reverseQty,
              }),
              operator,
              reason: `Reverse stock for SO: ${order.referenceNo}`,
            },
          });
        }
      }

      const before = JSON.stringify(order);
      const updated = await tx.shippingOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { items: { include: { product: true } } },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'ShippingOrder',
          entityId: id,
          action: 'CANCEL',
          before,
          after: JSON.stringify(updated),
          operator,
          reason: `Reverse ${movements.length} outbound movement(s)`,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Delete (DRAFT only — hard delete)
  // ---------------------------------------------------------------------------

  async remove(id: string, operator: string) {
    const existing = await this.prisma.shippingOrder.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('发货单不存在');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的发货单可以删除');
    }

    const before = JSON.stringify(existing);

    await this.prisma.shippingOrder.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'ShippingOrder',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
  }

  // ---------------------------------------------------------------------------
  // FEFO: Find available batches (non-transactional, for preview)
  // ---------------------------------------------------------------------------

  private async findAvailableBatches(
    productId: string,
    locationId: string,
  ): Promise<AvailableBatch[]> {
    const now = new Date();

    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        productId,
        locationId,
        quantity: { gt: 0 },
      },
      include: {
        batch: true,
      },
    });

    const available: AvailableBatch[] = balances
      .filter((b) => {
        if (b.batch.expiryDate && b.batch.expiryDate <= now) return false;
        if (b.batch.status === 'EXPIRED') return false;
        return true;
      })
      .map((b) => ({
        batchId: b.batchId,
        batchNo: b.batch.batchNo,
        expiryDate: b.batch.expiryDate,
        productId: b.productId,
        availableQty: b.quantity,
      }))
      .sort((a, b) => {
        if (a.expiryDate === null && b.expiryDate === null) return 0;
        if (a.expiryDate === null) return 1;
        if (b.expiryDate === null) return -1;
        return a.expiryDate.getTime() - b.expiryDate.getTime();
      });

    return available;
  }

  // ---------------------------------------------------------------------------
  // FEFO: Transaction-aware version for submit
  // ---------------------------------------------------------------------------

  private async txFindAvailableBatches(
    tx: Omit<
      Prisma.TransactionClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
    productId: string,
    locationId: string,
  ): Promise<AvailableBatch[]> {
    const now = new Date();

    const balances = await tx.inventoryBalance.findMany({
      where: {
        productId,
        locationId,
        quantity: { gt: 0 },
      },
      include: {
        batch: true,
      },
    });

    const available: AvailableBatch[] = balances
      .filter((b) => {
        if (b.batch.expiryDate && b.batch.expiryDate <= now) return false;
        if (b.batch.status === 'EXPIRED') return false;
        return true;
      })
      .map((b) => ({
        batchId: b.batchId,
        batchNo: b.batch.batchNo,
        expiryDate: b.batch.expiryDate,
        productId: b.productId,
        availableQty: b.quantity,
      }))
      .sort((a, b) => {
        if (a.expiryDate === null && b.expiryDate === null) return 0;
        if (a.expiryDate === null) return 1;
        if (b.expiryDate === null) return -1;
        return a.expiryDate.getTime() - b.expiryDate.getTime();
      });

    return available;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private generateReferenceNo(): string {
    const dateStr = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const randomStr = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `SO-${dateStr}-${randomStr}`;
  }
}