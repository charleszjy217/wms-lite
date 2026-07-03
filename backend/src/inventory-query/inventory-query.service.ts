import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBalanceDto } from './dto/query-balance.dto';
import { QueryMovementDto } from './dto/query-movement.dto';
import { QueryExpiryReportDto } from './dto/query-expiry-report.dto';
import { QueryValuationDto } from './dto/query-valuation.dto';
import { QuerySummaryDto } from './dto/query-summary.dto';

@Injectable()
export class InventoryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // 1. Real-time Inventory Balance
  // ===========================================================================

  async findBalances(query: QueryBalanceDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryBalanceWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.batchId) {
      where.batchId = query.batchId;
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { batchId: 'asc' }],
        include: {
          product: { select: { id: true, skuCode: true, name: true, unitOfMeasure: true } },
          location: {
            select: {
              id: true,
              area: true,
              aisle: true,
              rack: true,
              level: true,
              position: true,
              warehouse: { select: { id: true, code: true, name: true } },
            },
          },
          batch: { select: { id: true, batchNo: true, expiryDate: true, status: true } },
        },
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ===========================================================================
  // 2. Stock Movement Detail
  // ===========================================================================

  async findMovements(query: QueryMovementDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.batchId) {
      where.batchId = query.batchId;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, skuCode: true, name: true } },
          batch: { select: { id: true, batchNo: true } },
          fromLocation: {
            select: {
              id: true,
              area: true,
              aisle: true,
              rack: true,
              level: true,
              position: true,
            },
          },
          toLocation: {
            select: {
              id: true,
              area: true,
              aisle: true,
              rack: true,
              level: true,
              position: true,
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ===========================================================================
  // 3. Near-expiry / Expired Report
  // ===========================================================================

  async findExpiryReport(query: QueryExpiryReportDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const nearExpiryDays = query.nearExpiryDays ?? 30;
    const now = new Date();

    const where: Prisma.BatchWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.batchId) {
      where.id = query.batchId;
    }

    // Build expiry date conditions
    const expiryConditions: Prisma.DateTimeNullableFilter = {};

    if (query.showExpired && query.showNearExpiry) {
      // Show both expired and near-expiry batches
      const future = new Date(now.getTime() + nearExpiryDays * 24 * 60 * 60 * 1000);
      expiryConditions.lte = future;
      where.expiryDate = expiryConditions;
    } else if (query.showExpired) {
      // Only expired batches
      expiryConditions.lt = now;
      where.expiryDate = expiryConditions;
    } else if (query.showNearExpiry) {
      // Only near-expiry batches (within threshold, not yet expired)
      const future = new Date(now.getTime() + nearExpiryDays * 24 * 60 * 60 * 1000);
      expiryConditions.gte = now;
      expiryConditions.lte = future;
      where.expiryDate = expiryConditions;
    }

    const [items, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expiryDate: 'asc' },
        include: {
          product: { select: { id: true, skuCode: true, name: true, unitOfMeasure: true } },
          inventoryBalances: {
            select: {
              id: true,
              quantity: true,
              location: {
                select: {
                  id: true,
                  area: true,
                  aisle: true,
                  rack: true,
                  level: true,
                  position: true,
                  warehouse: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.batch.count({ where }),
    ]);

    // Enrich with computed expiry info
    const enrichedItems = items.map((batch) => {
      const expiryDate = batch.expiryDate;
      let remainingDays: number | null = null;
      let isExpired = false;
      let isNearExpiry = false;

      if (expiryDate) {
        const diffMs = expiryDate.getTime() - now.getTime();
        remainingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        isExpired = diffMs <= 0;
        isNearExpiry = !isExpired && remainingDays <= nearExpiryDays;
      }

      const totalStock = batch.inventoryBalances.reduce(
        (sum, ib) => sum + ib.quantity,
        0,
      );

      return {
        ...batch,
        remainingDays,
        isExpired,
        isNearExpiry,
        totalStock,
      };
    });

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      nearExpiryDays,
    };
  }

  // ===========================================================================
  // 4. Inventory Valuation
  // ===========================================================================

  async findValuation(query: QueryValuationDto) {
    // Find the price list (default to first ACTIVE one if not specified)
    let priceListId = query.priceListId;
    if (!priceListId) {
      const defaultPriceList = await this.prisma.priceList.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (defaultPriceList) {
        priceListId = defaultPriceList.id;
      }
    }

    // Build balance filter
    const balanceWhere: Prisma.InventoryBalanceWhereInput = {};
    if (query.warehouseId) {
      balanceWhere.location = { warehouseId: query.warehouseId };
    }

    // Get all balances with quantity > 0
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        ...balanceWhere,
        quantity: { gt: 0 },
      },
      include: {
        product: {
          select: {
            id: true,
            skuCode: true,
            name: true,
            unitOfMeasure: true,
            categoryId: true,
            category: { select: { id: true, code: true, name: true } },
          },
        },
        location: {
          select: {
            id: true,
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    // Get product prices if price list found
    let priceMap = new Map<string, number>();
    if (priceListId) {
      const prices = await this.prisma.productPrice.findMany({
        where: {
          priceListId,
          productId: { in: [...new Set(balances.map((b) => b.productId))] },
          effectiveDate: { lte: new Date() },
          AND: [
            { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
          ],
        },
        orderBy: { effectiveDate: 'desc' },
      });

      // Get the latest price per product
      const latestPrice = new Map<string, number>();
      for (const price of prices) {
        if (!latestPrice.has(price.productId)) {
          latestPrice.set(price.productId, price.unitPrice);
        }
      }
      priceMap = latestPrice;
    }

    // Compute valuation per balance record
    const valuationItems = balances
      .filter((b) => priceMap.has(b.productId))
      .map((balance) => {
        const unitPrice = priceMap.get(balance.productId) ?? 0;
        return {
          productId: balance.productId,
          skuCode: balance.product.skuCode,
          productName: balance.product.name,
          unitOfMeasure: balance.product.unitOfMeasure,
          categoryId: balance.product.categoryId,
          categoryName: balance.product.category?.name ?? null,
          warehouseId: balance.location.warehouse.id,
          warehouseCode: balance.location.warehouse.code,
          warehouseName: balance.location.warehouse.name,
          quantity: balance.quantity,
          unitPrice,
          totalValue: Math.round(balance.quantity * unitPrice * 100) / 100,
        };
      });

    // Apply category filter if specified
    let filteredItems = valuationItems;
    if (query.categoryId) {
      filteredItems = valuationItems.filter(
        (v) => v.categoryId === query.categoryId,
      );
    }

    // Group if requested
    if (query.groupBy === 'warehouse') {
      const grouped = new Map<
        string,
        {
          warehouseId: string;
          warehouseCode: string;
          warehouseName: string;
          totalQuantity: number;
          totalValue: number;
          itemCount: number;
        }
      >();

      for (const item of filteredItems) {
        const key = item.warehouseId;
        const existing = grouped.get(key) ?? {
          warehouseId: item.warehouseId,
          warehouseCode: item.warehouseCode,
          warehouseName: item.warehouseName,
          totalQuantity: 0,
          totalValue: 0,
          itemCount: 0,
        };
        existing.totalQuantity += item.quantity;
        existing.totalValue += item.totalValue;
        existing.itemCount++;
        grouped.set(key, existing);
      }

      return {
        groupBy: 'warehouse',
        items: Array.from(grouped.values()).map((g) => ({
          ...g,
          totalValue: Math.round(g.totalValue * 100) / 100,
        })),
        totalItems: valuationItems.length,
        grandTotal: Math.round(
          Array.from(grouped.values()).reduce((sum, g) => sum + g.totalValue, 0) * 100,
        ) / 100,
      };
    }

    if (query.groupBy === 'category') {
      const grouped = new Map<
        string,
        {
          categoryId: string | null;
          categoryName: string | null;
          totalQuantity: number;
          totalValue: number;
          itemCount: number;
        }
      >();

      for (const item of filteredItems) {
        const key = item.categoryId ?? '__none__';
        const existing = grouped.get(key) ?? {
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          totalQuantity: 0,
          totalValue: 0,
          itemCount: 0,
        };
        existing.totalQuantity += item.quantity;
        existing.totalValue += item.totalValue;
        existing.itemCount++;
        grouped.set(key, existing);
      }

      return {
        groupBy: 'category',
        items: Array.from(grouped.values()).map((g) => ({
          ...g,
          totalValue: Math.round(g.totalValue * 100) / 100,
        })),
        totalItems: valuationItems.length,
        grandTotal: Math.round(
          Array.from(grouped.values()).reduce((sum, g) => sum + g.totalValue, 0) * 100,
        ) / 100,
      };
    }

    // Ungrouped - detail view
    return {
      items: filteredItems,
      totalItems: filteredItems.length,
      grandTotal: Math.round(
        filteredItems.reduce((sum, i) => sum + i.totalValue, 0) * 100,
      ) / 100,
    };
  }

  // ===========================================================================
  // 5. Inventory Summary
  // ===========================================================================

  async findSummary(query: QuerySummaryDto) {
    const { warehouseId, productId, groupBy } = query;

    if (groupBy === 'warehouse') {
      // Group by warehouse
      const warehouseSummaries = await this.prisma.inventoryBalance.groupBy({
        by: ['locationId'],
        where: {
          quantity: { gt: 0 },
          ...(productId ? { productId } : {}),
          ...(warehouseId ? { location: { warehouseId } } : {}),
        },
        _sum: { quantity: true },
        _count: { productId: true },
      });

      // Resolve warehouse info for each location summary
      const locationIds = warehouseSummaries.map((ws) => ws.locationId);
      const locations = await this.prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: {
          id: true,
          warehouse: { select: { id: true, code: true, name: true } },
        },
      });
      const locationMap = new Map(locations.map((l) => [l.id, l.warehouse]));

      // Aggregate by warehouse
      const warehouseAgg = new Map<
        string,
        {
          warehouseId: string;
          warehouseCode: string;
          warehouseName: string;
          totalQuantity: number;
          productCount: number;
        }
      >();

      for (const ws of warehouseSummaries) {
        const wh = locationMap.get(ws.locationId);
        if (!wh) continue;
        const key = wh.id;
        const existing = warehouseAgg.get(key) ?? {
          warehouseId: wh.id,
          warehouseCode: wh.code,
          warehouseName: wh.name,
          totalQuantity: 0,
          productCount: 0,
        };
        existing.totalQuantity += ws._sum.quantity ?? 0;
        existing.productCount += ws._count.productId;
        warehouseAgg.set(key, existing);
      }

      return {
        groupBy: 'warehouse',
        items: Array.from(warehouseAgg.values()).map((w) => ({
          ...w,
          totalQuantity: Math.round(w.totalQuantity * 100) / 100,
        })),
      };
    }

    // Default: group by product
    const productWhere: Prisma.InventoryBalanceWhereInput = {
      quantity: { gt: 0 },
    };
    if (warehouseId) {
      productWhere.location = { warehouseId };
    }
    if (productId) {
      productWhere.productId = productId;
    }

    const productSummaries = await this.prisma.inventoryBalance.groupBy({
      by: ['productId'],
      where: productWhere,
      _sum: { quantity: true },
      _count: { locationId: true },
    });

    // Resolve product info
    const prodIds = productSummaries.map((ps) => ps.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: prodIds } },
      select: { id: true, skuCode: true, name: true, unitOfMeasure: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items = productSummaries.map((ps) => {
      const prod = productMap.get(ps.productId);
      return {
        productId: ps.productId,
        skuCode: prod?.skuCode ?? null,
        productName: prod?.name ?? null,
        unitOfMeasure: prod?.unitOfMeasure ?? null,
        totalQuantity: Math.round((ps._sum.quantity ?? 0) * 100) / 100,
        locationCount: ps._count.locationId,
      };
    });

    return {
      groupBy: 'product',
      items,
    };
  }
}
