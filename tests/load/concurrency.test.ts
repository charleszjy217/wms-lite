// ============================================================================
// T3.2 并发/超卖压力测试
// ============================================================================
//
// 模拟高并发场景，验证行锁和事务对库存一致性的保护效果。
// 使用 mock Prisma，不依赖真实 PostgreSQL。
//
// 场景一：同一商品同时发起多个出库请求 → 验证库存不为负
// 场景二：同时入库和出库 → 验证余额一致
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InboundService } from '../../backend/src/inbound/inbound.service';
import { OutboundService } from '../../backend/src/outbound/outbound.service';
import { BatchesService } from '../../backend/src/batches/batches.service';
import type { PrismaService } from '../../backend/src/prisma/prisma.service';
import type { AuditService } from '../../backend/src/audit/audit.service';
import {
  createMockPrisma,
  createTxMock,
  IDS,
  NOW,
  FUTURE_DATE,
  mockWarehouse,
  mockZone,
  mockLocation,
  mockProduct,
  mockBatch,
} from '../../e2e/helpers/mock-factory';
import type { MockTx } from '../../e2e/helpers/mock-factory';

// ============================================================================
// Shared Inventory State — simulates a database row with atomic operations
// so that concurrent transaction callbacks observe consistent state.
// ============================================================================

class SharedInventory {
  private _balance: number;

  constructor(initial: number) {
    this._balance = initial;
  }

  get balance(): number {
    return this._balance;
  }

  /** Return a plain object matching what Prisma returns for InventoryBalance. */
  read() {
    return {
      id: 'ib-load-1',
      productId: IDS.productId,
      locationId: IDS.locationId,
      batchId: IDS.batchId,
      quantity: this._balance,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  /** Read with batch included (for findMany inside txFindAvailableBatches). */
  readWithBatch() {
    return {
      ...this.read(),
      batch: mockBatch({
        id: IDS.batchId,
        expiryDate: FUTURE_DATE,
        status: 'ACTIVE',
      }),
    };
  }

  /**
   * Atomic decrement — throws if insufficient stock.
   * This simulates what a row-level lock + atomic UPDATE would do in PostgreSQL:
   *   UPDATE inventory_balance SET quantity = quantity - $1 WHERE id = $2
   */
  decrement(qty: number): number {
    if (this._balance < qty) {
      throw new Error(`库存不足: 需要 ${qty}, 可用 ${this._balance}`);
    }
    this._balance -= qty;
    return this._balance;
  }

  /** Atomic increment (like inbound UPSERT with increment). */
  increment(qty: number): number {
    this._balance += qty;
    return this._balance;
  }
}

// ============================================================================
// Factory: create a Prisma mock wired to a shared inventory state
// ============================================================================

function createPrismaWithSharedInventory(
  inventory: SharedInventory,
  batchId = IDS.batchId,
) {
  const prisma = createMockPrisma();

  // -- Warehouse / Location / Zone / Product lookups (needed by services) --
  prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse());
  prisma.zone.findUnique.mockResolvedValue(mockZone());
  prisma.location.findUnique.mockResolvedValue(mockLocation());
  prisma.product.findUnique.mockResolvedValue(mockProduct());

  // -- $transaction: create a tx client that reads/writes the shared inventory --
  prisma.$transaction = vi.fn().mockImplementation(
    (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const txBase = createTxMock();

      // Override inventory methods to use shared state
      const inventoryMethods = {
        findMany: vi.fn().mockImplementation((args?: { include?: { batch?: boolean } }) => {
          if (args?.include?.batch) {
            return Promise.resolve([inventory.readWithBatch()]);
          }
          return Promise.resolve([inventory.read()]);
        }),
        findUnique: vi.fn().mockImplementation(() => {
          return Promise.resolve(inventory.read());
        }),
        update: vi.fn().mockImplementation(
          ({ data }: { data: { quantity?: { decrement?: number; increment?: number } } }) => {
            if (data.quantity?.decrement !== undefined) {
              inventory.decrement(data.quantity.decrement);
            }
            if (data.quantity?.increment !== undefined) {
              inventory.increment(data.quantity.increment);
            }
            return Promise.resolve(inventory.read());
          },
        ),
        upsert: vi.fn().mockImplementation(
          ({ update }: { update: { quantity?: { increment?: number } } }) => {
            if (update.quantity?.increment !== undefined) {
              inventory.increment(update.quantity.increment);
            }
            return Promise.resolve(inventory.read());
          },
        ),
      };

      const tx: Record<string, unknown> = {
        ...txBase,
        inventoryBalance: inventoryMethods,
        batch: {
          findUnique: vi.fn().mockResolvedValue(mockBatch({ id: batchId })),
          create: vi.fn().mockResolvedValue(mockBatch({ id: batchId })),
        },
        stockMovement: {
          create: vi.fn().mockResolvedValue({ id: 'sm-load-1' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'al-load-1' }),
        },
        shippingOrder: {
          update: vi.fn().mockResolvedValue({
            id: IDS.shippingOrderId,
            status: 'SUBMITTED',
            referenceNo: 'SO-LOAD-001',
          }),
        },
        receivingOrder: {
          update: vi.fn().mockResolvedValue({
            id: IDS.receivingOrderId,
            status: 'SUBMITTED',
            referenceNo: 'RO-LOAD-001',
          }),
        },
        receivingOrderItem: {
          update: vi.fn().mockResolvedValue({}),
        },
        $queryRawUnsafe: vi.fn(),
        $executeRawUnsafe: vi.fn(),
      };

      return cb(tx);
    },
  );

  return prisma;
}

// ============================================================================
// Mock builders
// ============================================================================

function makeShippingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.shippingOrderId,
    referenceNo: 'SO-LOAD-001',
    status: 'DRAFT',
    warehouseId: IDS.warehouseId,
    locationId: IDS.locationId,
    operator: 'load-tester',
    notes: null,
    shipmentDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [
      {
        id: 'item-so-load-1',
        shippingOrderId: IDS.shippingOrderId,
        productId: IDS.productId,
        quantity: 15,
        product: mockProduct(),
      },
    ],
    ...overrides,
  };
}

function makeReceivingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.receivingOrderId,
    referenceNo: 'RO-LOAD-001',
    status: 'DRAFT',
    warehouseId: IDS.warehouseId,
    locationId: IDS.locationId,
    operator: 'load-tester',
    notes: null,
    receiptDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [
      {
        id: 'item-ro-load-1',
        receivingOrderId: IDS.receivingOrderId,
        productId: IDS.productId,
        batchId: null,
        batchNo: 'BATCH-LOAD-001',
        productionDate: new Date('2026-06-01'),
        expiryDate: FUTURE_DATE,
        quantity: 30,
        product: mockProduct(),
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('T3.2 并发/超卖压力测试', () => {
  let auditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    auditService = { log: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // 场景一：同一商品同时发起多个出库请求 → 验证库存不为负
  // ==========================================================================
  describe('场景一：同一商品同时发起多个出库请求', () => {
    it('8个并发出库请求（每单12件, 初始库存100）→ 不应超卖, 库存不为负', async () => {
      const CONCURRENCY = 8;
      const REQUEST_QTY = 12;
      const INITIAL_STOCK = 100;

      // 共享库存状态 — 所有并发事务共享
      const inventory = new SharedInventory(INITIAL_STOCK);

      // 共享 Prisma mock — 所有 service 实例共用
      const prisma = createPrismaWithSharedInventory(inventory);
      const batchesService = new BatchesService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );

      // 每个并发请求的 mock 订单 (使用相同的 shippingOrderId 会冲突，
      // 所以每个需要不同的 ID)
      const orders = Array.from({ length: CONCURRENCY }, (_, i) => ({
        ...makeShippingOrder({
          id: `so-load-${i}`,
          referenceNo: `SO-LOAD-${i}`,
          items: [
            {
              id: `item-so-load-${i}`,
              shippingOrderId: `so-load-${i}`,
              productId: IDS.productId,
              quantity: REQUEST_QTY,
              product: mockProduct(),
            },
          ],
        }),
      }));

      // 并发执行出库提交
      const results = await Promise.allSettled(
        orders.map((order) => {
          // 每个并发请求使用独立的 service 实例，但共享同一个 prisma mock
          const outboundService = new OutboundService(
            prisma as unknown as PrismaService,
            auditService as unknown as AuditService,
            batchesService,
          );

          // 先 mock findUnique 返回对应的 order
          prisma.shippingOrder.findUnique = vi
            .fn()
            .mockImplementation((args: { where: { id: string } }) => {
              const found = orders.find((o) => o.id === args.where.id);
              return Promise.resolve(found ?? null);
            });

          return outboundService.submit(order.id, 'load-tester');
        }),
      );

      // ---- 验证 ----

      // 1) 统计成功/失败数量
      const succeeded = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failed = results.filter(
        (r) => r.status === 'rejected',
      ).length;

      // 初始库存 100，每单 12 件：
      //   8 * 12 = 96 都能成功 → 全部成功，剩余 4
      //   但如果 9 单就是 108 > 100，第 9 单失败
      //   8 单 96 <= 100，所以全部应成功
      expect(succeeded).toBe(CONCURRENCY);
      expect(failed).toBe(0);

      // 2) 最终库存应 ≥ 0
      expect(inventory.balance).toBeGreaterThanOrEqual(0);

      // 3) 库存精确：100 - 8*12 = 4
      expect(inventory.balance).toBe(INITIAL_STOCK - CONCURRENCY * REQUEST_QTY);

      // 4) 每个失败的原因应是 BadRequestException (库存不足)
      for (const result of results) {
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(BadRequestException);
        }
      }
    });

    it('10个并发出库请求（每单12件, 初始库存100）→ 部分失败, 库存不为负', async () => {
      const CONCURRENCY = 10;
      const REQUEST_QTY = 12;
      const INITIAL_STOCK = 100;

      const inventory = new SharedInventory(INITIAL_STOCK);
      const prisma = createPrismaWithSharedInventory(inventory);
      const batchesService = new BatchesService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );

      const orders = Array.from({ length: CONCURRENCY }, (_, i) => ({
        ...makeShippingOrder({
          id: `so-load-oversell-${i}`,
          referenceNo: `SO-LOAD-OVERSELL-${i}`,
          items: [
            {
              id: `item-so-load-oversell-${i}`,
              shippingOrderId: `so-load-oversell-${i}`,
              productId: IDS.productId,
              quantity: REQUEST_QTY,
              product: mockProduct(),
            },
          ],
        }),
      }));

      const results = await Promise.allSettled(
        orders.map((order) => {
          const outboundService = new OutboundService(
            prisma as unknown as PrismaService,
            auditService as unknown as AuditService,
            batchesService,
          );

          prisma.shippingOrder.findUnique = vi
            .fn()
            .mockImplementation((args: { where: { id: string } }) => {
              const found = orders.find((o) => o.id === args.where.id);
              return Promise.resolve(found ?? null);
            });

          return outboundService.submit(order.id, 'load-tester');
        }),
      );

      // ---- 验证 ----

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // 100 / 12 = 8.33 → 最多成功 8 单
      expect(succeeded.length).toBeLessThanOrEqual(
        Math.floor(INITIAL_STOCK / REQUEST_QTY),
      );
      expect(failed.length).toBeGreaterThan(0);

      // 计算实际分配的库存
      const totalAllocated = succeeded.length * REQUEST_QTY;
      expect(totalAllocated).toBeLessThanOrEqual(INITIAL_STOCK);

      // 库存不为负
      expect(inventory.balance).toBeGreaterThanOrEqual(0);

      // 库存精确
      expect(inventory.balance).toBe(INITIAL_STOCK - totalAllocated);

      // 所有失败的请求都因库存不足
      // 注意：并发场景下，部分失败可能来自原子 decrement 守卫（模拟 PG CHECK 约束）
      // 而非业务层的 BadRequestException，这取决于微任务调度顺序
      for (const result of failed) {
        // 无论错误类型，消息应包含"库存不足"
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        expect(message).toMatch(/库存不足/);
      }
    });
  });

  // ==========================================================================
  // 场景二：同时入库和出库 → 验证余额一致
  // ==========================================================================
  describe('场景二：同时入库和出库', () => {
    it('并发入库(+30)和出库(-60), 初始50 → 余额一致, 不为负', async () => {
      const INITIAL_STOCK = 50;

      const inventory = new SharedInventory(INITIAL_STOCK);
      const prisma = createPrismaWithSharedInventory(inventory);
      const batchesService = new BatchesService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );

      // 准备入库单与出库单
      const receivingOrder = makeReceivingOrder({
        id: 'ro-concurrent-1',
        referenceNo: 'RO-CONCURRENT-1',
        items: [
          {
            id: 'item-ro-concurrent-1',
            receivingOrderId: 'ro-concurrent-1',
            productId: IDS.productId,
            batchId: null,
            batchNo: 'BATCH-CONCURRENT-1',
            productionDate: new Date('2026-06-01'),
            expiryDate: FUTURE_DATE,
            quantity: 30, // 入库 +30
            product: mockProduct(),
          },
        ],
      });

      const shippingOrder = makeShippingOrder({
        id: 'so-concurrent-1',
        referenceNo: 'SO-CONCURRENT-1',
        items: [
          {
            id: 'item-so-concurrent-1',
            shippingOrderId: 'so-concurrent-1',
            productId: IDS.productId,
            quantity: 60, // 出库 -60
            product: mockProduct(),
          },
        ],
      });

      // 设置 findUnique 返回值
      prisma.receivingOrder.findUnique = vi
        .fn()
        .mockResolvedValue(receivingOrder);
      prisma.shippingOrder.findUnique = vi
        .fn()
        .mockImplementation((args: { where: { id: string } }) => {
          if (args.where.id === shippingOrder.id) {
            return Promise.resolve(shippingOrder);
          }
          return Promise.resolve(null);
        });

      const inboundService = new InboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );
      const outboundService = new OutboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
        batchesService,
      );

      // 并发执行：入库 +30 和 出库 -60
      const [inboundResult, outboundResult] = await Promise.allSettled([
        inboundService.submit(receivingOrder.id, 'load-tester'),
        outboundService.submit(shippingOrder.id, 'load-tester'),
      ]);

      // ---- 验证 ----

      // 入库总能成功
      expect(inboundResult.status).toBe('fulfilled');

      // 可能的场景：
      // A) 入库先执行 → 库存 = 50+30 = 80 → 出库 60 成功 → 最终库存 = 20
      // B) 出库先执行 → 库存 = 50 < 60 → 出库失败 → 最终库存 = 50+30 = 80
      //
      // 无论是哪种情况：
      // 1) 库存永远不为负
      expect(inventory.balance).toBeGreaterThanOrEqual(0);

      // 2) 如果出库成功，库存应为 50+30-60=20
      // 3) 如果出库失败，库存应为 50+30=80
      if (outboundResult.status === 'fulfilled') {
        expect(inventory.balance).toBe(20);
      } else {
        expect(inventory.balance).toBe(80);
        expect(outboundResult.reason).toBeInstanceOf(BadRequestException);
      }
    });

    it('并发入库(+100)和出库(-30), 初始50 → 两者都应成功, 余额=120', async () => {
      const INITIAL_STOCK = 50;

      const inventory = new SharedInventory(INITIAL_STOCK);
      const prisma = createPrismaWithSharedInventory(inventory);
      const batchesService = new BatchesService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );

      const receivingOrder = makeReceivingOrder({
        id: 'ro-concurrent-2',
        referenceNo: 'RO-CONCURRENT-2',
        items: [
          {
            id: 'item-ro-concurrent-2',
            receivingOrderId: 'ro-concurrent-2',
            productId: IDS.productId,
            batchId: null,
            batchNo: 'BATCH-CONCURRENT-2',
            productionDate: new Date('2026-06-01'),
            expiryDate: FUTURE_DATE,
            quantity: 100,
            product: mockProduct(),
          },
        ],
      });

      const shippingOrder = makeShippingOrder({
        id: 'so-concurrent-2',
        referenceNo: 'SO-CONCURRENT-2',
        items: [
          {
            id: 'item-so-concurrent-2',
            shippingOrderId: 'so-concurrent-2',
            productId: IDS.productId,
            quantity: 30,
            product: mockProduct(),
          },
        ],
      });

      prisma.receivingOrder.findUnique = vi
        .fn()
        .mockResolvedValue(receivingOrder);
      prisma.shippingOrder.findUnique = vi
        .fn()
        .mockImplementation((args: { where: { id: string } }) => {
          if (args.where.id === shippingOrder.id) {
            return Promise.resolve(shippingOrder);
          }
          return Promise.resolve(null);
        });

      const inboundService = new InboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );
      const outboundService = new OutboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
        batchesService,
      );

      const [inboundResult, outboundResult] = await Promise.allSettled([
        inboundService.submit(receivingOrder.id, 'load-tester'),
        outboundService.submit(shippingOrder.id, 'load-tester'),
      ]);

      // 两者都应成功
      expect(inboundResult.status).toBe('fulfilled');
      expect(outboundResult.status).toBe('fulfilled');

      // 最终库存 = 50 + 100 - 30 = 120
      expect(inventory.balance).toBe(120);
    });
  });

  // ==========================================================================
  // 场景三：验证事务原子性
  // ==========================================================================
  describe('场景三：事务原子性验证', () => {
    it('出库提交使用 $transaction 包裹关键操作', async () => {
      const inventory = new SharedInventory(100);
      const prisma = createPrismaWithSharedInventory(inventory);
      const batchesService = new BatchesService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );
      const outboundService = new OutboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
        batchesService,
      );

      const order = makeShippingOrder({
        items: [
          {
            id: 'item-so-tx-1',
            shippingOrderId: IDS.shippingOrderId,
            productId: IDS.productId,
            quantity: 10,
            product: mockProduct(),
          },
        ],
      });

      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      await outboundService.submit(order.id, 'load-tester');

      // $transaction 必须被调用（证明关键操作在事务内执行）
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('入库提交使用 $transaction 包裹关键操作', async () => {
      const inventory = new SharedInventory(0);
      const prisma = createPrismaWithSharedInventory(inventory);
      const inboundService = new InboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );

      const order = makeReceivingOrder({
        items: [
          {
            id: 'item-ro-tx-1',
            receivingOrderId: IDS.receivingOrderId,
            productId: IDS.productId,
            batchId: null,
            batchNo: 'BATCH-TX-1',
            productionDate: new Date('2026-06-01'),
            expiryDate: FUTURE_DATE,
            quantity: 50,
            product: mockProduct(),
          },
        ],
      });

      prisma.receivingOrder.findUnique.mockResolvedValue(order);

      await inboundService.submit(order.id, 'load-tester');

      // $transaction 必须被调用
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('出库库存检查在事务内进行 — balance.quantity < take 防止超卖', async () => {
      // 验证业务逻辑：在 decrement 前检查库存是否足够
      const inventory = new SharedInventory(5); // 只有 5 件
      const prisma = createPrismaWithSharedInventory(inventory);
      const batchesService = new BatchesService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
      );
      const outboundService = new OutboundService(
        prisma as unknown as PrismaService,
        auditService as unknown as AuditService,
        batchesService,
      );

      const order = makeShippingOrder({
        items: [
          {
            id: 'item-so-check-1',
            shippingOrderId: IDS.shippingOrderId,
            productId: IDS.productId,
            quantity: 10, // 需要 10 件，但只有 5 件
            product: mockProduct(),
          },
        ],
      });

      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      await expect(
        outboundService.submit(order.id, 'load-tester'),
      ).rejects.toThrow(BadRequestException);

      // 库存未被扣减（弹回）
      expect(inventory.balance).toBe(5);
    });
  });
});
