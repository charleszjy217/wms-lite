import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateProductDto, operator: string) {
    // Check unique skuCode
    const existingByCode = await this.prisma.product.findUnique({
      where: { skuCode: dto.skuCode },
    });
    if (existingByCode) {
      throw new ConflictException('商品编码已存在');
    }

    // Check unique barcode if provided
    if (dto.barcode) {
      const existingByBarcode = await this.prisma.product.findUnique({
        where: { barcode: dto.barcode },
      });
      if (existingByBarcode) {
        throw new ConflictException('条码已存在');
      }
    }

    const data: Prisma.ProductUncheckedCreateInput = {
      skuCode: dto.skuCode,
      name: dto.name,
      description: dto.description ?? null,
      categoryId: dto.categoryId ?? null,
      brand: dto.brand ?? null,
      unitOfMeasure: dto.unitOfMeasure,
      barcode: dto.barcode ?? null,
      status: 'ACTIVE',
    };
    if (dto.specifications !== undefined) {
      data.specifications = dto.specifications as Prisma.JsonObject;
    }

    const product = await this.prisma.product.create({ data });

    await this.auditService.log({
      entityType: 'Product',
      entityId: product.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(product),
      operator,
      reason: null,
    });

    return product;
  }

  async findAll(query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }
    if (query.skuCode) {
      where.skuCode = { contains: query.skuCode, mode: 'insensitive' };
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, operator: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('商品不存在');
    }

    // Check unique skuCode if being updated
    if (dto.skuCode && dto.skuCode !== existing.skuCode) {
      const conflictByCode = await this.prisma.product.findUnique({
        where: { skuCode: dto.skuCode },
      });
      if (conflictByCode) {
        throw new ConflictException('商品编码已存在');
      }
    }

    // Check unique barcode if being updated
    if (dto.barcode && dto.barcode !== existing.barcode) {
      const conflictByBarcode = await this.prisma.product.findUnique({
        where: { barcode: dto.barcode },
      });
      if (conflictByBarcode) {
        throw new ConflictException('条码已存在');
      }
    }

    const before = JSON.stringify(existing);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.skuCode !== undefined) data.skuCode = dto.skuCode;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.unitOfMeasure !== undefined) data.unitOfMeasure = dto.unitOfMeasure;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.specifications !== undefined) {
      data.specifications = dto.specifications as Prisma.JsonObject;
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'Product',
      entityId: product.id,
      action: 'UPDATE',
      before,
      after: JSON.stringify(product),
      operator,
      reason: null,
    });

    return product;
  }

  async remove(id: string, operator: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('商品不存在');
    }

    const before = JSON.stringify(existing);

    await this.prisma.product.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'Product',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
  }
}
