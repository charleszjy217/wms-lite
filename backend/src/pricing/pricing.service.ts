import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePriceListDto,
  UpdatePriceListDto,
  CreateProductPriceDto,
  UpdateProductPriceDto,
  AdjustProductPriceDto,
  BatchUpdatePriceDto,
  AdjustmentMode,
  PriceChangeLogQueryDto,
} from './dto/pricing.dto';

/**
 * Configuration for approval workflow.
 * When enabled, batch adjustments will require approval before applying.
 * This is a placeholder — in production, read from a config service or env var.
 */
const PRICING_CONFIG = {
  approvalRequired: process.env['PRICING_APPROVAL_REQUIRED'] === 'true',
};

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ===========================================================================
  // PriceList CRUD
  // ===========================================================================

  async createPriceList(dto: CreatePriceListDto) {
    const existing = await this.prisma.priceList.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`价目表编码 ${dto.code} 已存在`);
    }

    return this.prisma.priceList.create({
      data: {
        code: dto.code,
        name: dto.name,
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async findAllPriceLists() {
    return this.prisma.priceList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { productPrices: true } } },
    });
  }

  async findPriceListById(id: string) {
    const priceList = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        productPrices: {
          include: { product: true },
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });
    if (!priceList) {
      throw new NotFoundException(`价目表 ${id} 不存在`);
    }
    return priceList;
  }

  async updatePriceList(id: string, dto: UpdatePriceListDto) {
    await this.findPriceListById(id);
    return this.prisma.priceList.update({
      where: { id },
      data: dto,
    });
  }

  // ===========================================================================
  // ProductPrice CRUD
  // ===========================================================================

  async createProductPrice(dto: CreateProductPriceDto) {
    // Verify priceList exists
    const priceList = await this.prisma.priceList.findUnique({
      where: { id: dto.priceListId },
    });
    if (!priceList) {
      throw new NotFoundException(`价目表 ${dto.priceListId} 不存在`);
    }

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`商品 ${dto.productId} 不存在`);
    }

    // Check for duplicate product/priceList combination
    const existing = await this.prisma.productPrice.findFirst({
      where: {
        priceListId: dto.priceListId,
        productId: dto.productId,
      },
    });
    if (existing) {
      throw new BadRequestException('该价目表中已存在此商品的价格记录');
    }

    return this.prisma.productPrice.create({
      data: {
        priceListId: dto.priceListId,
        productId: dto.productId,
        unitPrice: dto.unitPrice,
        effectiveDate: new Date(dto.effectiveDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: { product: true, priceList: true },
    });
  }

  async findAllProductPrices(
    priceListId?: string,
    productId?: string,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.ProductPriceWhereInput = {};
    if (priceListId) where.priceListId = priceListId;
    if (productId) where.productId = productId;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.productPrice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveDate: 'desc' },
        include: { product: true, priceList: true },
      }),
      this.prisma.productPrice.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findProductPriceById(id: string) {
    const price = await this.prisma.productPrice.findUnique({
      where: { id },
      include: { product: true, priceList: true },
    });
    if (!price) {
      throw new NotFoundException(`商品价格记录 ${id} 不存在`);
    }
    return price;
  }

  async updateProductPrice(id: string, dto: UpdateProductPriceDto) {
    await this.findProductPriceById(id);
    const data: Record<string, unknown> = {};
    if (dto.unitPrice !== undefined) data.unitPrice = dto.unitPrice;
    if (dto.effectiveDate !== undefined) data.effectiveDate = new Date(dto.effectiveDate);
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate === null ? null : new Date(dto.endDate);
    }

    return this.prisma.productPrice.update({
      where: { id },
      data,
      include: { product: true, priceList: true },
    });
  }

  async deleteProductPrice(id: string) {
    await this.findProductPriceById(id);
    return this.prisma.productPrice.delete({ where: { id } });
  }

  // ===========================================================================
  // Single Price Adjustment
  // ===========================================================================

  async adjustProductPrice(
    id: string,
    dto: AdjustProductPriceDto,
    operator: string,
  ) {
    const productPrice = await this.findProductPriceById(id);
    const oldPrice = productPrice.unitPrice;
    const newPrice = dto.unitPrice;

    // Update the price
    const updated = await this.prisma.productPrice.update({
      where: { id },
      data: {
        unitPrice: newPrice,
        effectiveDate: new Date(dto.effectiveDate),
      },
      include: { product: true, priceList: true },
    });

    // Record the change log
    await this.prisma.priceChangeLog.create({
      data: {
        productPriceId: id,
        productId: productPrice.productId,
        oldPrice,
        newPrice,
        effectiveDate: new Date(dto.effectiveDate),
        operator,
        reason: dto.reason ?? null,
      },
    });

    // Write audit log
    await this.auditService.log({
      entityType: 'ProductPrice',
      entityId: id,
      action: 'PRICE_ADJUST',
      before: JSON.stringify({ unitPrice: oldPrice }),
      after: JSON.stringify({ unitPrice: newPrice }),
      operator,
      reason: dto.reason ?? null,
    });

    return updated;
  }

  // ===========================================================================
  // Batch Price Adjustment
  // ===========================================================================

  async batchUpdatePrice(
    dto: BatchUpdatePriceDto,
    operator: string,
  ): Promise<{ applied: number; pendingReview: boolean; message: string }> {
    // Resolve which products are affected
    const productIds = await this.resolveTargetProducts(dto);

    if (productIds.length === 0) {
      throw new BadRequestException('没有匹配的商品');
    }

    // Find all active price records for these products
    const priceRecords = await this.prisma.productPrice.findMany({
      where: {
        productId: { in: productIds },
        priceList: { status: 'ACTIVE' },
      },
      include: { priceList: true },
    });

    if (priceRecords.length === 0) {
      throw new BadRequestException('没有找到匹配的有效价格记录');
    }

    // Check if approval is required
    if (PRICING_CONFIG.approvalRequired) {
      // Placeholder: in production, create an approval request instead
      return {
        applied: 0,
        pendingReview: true,
        message: '批量调价需要审批，已提交审批请求',
      };
    }

    const effectiveDate = new Date(dto.effectiveDate);
    let applied = 0;

    for (const record of priceRecords) {
      const oldPrice = record.unitPrice;
      let newPrice: number;

      if (dto.mode === AdjustmentMode.FIXED) {
        newPrice = oldPrice + dto.adjustmentValue;
      } else {
        // Percentage mode
        newPrice = oldPrice * (1 + dto.adjustmentValue / 100);
      }

      // Round to 2 decimal places
      newPrice = Math.round(newPrice * 100) / 100;

      if (newPrice < 0) {
        newPrice = 0;
      }

      // Update the price
      await this.prisma.productPrice.update({
        where: { id: record.id },
        data: { unitPrice: newPrice, effectiveDate },
      });

      // Record change log
      await this.prisma.priceChangeLog.create({
        data: {
          productPriceId: record.id,
          productId: record.productId,
          oldPrice,
          newPrice,
          effectiveDate,
          operator,
          reason: dto.reason,
        },
      });

      // Audit log
      await this.auditService.log({
        entityType: 'ProductPrice',
        entityId: record.id,
        action: 'BATCH_PRICE_ADJUST',
        before: JSON.stringify({ unitPrice: oldPrice }),
        after: JSON.stringify({ unitPrice: newPrice }),
        operator,
        reason: dto.reason,
      });

      applied++;
    }

    return {
      applied,
      pendingReview: false,
      message: `成功调价 ${applied} 条记录`,
    };
  }

  private async resolveTargetProducts(
    dto: BatchUpdatePriceDto,
  ): Promise<string[]> {
    const { categoryId, productIds } = dto;

    if (categoryId) {
      // Find all products in this category (including subcategories)
      const category = await this.prisma.productCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException(`商品分类 ${categoryId} 不存在`);
      }

      // Find all descendant categories
      const allCategoryIds = await this.findAllSubCategoryIds(categoryId);
      allCategoryIds.push(categoryId);

      const products = await this.prisma.product.findMany({
        where: { categoryId: { in: allCategoryIds } },
        select: { id: true },
      });
      return products.map((p) => p.id);
    }

    if (productIds && productIds.length > 0) {
      return productIds;
    }

    throw new BadRequestException('请指定商品分类或商品ID列表');
  }

  private async findAllSubCategoryIds(
    parentId: string,
  ): Promise<string[]> {
    const children = await this.prisma.productCategory.findMany({
      where: { parentId },
      select: { id: true },
    });

    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const grandChildren = await this.findAllSubCategoryIds(child.id);
      ids.push(...grandChildren);
    }
    return ids;
  }

  // ===========================================================================
  // Price Change History
  // ===========================================================================

  async findPriceChangeLogs(query: PriceChangeLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PriceChangeLogWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.startDate || query.endDate) {
      where.effectiveDate = {};
      if (query.startDate) {
        where.effectiveDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.effectiveDate.lte = new Date(query.endDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.priceChangeLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, skuCode: true, name: true } },
          productPrice: {
            select: { id: true, priceList: { select: { name: true } } },
          },
        },
      }),
      this.prisma.priceChangeLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
