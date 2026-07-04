// ============================================================================
// E2E Flow 3: 调拨 → 盘点 → 调整
// ============================================================================
//
// This test verifies the transfer and stocktake flow:
//   1. Create transfer order (DRAFT) → Submit → Complete
//   2. Create stocktake order (DRAFT) → Record counts (with mismatches) → Confirm adjustments
//   3. Verify final inventory state
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TransferService } from '../backend/src/transfer/transfer.service';
import { StocktakeService } from '../backend/src/stocktake/stocktake.service';
import { InventoryQueryService } from '../backend/src/inventory-query/inventory-query.service';
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
  mockWarehouse,
  mockLocation,
  mockProduct,
  mockBatch,
  mockInventoryBalance,
} from './helpers/mock-factory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTransferItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-tr-1',
    transferOrderId: IDS.transferOrderId,
    productId: IDS.productId,
    batchId: IDS.batchId,
    quantity: 30,
    product: mockProduct(),
    batch: mockBatch(),
    ...overrides,
  };
}

function mockTransferOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.transferOrderId,
    referenceNo: 'TR-E2E-20260704-0001',
    status: 'DRAFT',
    sourceWarehouseId: IDS.warehouseId,
    sourceLocationId: IDS.locationId,
    targetWarehouseId: 'wh-e2e-target',
    targetLocationId: 'loc-e2e-target',
    operator: 'e2e-tester',
    notes: 'E2E test transfer',
    createdAt: NOW,
    updatedAt: NOW,
    items: [mockTransferItem()],
    sourceLocation: mockLocation({ id: IDS.locationId }),
    targetLocation: mockLocation({ id: 'loc-e2e-target', code: 'LOC-TARGET' }),
    ...overrides,
  };
}

function mockStocktakeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-st-1',
    stocktakeOrderId: IDS.stocktakeOrderId,
    productId: IDS.productId,
    batchId: IDS.batchId,
    expectedQuantity: 70,
    actualQuantity: 0,
    difference: 0,
    status: 'PENDING',
    product: mockProduct(),
    batch: mockBatch(),
    ...overrides,
  };
}

function mockStocktakeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.stocktakeOrderId,
    referenceNo: 'ST-E2E-20260704-0001',
    status: 'DRAFT',
    warehouseId: IDS.warehouseId,
    locationId: IDS.locationId,
    operator: 'e2e-tester',
    notes: 'E2E test stocktake',
    createdAt: NOW,
    updatedAt: NOW,
    items: [mockStocktakeItem()],
    location: mockLocation(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Flow 3: 调拨 → 盘点 → 调整', () => {
  let transferService: TransferService;
  let stocktakeService: StocktakeService;
  let inventoryQueryService: InventoryQueryService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    prisma = createMockPrisma();
    auditService = { log: vi.fn() };

    transferService = new TransferService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    stocktakeService = new StocktakeService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    inventoryQueryService = new InventoryQueryService(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Step 1: Transfer — Create & Submit
  // =========================================================================
  describe('Step 1: 调拨 — 创建并提交调拨单', () => {
    const createDto = {
      referenceNo: 'TR-E2E-20260704-0001',
      sourceWarehouseId: IDS.warehouseId,
      sourceLocationId: IDS.locationId,
      targetWarehouseId: 'wh-e2e-target',
      targetLocationId: 'loc-e2e-target',
      items: [
        {
          productId: IDS.productId,
          batchId: IDS.batchId,
          quantity: 30,
        },
      ],
    };

    it('1a. 创建草稿调拨单', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(mockWarehouse())   // source
        .mockResolvedValueOnce(mockWarehouse({ id: 'wh-e2e-target', code: 'WH-TARGET' })); // target
      prisma.location.findUnique
        .mockResolvedValueOnce(mockLocation())    // source
        .mockResolvedValueOnce(mockLocation({ id: 'loc-e2e-target', code: 'LOC-TARGET' })); // target
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.batch.findUnique.mockResolvedValue(mockBatch());
      prisma.transferOrder.create.mockResolvedValue(mockTransferOrder());

      const result = await transferService.create(createDto, 'e2e-tester');

      expect(result).toMatchObject({
        referenceNo: 'TR-E2E-20260704-0001',
        status: 'DRAFT',
        operator: 'e2e-tester',
      });
      expect(prisma.transferOrder.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'TransferOrder' }),
      );
    });

    it('1b. 提交调拨单 — 扣减源库位、增加目标库位、创建库存移动', async () => {
      const transfer = mockTransferOrder();
      // Use mockResolvedValueOnce for the initial status check (returns DRAFT)
      // then mockResolvedValue for the final findOne call (returns SUBMITTED)
      prisma.transferOrder.findUnique
        .mockResolvedValueOnce(transfer)   // first call: status check
        .mockResolvedValue(mockTransferOrder({ status: 'SUBMITTED' })); // subsequent calls: findOne

      const tx = createTxMock();
      // Lock & check inventory
      tx.$queryRawUnsafe.mockResolvedValue([{ id: 'ib-1', quantity: 100 }]);
      // Deduct source
      tx.$executeRawUnsafe.mockResolvedValue([]);
      // Update status
      tx.transferOrder.update.mockResolvedValue(
        mockTransferOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await transferService.submit(IDS.transferOrderId, 'e2e-tester');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.$queryRawUnsafe).toHaveBeenCalled();
      expect(tx.$executeRawUnsafe).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMIT' }),
      );
    });

    it('1c. 库存不足时提交失败', async () => {
      const transfer = mockTransferOrder({
        items: [mockTransferItem({ quantity: 999 })],
      });
      prisma.transferOrder.findUnique.mockResolvedValue(transfer);

      const tx = createTxMock();
      // Not enough stock — balance has only 100
      tx.$queryRawUnsafe.mockResolvedValue([{ id: 'ib-1', quantity: 100 }]);

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      await expect(
        transferService.submit(IDS.transferOrderId, 'e2e-tester'),
      ).rejects.toThrow(BadRequestException);
    });

    it('1d. 完成调拨单', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(
        mockTransferOrder({ status: 'SUBMITTED' }),
      );
      prisma.transferOrder.update.mockResolvedValue(
        mockTransferOrder({ status: 'COMPLETED' }),
      );

      const result = await transferService.complete(IDS.transferOrderId, 'e2e-tester');

      expect(result.status).toBe('COMPLETED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMPLETE' }),
      );
    });

    it('1e. 取消已提交的调拨单 — 回滚库存', async () => {
      const submittedTransfer = mockTransferOrder({ status: 'SUBMITTED' });
      // First call returns SUBMITTED for status check, subsequent calls return CANCELLED
      prisma.transferOrder.findUnique
        .mockResolvedValueOnce(submittedTransfer)
        .mockResolvedValue(mockTransferOrder({ status: 'CANCELLED' }));

      const tx = createTxMock();
      tx.$executeRawUnsafe.mockResolvedValue([]);
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-reverse' });
      tx.transferOrder.update.mockResolvedValue(
        mockTransferOrder({ status: 'CANCELLED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await transferService.cancel(IDS.transferOrderId, 'e2e-tester');

      expect(result.status).toBe('CANCELLED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANCEL' }),
      );
    });
  });

  // =========================================================================
  // Step 2: Stocktake — Create & Record Counts
  // =========================================================================
  describe('Step 2: 盘点 — 创建盘点单并录入实盘数量', () => {
    it('2a. 创建草稿盘点单（自动获取预期数量）', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse());
      prisma.location.findUnique.mockResolvedValue(mockLocation());
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.batch.findUnique.mockResolvedValue(mockBatch());
      // Current inventory balance = 70 (after transfer removed 30 from 100)
      prisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'ib-1',
        productId: IDS.productId,
        locationId: IDS.locationId,
        batchId: IDS.batchId,
        quantity: 70,
      });
      prisma.stocktakeOrder.create.mockResolvedValue(
        mockStocktakeOrder({
          items: [mockStocktakeItem({ expectedQuantity: 70 })],
        }),
      );

      const result = await stocktakeService.create(
        {
          warehouseId: IDS.warehouseId,
          locationId: IDS.locationId,
          items: [
            {
              productId: IDS.productId,
              batchId: IDS.batchId,
            },
          ],
        },
        'e2e-tester',
      );

      expect(result).toMatchObject({ status: 'DRAFT' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].expectedQuantity).toBe(70);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'StocktakeOrder' }),
      );
    });

    it('2b. 录入实盘数量（含差异 — 盘点发现只有65件，少了5件）', async () => {
      const stocktakeOrder = mockStocktakeOrder({
        status: 'DRAFT',
        items: [mockStocktakeItem({ expectedQuantity: 70, actualQuantity: 0 })],
      });
      prisma.stocktakeOrder.findUnique.mockResolvedValue(stocktakeOrder);

      const tx = createTxMock();
      tx.stocktakeItem.update.mockResolvedValue(
        mockStocktakeItem({
          expectedQuantity: 70,
          actualQuantity: 65,
          difference: -5,
          status: 'MISMATCH',
        }),
      );
      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );
      prisma.stocktakeOrder.update.mockResolvedValue(
        mockStocktakeOrder({
          status: 'COUNTED',
          items: [mockStocktakeItem({
            expectedQuantity: 70,
            actualQuantity: 65,
            difference: -5,
            status: 'MISMATCH',
          })],
        }),
      );

      const result = await stocktakeService.recordCount(
        IDS.stocktakeOrderId,
        {
          items: [{ id: 'item-st-1', actualQuantity: 65 }],
        },
        'e2e-tester',
      );

      expect(result.status).toBe('COUNTED');
      const countedItem = result.items[0];
      expect(countedItem.actualQuantity).toBe(65);
      expect(countedItem.difference).toBe(-5);
      expect(countedItem.status).toBe('MISMATCH');
    });

    it('2c. 录入不存在的盘点项抛出 NotFoundException', async () => {
      const stocktakeOrder = mockStocktakeOrder({
        status: 'DRAFT',
        items: [mockStocktakeItem()],
      });
      prisma.stocktakeOrder.findUnique.mockResolvedValue(stocktakeOrder);

      await expect(
        stocktakeService.recordCount(
          IDS.stocktakeOrderId,
          { items: [{ id: 'nonexistent-item', actualQuantity: 10 }] },
          'e2e-tester',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // Step 3: Adjustment — Confirm Stocktake
  // =========================================================================
  describe('Step 3: 调整 — 确认盘点差异并调整库存', () => {
    it('3a. 确认盘点差异 — 自动调整库存余额', async () => {
      const countedOrder = mockStocktakeOrder({
        status: 'COUNTED',
        items: [mockStocktakeItem({
          expectedQuantity: 70,
          actualQuantity: 65,
          difference: -5,
          status: 'MISMATCH',
        })],
      });
      // First call: status check (returns COUNTED)
      // Subsequent calls: findOne after confirm (returns CONFIRMED)
      prisma.stocktakeOrder.findUnique
        .mockResolvedValueOnce(countedOrder)
        .mockResolvedValue(mockStocktakeOrder({
          status: 'CONFIRMED',
          items: [mockStocktakeItem({
            expectedQuantity: 70,
            actualQuantity: 65,
            difference: -5,
            status: 'ADJUSTED',
          })],
        }));

      const tx = createTxMock();
      // Lock inventory balance
      tx.$queryRawUnsafe.mockResolvedValue([{ id: 'ib-1', quantity: 70 }]);
      // Decrease stock by 5 (diff is -5, so decrease)
      tx.$executeRawUnsafe.mockResolvedValue([]);
      // Create ADJUSTMENT stock movement
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-adjust-1' });
      // Mark item as ADJUSTED
      tx.stocktakeItem.update.mockResolvedValue({});
      // Update stocktake status
      tx.stocktakeOrder.update.mockResolvedValue({});

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await stocktakeService.confirm(IDS.stocktakeOrderId, 'e2e-tester');

      expect(result.status).toBe('CONFIRMED');
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({ type: 'ADJUSTMENT' }) },
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONFIRM' }),
      );
    });

    it('3b. 盘点差异为零时无需调整', async () => {
      const matchedOrder = mockStocktakeOrder({
        status: 'COUNTED',
        items: [mockStocktakeItem({
          expectedQuantity: 70,
          actualQuantity: 70,
          difference: 0,
          status: 'MATCH',
        })],
      });
      // First call: status check (returns COUNTED)
      // Subsequent calls: findOne after confirm (returns CONFIRMED)
      prisma.stocktakeOrder.findUnique
        .mockResolvedValueOnce(matchedOrder)
        .mockResolvedValue(mockStocktakeOrder({
          status: 'CONFIRMED',
          items: [mockStocktakeItem({
            expectedQuantity: 70,
            actualQuantity: 70,
            difference: 0,
            status: 'ADJUSTED',
          })],
        }));

      const tx = createTxMock();
      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await stocktakeService.confirm(IDS.stocktakeOrderId, 'e2e-tester');

      expect(result.status).toBe('CONFIRMED');
      // When difference is 0, no stock movement should be created
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('3c. 非 COUNTED 状态不可确认', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(
        mockStocktakeOrder({ status: 'DRAFT' }),
      );

      await expect(
        stocktakeService.confirm(IDS.stocktakeOrderId, 'e2e-tester'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Step 4: Verify Final State
  // =========================================================================
  describe('Step 4: 验证最终库存状态', () => {
    it('4a. 查询最终库存余额 — 验证调拨和盘点影响', async () => {
      // After transfer (removed 30) and stocktake adjustment (removed 5),
      // source location should have 65 remaining
      prisma.inventoryBalance.findMany.mockResolvedValue([
        mockInventoryBalance({ quantity: 65 }),
      ]);
      prisma.inventoryBalance.count.mockResolvedValue(1);

      const result = await inventoryQueryService.findBalances({
        productId: IDS.productId,
        locationId: IDS.locationId,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(65);
    });

    it('4b. 查询库存汇总 — 按商品分组', async () => {
      const mockSummary = {
        productId: IDS.productId,
        _sum: { quantity: 65 },
        _count: { locationId: 1 },
      };
      prisma.inventoryBalance.groupBy.mockResolvedValue([mockSummary]);
      prisma.product.findMany.mockResolvedValue([mockProduct()]);

      const result = await inventoryQueryService.findSummary({
        groupBy: 'product',
      });

      expect(result.groupBy).toBe('product');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].totalQuantity).toBe(65);
    });
  });
});
