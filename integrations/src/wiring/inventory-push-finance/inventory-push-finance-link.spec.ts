// ============================================================================
// InventoryPushFinanceLink — 集成测试
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventoryPushFinanceLink } from './inventory-push-finance-link.js';
import type { EndpointConfig } from '../../config/types.js';
import type { RetryConfig } from '../../reliability/retry.js';
import type { StockMovementEvent } from './types.js';

/** 沙箱端点配置 */
const SANDBOX_ENDPOINT: EndpointConfig = {
  id: 'inventory-push-finance',
  name: 'Inventory Push to Finance (Sandbox)',
  transport: { type: 'HTTP', options: { method: 'POST' } },
  auth: { type: 'hmac' },
  format: { type: 'JSON' },
  direction: 'OUTBOUND',
  trigger: 'EVENT',
  environment: 'SANDBOX',
  baseUrl: 'https://sandbox.finance.example.com/api/v1',
  retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 15000, jitter: true },
  enabled: true,
};

/** 测试用库存变动事件 */
const createTestEvent = (overrides?: Partial<StockMovementEvent>): StockMovementEvent => ({
  movementId: 'mov-test-001',
  movementType: 'RECEIPT',
  productSku: 'MCU-STM32F103',
  productName: 'STM32F103C8T6 微控制器',
  batchNo: 'BATCH-2024-001',
  fromLocationCode: undefined,
  toLocationCode: 'WH-MAIN-A-01-A-1-01',
  quantity: 500,
  unit: 'PCS',
  unitPrice: 12.50,
  referenceType: 'PO',
  referenceNo: 'PO-2026-0001',
  operator: 'admin',
  occurredAt: '2026-07-04T10:30:00Z',
  ...overrides,
});

describe('InventoryPushFinanceLink', () => {
  let link: InventoryPushFinanceLink;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  /** 快速重试配置（测试用，避免超时） */
  const FAST_RETRY: RetryConfig = {
    maxAttempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
    jitter: false,
  };

  beforeEach(() => {
    process.env.INTEGRATION_FINANCE_HMAC_KEY = 'test-hmac-key-sandbox';

    // Mock fetch BEFORE constructing the link
    mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.reject(new Error('fetch not mocked for this test')),
    );

    link = new InventoryPushFinanceLink(SANDBOX_ENDPOINT, 'CNY', 'MOVING_AVERAGE', FAST_RETRY);
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('initialization', () => {
    it('should create instance with sandbox endpoint', () => {
      expect(link).toBeInstanceOf(InventoryPushFinanceLink);
      expect(link.name).toBe('inventory-push-finance');
    });

    it('should have idempotency store', () => {
      expect(link.getIdempotencyStore()).toBeDefined();
    });

    it('should have dead letter queue', () => {
      expect(link.getDeadLetterQueue()).toBeDefined();
    });

    it('should have sync tracker', () => {
      expect(link.getTracker()).toBeDefined();
    });
  });

  describe('handleStockMovement', () => {
    it('should successfully push a stock movement event', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'accepted',
            data: { receiptId: 'fin-rec-001', status: 'PROCESSED' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const event = createTestEvent();
      const result = await link.handleStockMovement(event);

      expect(result.success).toBe(true);
      expect(result.movementId).toBe('mov-test-001');
      expect(result.statusCode).toBe(200);
      expect(result.completedAt).toBeDefined();
    });

    it('should return push result with correct structure on failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const event = createTestEvent();
      const result = await link.handleStockMovement(event);

      expect(result.success).toBe(false);
      expect(result.movementId).toBe('mov-test-001');
      expect(result.error).toContain('Network error');
    });

    it('should track push task status', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'accepted',
            data: { receiptId: 'fin-rec-001', status: 'PROCESSED' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const event = createTestEvent();
      await link.handleStockMovement(event);

      const tasks = await link.getTracker().list({ endpointId: 'inventory-push-finance' });
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].status).toBe('COMPLETED');
    });

    it('should be idempotent for duplicate events', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 0,
              message: 'accepted',
              data: { receiptId: 'fin-rec-001', status: 'PROCESSED' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });

      const event = createTestEvent();

      // 第一次推送
      const result1 = await link.handleStockMovement(event);
      expect(result1.success).toBe(true);

      // 第二次推送（相同 event，幂等键相同）
      const result2 = await link.handleStockMovement(event);
      expect(result2.success).toBe(true);

      // 第一次调用了 API，第二次应跳过（幂等）
      expect(callCount).toBe(1);
    });

    it('should push to dead letter queue on failure', async () => {
      mockFetch.mockRejectedValue(new Error('Service unavailable'));

      const event = createTestEvent();
      await link.handleStockMovement(event);

      const dlq = link.getDeadLetterQueue();
      const records = await dlq.list({ endpointId: 'inventory-push-finance' });
      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].errorMessage).toContain('Service unavailable');
    });
  });

  describe('handleBatchStockMovements', () => {
    it('should handle multiple events', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 0,
              message: 'accepted',
              data: { receiptId: `fin-rec-${callCount}`, status: 'PROCESSED' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });

      const events = [
        createTestEvent({ movementId: 'mov-batch-001' }),
        createTestEvent({ movementId: 'mov-batch-002' }),
      ];

      const results = await link.handleBatchStockMovements(events);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].movementId).toBe('mov-batch-001');
      expect(results[1].movementId).toBe('mov-batch-002');
    });
  });
});
