import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateReceivingOrderDto } from './dto/create-receiving-order.dto';
import { UpdateReceivingOrderDto } from './dto/update-receiving-order.dto';
import { QueryReceivingOrderDto } from './dto/query-receiving-order.dto';

@Injectable()
export class InboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateReceivingOrderDto, operator: string) {
    // Validate warehouse
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('仓库不存在');
    }

    // Validate location and ensure it belongs to the given warehouse
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
      include: { zone: true },
    });
    if (!location) {
      throw new NotFoundException('库位不存在');
    }
    if (!location.zone) {
      throw new BadRequestException('库位未分配库区');
    }
    if (location.zone.warehouseId !== dto.warehouseId) {
      throw new BadRequestException('库位不属于指定仓库');
    }
    if (location.status !== 'ACTIVE') {
      throw new BadRequestException('库位已停用');
    }

    // Validate each item's product and optional batch
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

      if (item.batchId) {
        const batch = await this.prisma.batch.findUnique({
          where: { id: item.batchId },
        });
        if (!batch) {
          throw new NotFoundException(`批次 ${item.batchId} 不存在`);
        }
        if (batch.productId !== item.productId) {
          throw new BadRequestException('批次与商品不匹配');
        }
      }
    }

    // Check reference number uniqueness if provided
    if (dto.referenceNo) {
      const existing = await this.prisma.receivingOrder.findUnique({
        where: { referenceNo: dto.referenceNo },
      });
      if (existing) {
        throw new ConflictException('收货单编号已存在');
      }
    }

    const referenceNo = dto.referenceNo ?? this.generateReferenceNo();

    const order = await this.prisma.receivingOrder.create({
      data: {
        referenceNo,
        status: 'DRAFT',
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        operator,
        notes: dto.notes ?? null,
        receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : null,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            batchId: item.batchId ?? null,
            batchNo: item.batchNo,
            productionDate: item.productionDate
              ? new Date(item.productionDate)
              : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    await this.auditService.log({
      entityType: 'ReceivingOrder',
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

  async findAll(query: QueryReceivingOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReceivingOrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.referenceNo) {
      where.referenceNo = { contains: query.referenceNo, mode: 'insensitive' };
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.locationId) where.locationId = query.locationId;

    const [items, total] = await Promise.all([
      this.prisma.receivingOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
        },
      }),
      this.prisma.receivingOrder.count({ where }),
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
    const order = await this.prisma.receivingOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('收货单不存在');
    }

    return order;
  }

  // ---------------------------------------------------------------------------
  // Update (DRAFT only)
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateReceivingOrderDto, operator: string) {
    const existing = await this.prisma.receivingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('收货单不存在');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的收货单可以修改');
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
        if (item.batchId) {
          const batch = await this.prisma.batch.findUnique({
            where: { id: item.batchId },
          });
          if (!batch) {
            throw new NotFoundException(`批次 ${item.batchId} 不存在`);
          }
          if (batch.productId !== item.productId) {
            throw new BadRequestException('批次与商品不匹配');
          }
        }
      }
    }

    const before = JSON.stringify(existing);

    const updateData: Prisma.ReceivingOrderUncheckedUpdateInput = {};
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.receiptDate !== undefined) {
      updateData.receiptDate = dto.receiptDate
        ? new Date(dto.receiptDate)
        : null;
    }

    const updated = await this.prisma.receivingOrder.update({
      where: { id },
      data: {
        ...updateData,
        ...(dto.items
          ? {
              items: {
                deleteMany: {},
                create: dto.items.map((item) => ({
                  productId: item.productId,
                  batchId: item.batchId ?? null,
                  batchNo: item.batchNo,
                  productionDate: item.productionDate
                    ? new Date(item.productionDate)
                    : null,
                  expiryDate: item.expiryDate
                    ? new Date(item.expiryDate)
                    : null,
                  quantity: item.quantity,
                })),
              },
            }
          : {}),
      },
      include: { items: { include: { product: true } } },
    });

    await this.auditService.log({
      entityType: 'ReceivingOrder',
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
  // Submit (DRAFT → SUBMITTED)
  // ---------------------------------------------------------------------------

  async submit(id: string, operator: string) {
    const order = await this.prisma.receivingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('收货单不存在');
    }
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的收货单可以提交');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        // 1. Find or create batch
        let batchId = item.batchId;
        if (!batchId) {
          const existing = await tx.batch.findUnique({
            where: {
              batchNo_productId: {
                batchNo: item.batchNo,
                productId: item.productId,
              },
            },
          });
          if (existing) {
            batchId = existing.id;
          } else {
            const newBatch = await tx.batch.create({
              data: {
                batchNo: item.batchNo,
                productId: item.productId,
                productionDate: item.productionDate,
                expiryDate: item.expiryDate,
                status: 'ACTIVE',
              },
            });
            batchId = newBatch.id;

            await tx.auditLog.create({
              data: {
                entityType: 'Batch',
                entityId: newBatch.id,
                action: 'CREATE',
                before: null,
                after: JSON.stringify(newBatch),
                operator,
                reason: `Auto-created during inbound (RO: ${order.referenceNo})`,
              },
            });
          }
        }

        // Persist resolved batchId on the item
        await tx.receivingOrderItem.update({
          where: { id: item.id },
          data: { batchId },
        });

        // 2. Create StockMovement (INBOUND)
        const movement = await tx.stockMovement.create({
          data: {
            type: 'INBOUND',
            productId: item.productId,
            batchId,
            toLocationId: order.locationId,
            quantity: item.quantity,
            referenceNo: order.referenceNo ?? null,
            operator,
            reason: null,
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
            reason: `Inbound for RO: ${order.referenceNo}`,
          },
        });

        // 3. Upsert InventoryBalance (product × location × batch)
        const balance = await tx.inventoryBalance.upsert({
          where: {
            productId_locationId_batchId: {
              productId: item.productId,
              locationId: order.locationId,
              batchId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
          },
          create: {
            productId: item.productId,
            locationId: order.locationId,
            batchId,
            quantity: item.quantity,
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'InventoryBalance',
            entityId: balance.id,
            action: 'UPSERT',
            before: null,
            after: JSON.stringify(balance),
            operator,
            reason: `Inbound for RO: ${order.referenceNo}`,
          },
        });
      }

      const before = JSON.stringify(order);
      const updated = await tx.receivingOrder.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: { items: { include: { product: true } } },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'ReceivingOrder',
          entityId: id,
          action: 'SUBMIT',
          before,
          after: JSON.stringify(updated),
          operator,
          reason: null,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Complete (SUBMITTED → COMPLETED)
  // ---------------------------------------------------------------------------

  async complete(id: string, operator: string) {
    const order = await this.prisma.receivingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('收货单不存在');
    }
    if (order.status !== 'SUBMITTED') {
      throw new BadRequestException('只有已提交的收货单可以完成');
    }

    const before = JSON.stringify(order);
    const updated = await this.prisma.receivingOrder.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { items: { include: { product: true } } },
    });

    await this.auditService.log({
      entityType: 'ReceivingOrder',
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
  // Cancel (any status → CANCELLED)
  // ---------------------------------------------------------------------------

  async cancel(id: string, operator: string) {
    const order = await this.prisma.receivingOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('收货单不存在');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('收货单已取消');
    }

    // DRAFT → CANCELLED: no stock impact
    if (order.status === 'DRAFT') {
      const before = JSON.stringify(order);
      const updated = await this.prisma.receivingOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { items: { include: { product: true } } },
      });

      await this.auditService.log({
        entityType: 'ReceivingOrder',
        entityId: id,
        action: 'CANCEL',
        before,
        after: JSON.stringify(updated),
        operator,
        reason: null,
      });

      return updated;
    }

    // SUBMITTED / COMPLETED → CANCELLED: reverse stock movements
    return this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.batchId) continue;

        // Reverse StockMovement (negative quantity)
        const movement = await tx.stockMovement.create({
          data: {
            type: 'INBOUND',
            productId: item.productId,
            batchId: item.batchId,
            toLocationId: order.locationId,
            quantity: -item.quantity,
            referenceNo: order.referenceNo ?? null,
            operator,
            reason: `Cancel RO: ${order.referenceNo}`,
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
            reason: `Reverse stock for RO: ${order.referenceNo}`,
          },
        });

        // Decrement InventoryBalance
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            productId_locationId_batchId: {
              productId: item.productId,
              locationId: order.locationId,
              batchId: item.batchId,
            },
          },
        });

        if (balance) {
          const updatedBalance = await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { quantity: { decrement: item.quantity } },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'InventoryBalance',
              entityId: updatedBalance.id,
              action: 'UPDATE',
              before: JSON.stringify(balance),
              after: JSON.stringify(updatedBalance),
              operator,
              reason: `Reverse stock for RO: ${order.referenceNo}`,
            },
          });
        }
      }

      const before = JSON.stringify(order);
      const updated = await tx.receivingOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { items: { include: { product: true } } },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'ReceivingOrder',
          entityId: id,
          action: 'CANCEL',
          before,
          after: JSON.stringify(updated),
          operator,
          reason: null,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Delete (DRAFT only — hard delete)
  // ---------------------------------------------------------------------------

  async remove(id: string, operator: string) {
    const existing = await this.prisma.receivingOrder.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('收货单不存在');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的收货单可以删除');
    }

    const before = JSON.stringify(existing);

    await this.prisma.receivingOrder.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'ReceivingOrder',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
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
    return `RO-${dateStr}-${randomStr}`;
  }
}
