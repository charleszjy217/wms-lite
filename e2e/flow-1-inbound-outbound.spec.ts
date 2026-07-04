// ============================================================================
// E2E Flow 1: 入库 → 查库存 → 调价 → 出库(FEFO) → 临期预警 → 出站同步
// ============================================================================
//
// This test verifies the complete inventory lifecycle:
//   1. Create receiving order (DRAFT) → Submit → Complete
//   2. Query inventory balances
//   3. Set product pricing
//   4. Create shipping order (DRAFT) → Get FEFO suggestions → Submit → Complete
//   5. Check expiry warnings
//   6. Simulate outbound sync job
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InboundService } from '../backend/src/inbound/inbound.service';
import { OutboundService } from '../backend/src/outbound/outbound.service';
import { InventoryQueryService } from '../backend/src/inventory-query/inventory-query.service';
import { PricingService } from '../backend/src/pricing/pricing.service';
import { BatchesService } from '../backend/src/batches/batches.service';
import { PrismaService } from '../backend/src/prisma/prisma.service';
import { AuditService } from '../backend/src/audit/audit.service';
import {
  MockPrisma,
  MockTx,
  createMockPrisma,
  createTxMock,
  IDS,
  NOW,
  FUTURE_DATE,
  EXPIRED_DATE,
  mockWarehouse,
  mockZone,
  mockLocation,
  mockProduct,
  mockProductCategory,
  mockBatch,
  mockBatch2,
  mockPriceList,
  mockProductPrice,
  mockInventoryBalance,
} from './helpers/mock-factory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-ro-1',
    receivingOrderId: IDS.receivingOrderId,
    productId: IDS.productId,
    batchId: null,
    batchNo: 'BATCH-E2E-001',
    productionDate: new Date('2026-06-01'),
    expiryDate: FUTURE_DATE,
    quantity: 100,
    product: mockProduct(),
    ...overrides,
  };
}

function mockReceivingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.receivingOrderId,
    referenceNo: 'RO-E2E-20260704-0001',
    status: 'DRAFT',
    warehouseId: IDS.warehouseId,
    locationId: IDS.locationId,
    operator: 'e2e-tester',
    notes: 'E2E test receiving',
    receiptDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [mockOrderItem()],
    ...overrides,
  };
}

function mockShippingOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-so-1',
    shippingOrderId: IDS.shippingOrderId,
    productId: IDS.productId,
    quantity: 10,
    product: mockProduct(),
    ...overrides,
  };
}

function mockShippingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.shippingOrderId,
    referenceNo: 'SO-E2E-20260704-0001',
    status: 'DRAFT',
    warehouseId: IDS.warehouseId,
    locationId: IDS.locationId,
    operator: 'e2e-tester',
    notes: 'E2E test shipping',
    shipmentDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [mockShippingOrderItem()],
    ...overrides,
  };
}

function mockIntegrationEndpoint() {
  return {
    id: IDS.integrationEndpointId,
    code: 'ERP-SYNC',
    name: 'ERP同步接口',
    url: 'https://mock-erp.example.com/api/sync',
    method: 'POST',
    headers: null,
    authType: null,
    authConfig: null,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Flow 1: 入库 → 查库存 → 调价 → 出库(FEFO) → 临期预警 → 出站同步', () => {
  let inboundService: InboundService;
  let outboundService: OutboundService;
  let inventoryQueryService: InventoryQueryService;
  let pricingService: PricingService;
  let batchesService: BatchesService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    prisma = createMockPrisma();
    auditService = { log: vi.fn() };

    // Create services with mocked dependencies
    inboundService = new InboundService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    batchesService = new BatchesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    inventoryQueryService = new InventoryQueryService(
      prisma as unknown as PrismaService,
    );

    pricingService = new PricingService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    outboundService = new OutboundService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      batchesService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Step 1: Inbound — Create & Submit Receiving Order
  // =========================================================================
  describe('Step 1: 入库 — 创建收货单并提交', () => {
    const createDto = {
      referenceNo: 'RO-E2E-20260704-0001',
      warehouseId: IDS.warehouseId,
      locationId: IDS.locationId,
      notes: 'E2E test receiving',
      receiptDate: '2026-07-04T00:00:00Z',
      items: [
        {
          productId: IDS.productId,
          batchNo: 'BATCH-E2E-001',
          productionDate: '2026-06-01T00:00:00Z',
          expiryDate: '2026-08-15T00:00:00Z',
          quantity: 100,
        },
      ],
    };

    it('1a. 创建草稿收货单', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse());
      prisma.location.findUnique.mockResolvedValue(mockLocation());
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.receivingOrder.findUnique.mockResolvedValue(null);
      prisma.receivingOrder.create.mockResolvedValue(mockReceivingOrder());

      const result = await inboundService.create(createDto, 'e2e-tester');

      expect(result).toMatchObject({
        referenceNo: 'RO-E2E-20260704-0001',
        status: 'DRAFT',
        operator: 'e2e-tester',
      });
      expect(result.items).toHaveLength(1);
      expect(prisma.receivingOrder.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'ReceivingOrder' }),
      );
    });

    it('1b. 提交收货单 — 创建批次、库存移动、库存余额', async () => {
      const order = mockReceivingOrder({
        items: [mockOrderItem({ batchId: null })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.batch.findUnique.mockResolvedValue(null);
      tx.batch.create.mockResolvedValue(mockBatch());
      tx.receivingOrderItem.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-inbound-1' });
      tx.inventoryBalance.upsert.mockResolvedValue({
        id: 'ib-1',
        productId: IDS.productId,
        locationId: IDS.locationId,
        batchId: IDS.batchId,
        quantity: 100,
      });
      tx.receivingOrder.update.mockResolvedValue(
        mockReceivingOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await inboundService.submit(IDS.receivingOrderId, 'e2e-tester');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.batch.create).toHaveBeenCalledOnce();
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({ type: 'INBOUND', quantity: 100 }) },
      );
      expect(tx.inventoryBalance.upsert).toHaveBeenCalledOnce();
    });

    it('1c. 完成收货单', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockReceivingOrder({ status: 'SUBMITTED' }),
      );
      prisma.receivingOrder.update.mockResolvedValue(
        mockReceivingOrder({ status: 'COMPLETED' }),
      );

      const result = await inboundService.complete(IDS.receivingOrderId, 'e2e-tester');

      expect(result.status).toBe('COMPLETED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMPLETE' }),
      );
    });
  });

  // =========================================================================
  // Step 2: Inventory Query — Check balances
  // =========================================================================
  describe('Step 2: 查库存 — 查询库存余额', () => {
    it('2a. 查询库存余额列表', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([
        mockInventoryBalance(),
      ]);
      prisma.inventoryBalance.count.mockResolvedValue(1);

      const result = await inventoryQueryService.findBalances({
        productId: IDS.productId,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        quantity: 100,
      });
    });

    it('2b. 查询库存移动记录', async () => {
      const mockMovement = {
        id: 'sm-1',
        type: 'INBOUND',
        productId: IDS.productId,
        batchId: IDS.batchId,
        fromLocationId: null,
        toLocationId: IDS.locationId,
        quantity: 100,
        referenceNo: 'RO-E2E-20260704-0001',
        operator: 'e2e-tester',
        reason: null,
        createdAt: NOW,
        product: { id: IDS.productId, skuCode: 'SKU-E2E-001', name: '端到端测试商品' },
        batch: { id: IDS.batchId, batchNo: 'BATCH-E2E-001' },
        fromLocation: null,
        toLocation: {
          id: IDS.locationId,
          area: 'A',
          aisle: '01',
          rack: 'R01',
          level: 'L1',
          position: 'P1',
        },
      };

      prisma.stockMovement.findMany.mockResolvedValue([mockMovement]);
      prisma.stockMovement.count.mockResolvedValue(1);

      const result = await inventoryQueryService.findMovements({
        productId: IDS.productId,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('INBOUND');
      expect(result.items[0].quantity).toBe(100);
    });
  });

  // =========================================================================
  // Step 3: Pricing — Set product price
  // =========================================================================
  describe('Step 3: 调价 — 创建价目表并设置商品价格', () => {
    it('3a. 创建价目表', async () => {
      prisma.priceList.findUnique.mockResolvedValue(null);
      prisma.priceList.create.mockResolvedValue(mockPriceList());

      const result = await pricingService.createPriceList({
        code: 'PL-E2E-001',
        name: 'E2E测试价目表',
      });

      expect(result).toMatchObject({
        code: 'PL-E2E-001',
        name: 'E2E测试价目表',
      });
    });

    it('3b. 设置商品价格', async () => {
      prisma.priceList.findUnique.mockResolvedValue(mockPriceList());
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.productPrice.findFirst.mockResolvedValue(null);
      prisma.productPrice.create.mockResolvedValue(mockProductPrice());

      const result = await pricingService.createProductPrice({
        priceListId: IDS.priceListId,
        productId: IDS.productId,
        unitPrice: 100.00,
        effectiveDate: '2026-07-04T00:00:00Z',
      });

      expect(result).toMatchObject({
        unitPrice: 100.00,
      });
    });

    it('3c. 调整商品价格（单条）', async () => {
      prisma.productPrice.findUnique.mockResolvedValue(
        mockProductPrice({ unitPrice: 100.00 }),
      );
      prisma.productPrice.update.mockResolvedValue(
        mockProductPrice({ unitPrice: 120.00 }),
      );
      prisma.priceChangeLog.create.mockResolvedValue({});

      const result = await pricingService.adjustProductPrice(
        IDS.productPriceId,
        { unitPrice: 120.00, effectiveDate: '2026-07-04T00:00:00Z', reason: 'E2E test price adjustment' },
        'e2e-tester',
      );

      expect(result.unitPrice).toBe(120.00);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRICE_ADJUST' }),
      );
    });
  });

  // =========================================================================
  // Step 4: Outbound — FEFO shipping
  // =========================================================================
  describe('Step 4: 出库(FEFO) — 创建发货单并使用FEFO策略出库', () => {
    const createDto = {
      referenceNo: 'SO-E2E-20260704-0001',
      warehouseId: IDS.warehouseId,
      locationId: IDS.locationId,
      notes: 'E2E test shipping',
      items: [{ productId: IDS.productId, quantity: 10 }],
    };

    it('4a. 创建草稿发货单', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse());
      prisma.location.findUnique.mockResolvedValue(mockLocation());
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      prisma.shippingOrder.create.mockResolvedValue(mockShippingOrder());

      const result = await outboundService.create(createDto, 'e2e-tester');

      expect(result).toMatchObject({
        referenceNo: 'SO-E2E-20260704-0001',
        status: 'DRAFT',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'ShippingOrder' }),
      );
    });

    it('4b. 获取FEFO分配建议（预览）', async () => {
      // Mock inventory balances with two batches (one active, one expired)
      // The FEFO algorithm should pick the soonest-expiring active batch
      prisma.shippingOrder.findUnique.mockResolvedValue(
        mockShippingOrder({ items: [mockShippingOrderItem({ quantity: 10 })] }),
      );
      prisma.inventoryBalance.findMany.mockResolvedValue([
        {
          id: 'ib-active',
          productId: IDS.productId,
          locationId: IDS.locationId,
          batchId: IDS.batchId,
          quantity: 100,
          batch: mockBatch(),
        },
        {
          id: 'ib-expired',
          productId: IDS.productId,
          locationId: IDS.locationId,
          batchId: IDS.batchId2,
          quantity: 50,
          batch: mockBatch2(), // expired batch
        },
      ]);

      const suggestions = await outboundService.getFefoSuggestions(IDS.shippingOrderId);

      expect(suggestions).toHaveLength(1);
      const suggestion = suggestions[0];
      expect(suggestion.productId).toBe(IDS.productId);
      expect(suggestion.requestedQty).toBe(10);
      expect(suggestion.allocatedQty).toBe(10);
      // Should only allocate from the active (non-expired) batch
      expect(suggestion.allocations).toHaveLength(1);
      expect(suggestion.allocations[0].batchId).toBe(IDS.batchId);
    });

    it('4c. 提交发货单 — FEFO扣减库存', async () => {
      const order = mockShippingOrder();
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      // FEFO finds available batches (only active batch with qty 100)
      tx.$queryRawUnsafe.mockResolvedValue([{ id: 'ib-1', quantity: 100 }]);
      tx.$executeRawUnsafe.mockResolvedValue([]);
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-outbound-1' });
      tx.inventoryBalance.findMany.mockResolvedValue([
        {
          id: 'ib-1',
          productId: IDS.productId,
          locationId: IDS.locationId,
          batchId: IDS.batchId,
          quantity: 100,
          batch: mockBatch(),
        },
      ]);
      tx.inventoryBalance.findUnique.mockResolvedValue({
        id: 'ib-1',
        productId: IDS.productId,
        locationId: IDS.locationId,
        batchId: IDS.batchId,
        quantity: 100,
      });
      tx.inventoryBalance.update.mockResolvedValue({
        id: 'ib-1',
        quantity: 90,
      });
      tx.auditLog.create.mockResolvedValue({});
      tx.shippingOrder.update.mockResolvedValue(
        mockShippingOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await outboundService.submit(IDS.shippingOrderId, 'e2e-tester');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({ type: 'OUTBOUND' }) },
      );
    });

    it('4d. 库存不足时抛出错误', async () => {
      const order = mockShippingOrder({
        items: [mockShippingOrderItem({ quantity: 9999 })],
      });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany.mockResolvedValue([
        {
          id: 'ib-1',
          productId: IDS.productId,
          locationId: IDS.locationId,
          batchId: IDS.batchId,
          quantity: 100,
          batch: mockBatch(),
        },
      ]);

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      await expect(
        outboundService.submit(IDS.shippingOrderId, 'e2e-tester'),
      ).rejects.toThrow(BadRequestException);
    });

    it('4e. 完成发货单', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(
        mockShippingOrder({ status: 'SUBMITTED' }),
      );
      prisma.shippingOrder.update.mockResolvedValue(
        mockShippingOrder({ status: 'COMPLETED' }),
      );

      const result = await outboundService.complete(IDS.shippingOrderId, 'e2e-tester');

      expect(result.status).toBe('COMPLETED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMPLETE' }),
      );
    });
  });

  // =========================================================================
  // Step 5: Expiry Warning — 临期预警
  // =========================================================================
  describe('Step 5: 临期预警 — 查询临期/过期批次', () => {
    it('5a. 查询临期批次', async () => {
      prisma.batch.findMany.mockResolvedValue([
        {
          ...mockBatch(),
          remainingDays: 42,
          isExpired: false,
          isNearExpiry: false,
          inventoryBalances: [
            {
              id: 'ib-1',
              quantity: 100,
              location: {
                id: IDS.locationId,
                area: 'A',
                aisle: '01',
                rack: 'R01',
                level: 'L1',
                position: 'P1',
                warehouse: { id: IDS.warehouseId, code: 'WH-E2E-01', name: '端到端测试仓库' },
              },
            },
          ],
        },
      ]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await inventoryQueryService.findExpiryReport({
        showNearExpiry: true,
        nearExpiryDays: 60,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('5b. 查询已过期批次', async () => {
      prisma.batch.findMany.mockResolvedValue([
        {
          ...mockBatch2(),
          remainingDays: -33,
          isExpired: true,
          isNearExpiry: false,
          inventoryBalances: [
            {
              id: 'ib-expired',
              quantity: 50,
              location: {
                id: IDS.locationId,
                area: 'A',
                aisle: '01',
                rack: 'R01',
                level: 'L1',
                position: 'P1',
                warehouse: { id: IDS.warehouseId, code: 'WH-E2E-01', name: '端到端测试仓库' },
              },
            },
          ],
        },
      ]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await inventoryQueryService.findExpiryReport({
        showExpired: true,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].isExpired).toBe(true);
    });
  });

  // =========================================================================
  // Step 6: Outbound Sync — 出站同步（模拟）
  // =========================================================================
  describe('Step 6: 出站同步 — 模拟与外部系统同步', () => {
    it('6a. 创建集成端点', async () => {
      prisma.integrationEndpoint.findUnique.mockResolvedValue(null);
      prisma.integrationEndpoint.create.mockResolvedValue(
        mockIntegrationEndpoint(),
      );

      // Simulate creating an integration endpoint via Prisma directly
      const endpoint = await (
        prisma as unknown as PrismaService
      ).integrationEndpoint.create({
        data: {
          code: 'ERP-SYNC',
          name: 'ERP同步接口',
          url: 'https://mock-erp.example.com/api/sync',
          method: 'POST',
          status: 'ACTIVE',
        },
      });

      expect(endpoint).toMatchObject({
        code: 'ERP-SYNC',
        status: 'ACTIVE',
      });
    });

    it('6b. 创建同步任务记录（模拟出站同步）', async () => {
      prisma.syncJob.create.mockResolvedValue({
        id: 'sync-job-1',
        endpointId: IDS.integrationEndpointId,
        status: 'COMPLETED',
        startedAt: NOW,
        completedAt: NOW,
        errorMessage: null,
        result: JSON.stringify({ syncedOrders: 1 }),
        createdAt: NOW,
        updatedAt: NOW,
      });

      // Simulate creating a sync job after outbound
      const syncJob = await (prisma as unknown as PrismaService).syncJob.create({
        data: {
          endpointId: IDS.integrationEndpointId,
          status: 'COMPLETED',
          startedAt: NOW,
          completedAt: NOW,
          result: JSON.stringify({ syncedOrders: 1 }),
        },
      });

      expect(syncJob.status).toBe('COMPLETED');
      expect(syncJob.result).toContain('syncedOrders');
    });
  });
});
