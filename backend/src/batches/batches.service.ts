import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { QueryBatchDto, SortExpiryOrder } from './dto/query-batch.dto';

const NEAR_EXPIRY_DAYS = 30;

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateBatchDto, operator: string) {
    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    // Check unique batchNo + productId
    const existing = await this.prisma.batch.findUnique({
      where: { batchNo_productId: { batchNo: dto.batchNo, productId: dto.productId } },
    });
    if (existing) {
      throw new ConflictException('该商品下批次号已存在');
    }

    // Compute status based on expiry if not explicitly provided
    let status = dto.status ?? 'ACTIVE';
    if (!dto.status && dto.expiryDate) {
      const expiry = new Date(dto.expiryDate);
      const now = new Date();
      if (expiry <= now) {
        status = 'EXPIRED';
      } else {
        const diffMs = expiry.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= NEAR_EXPIRY_DAYS) {
          status = 'NEAR_EXPIRY';
        }
      }
    }

    const data: Prisma.BatchUncheckedCreateInput = {
      batchNo: dto.batchNo,
      productId: dto.productId,
      productionDate: dto.productionDate ? new Date(dto.productionDate) : null,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      status,
    };

    const batch = await this.prisma.batch.create({ data });

    await this.auditService.log({
      entityType: 'Batch',
      entityId: batch.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(batch),
      operator,
      reason: null,
    });

    return this.enrichWithExpiryInfo(batch);
  }

  async findAll(query: QueryBatchDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BatchWhereInput = {};
    const now = new Date();

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.batchNo) {
      where.batchNo = { contains: query.batchNo, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.expiryDateFrom || query.expiryDateTo) {
      where.expiryDate = {};
      if (query.expiryDateFrom) {
        where.expiryDate.gte = new Date(query.expiryDateFrom);
      }
      if (query.expiryDateTo) {
        where.expiryDate.lte = new Date(query.expiryDateTo);
      }
    }
    if (query.nearExpiry) {
      // Batches expiring within NEAR_EXPIRY_DAYS but not yet expired
      const future = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      where.expiryDate = {
        ...((where.expiryDate as Prisma.DateTimeNullableFilter) ?? {}),
        gte: now,
        lte: future,
      } as Prisma.DateTimeNullableFilter;
    }
    if (query.expired) {
      where.expiryDate = {
        ...((where.expiryDate as Prisma.DateTimeNullableFilter) ?? {}),
        lt: now,
      } as Prisma.DateTimeNullableFilter;
    }

    // Build orderBy
    let orderBy: Prisma.BatchOrderByWithRelationInput | Prisma.BatchOrderByWithRelationInput[] = { createdAt: 'desc' };
    if (query.sortByExpiry) {
      orderBy = { expiryDate: query.sortByExpiry };
    }

    const [items, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { product: true },
      }),
      this.prisma.batch.count({ where }),
    ]);

    return {
      items: items.map((item) => this.enrichWithExpiryInfo(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!batch) {
      throw new NotFoundException('批次不存在');
    }

    return this.enrichWithExpiryInfo(batch);
  }

  async update(id: string, dto: UpdateBatchDto, operator: string) {
    const existing = await this.prisma.batch.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('批次不存在');
    }

    // Check unique batchNo + productId if batchNo or productId changing
    const newBatchNo = dto.batchNo ?? existing.batchNo;
    const newProductId = dto.productId ?? existing.productId;
    if (
      (dto.batchNo && dto.batchNo !== existing.batchNo) ||
      (dto.productId && dto.productId !== existing.productId)
    ) {
      const conflict = await this.prisma.batch.findUnique({
        where: { batchNo_productId: { batchNo: newBatchNo, productId: newProductId } },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('该商品下批次号已存在');
      }
    }

    // Check product exists if productId changing
    if (dto.productId && dto.productId !== existing.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException('商品不存在');
      }
    }

    const before = JSON.stringify(existing);

    const data: Prisma.BatchUncheckedUpdateInput = {};
    if (dto.batchNo !== undefined) data.batchNo = dto.batchNo;
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.productionDate !== undefined) {
      data.productionDate = dto.productionDate ? new Date(dto.productionDate) : null;
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    } else if (dto.expiryDate !== undefined) {
      // Recompute status based on new expiry date
      const expiry = dto.expiryDate ? new Date(dto.expiryDate) : null;
      if (expiry) {
        const now = new Date();
        if (expiry <= now) {
          data.status = 'EXPIRED';
        } else {
          const diffMs = expiry.getTime() - now.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          data.status = diffDays <= NEAR_EXPIRY_DAYS ? 'NEAR_EXPIRY' : 'ACTIVE';
        }
      } else {
        data.status = 'ACTIVE';
      }
    }

    const batch = await this.prisma.batch.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'Batch',
      entityId: batch.id,
      action: 'UPDATE',
      before,
      after: JSON.stringify(batch),
      operator,
      reason: null,
    });

    return this.enrichWithExpiryInfo(batch);
  }

  async remove(id: string, operator: string) {
    const existing = await this.prisma.batch.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('批次不存在');
    }

    const before = JSON.stringify(existing);

    await this.prisma.batch.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'Batch',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
  }

  /**
   * Validate that a batch is not expired (for outbound interception).
   * Throws BadRequestException if the batch is expired.
   */
  async validateBatchNotExpired(batchId: string): Promise<void> {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException('批次不存在');
    }

    if (batch.expiryDate && batch.expiryDate <= new Date()) {
      throw new BadRequestException('批次已过期，不可用于出库');
    }
  }

  /**
   * Find all batches that are expiring within the given number of days.
   */
  async findExpiring(days: number = NEAR_EXPIRY_DAYS) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const items = await this.prisma.batch.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: future,
        },
        status: { not: 'EXPIRED' },
      },
      include: { product: true },
      orderBy: { expiryDate: 'asc' },
    });

    return items.map((item) => this.enrichWithExpiryInfo(item));
  }

  // ── Helpers ──────────────────────────────────────────────

  private enrichWithExpiryInfo(batch: {
    id: string;
    batchNo: string;
    productId: string;
    productionDate: Date | null;
    expiryDate: Date | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    product?: unknown;
  }) {
    let remainingDays: number | null = null;
    let isExpired = false;
    let isNearExpiry = false;

    if (batch.expiryDate) {
      const now = new Date();
      const expiryTime = batch.expiryDate.getTime();
      const nowTime = now.getTime();
      const diffMs = expiryTime - nowTime;
      remainingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      isExpired = diffMs <= 0;
      isNearExpiry = !isExpired && remainingDays <= NEAR_EXPIRY_DAYS;
    }

    return {
      ...batch,
      remainingDays,
      isExpired,
      isNearExpiry,
    };
  }
}
