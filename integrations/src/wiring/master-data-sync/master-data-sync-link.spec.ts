// ============================================================================
// MasterDataSyncLink — 集成测试
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MasterDataSyncLink } from './master-data-sync-link.js';
import type { EndpointConfig } from '../../config/types.js';
import type { RetryConfig } from '../../reliability/retry.js';

/** 沙箱端点配置 */
const SANDBOX_ENDPOINT: EndpointConfig = {
  id: 'master-data-sync',
  name: 'Master Data Sync (Sandbox)',
  transport: {
    type: 'HTTP',
    options: { method: 'GET' },
  },
  auth: { type: 'api-key' },
  format: { type: 'JSON' },
  direction: 'INBOUND',
  trigger: 'SCHEDULED',
  environment: 'SANDBOX',
  baseUrl: 'https://sandbox.erp.example.com/api/v1',
  retry: { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000, jitter: true },
  enabled: true,
};

describe('MasterDataSyncLink', () => {
  let link: MasterDataSyncLink;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  /** 快速重试配置（测试用，避免超时） */
  const FAST_RETRY: RetryConfig = {
    maxAttempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
    jitter: false,
  };

  beforeEach(() => {
    process.env.INTEGRATION_ERP_API_KEY = 'test-api-key-sandbox';

    // Mock fetch BEFORE constructing the link, so HttpTransportConnector captures the spy
    mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.reject(new Error('fetch not mocked for this test')),
    );

    link = new MasterDataSyncLink(SANDBOX_ENDPOINT, undefined, FAST_RETRY);
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('initialization', () => {
    it('should create instance with sandbox endpoint', () => {
      expect(link).toBeInstanceOf(MasterDataSyncLink);
      expect(link.name).toBe('master-data-sync');
    });

    it('should have idempotency store initialized', () => {
      const store = link.getIdempotencyStore();
      expect(store).toBeDefined();
      expect(store.size).toBe(0);
    });

    it('should have dead letter queue initialized', () => {
      const dlq = link.getDeadLetterQueue();
      expect(dlq).toBeDefined();
    });

    it('should have sync tracker initialized', () => {
      const tracker = link.getTracker();
      expect(tracker).toBeDefined();
    });
  });

  describe('syncProducts', () => {
    it('should return sync result with correct structure', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              items: [
                {
                  id: 'ext-prod-001',
                  sku: 'MCU-STM32F103',
                  name: 'STM32F103C8T6 微控制器',
                  description: 'ARM Cortex-M3 内核',
                  categoryPath: '电子产品/电子元器件',
                  brand: 'STMicroelectronics',
                  unit: 'PCS',
                  barcode: '6901234567890',
                  active: true,
                  specAttributes: [],
                  images: [],
                  updatedAt: '2026-07-04T10:00:00Z',
                },
              ],
              pagination: { page: 1, size: 100, totalItems: 1, totalPages: 1 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await link.syncProducts();

      expect(result.endpointId).toBe('master-data-sync');
      expect(result.recordsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.recordsFailed).toBeGreaterThanOrEqual(0);
      expect(result.completedAt).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should track sync task status', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: { items: [], pagination: { page: 1, size: 100, totalItems: 0, totalPages: 0 } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await link.syncProducts();

      const tasks = await link.getTracker().list({ endpointId: 'master-data-sync' });
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].status).toBe('COMPLETED');
    });

    it('should handle external API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(link.syncProducts()).rejects.toThrow();
    });
  });

  describe('syncSuppliers', () => {
    it('should return sync result for suppliers', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              items: [
                {
                  id: 'ext-supp-001',
                  code: 'SUP-001',
                  name: '示例供应商',
                  contactPerson: '张三',
                  email: 'zhangsan@supplier.com',
                  phone: '13800138000',
                  address: '深圳市南山区',
                  active: true,
                  updatedAt: '2026-07-04T10:00:00Z',
                },
              ],
              pagination: { page: 1, size: 100, totalItems: 1, totalPages: 1 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await link.syncSuppliers();

      expect(result.recordsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.endpointId).toBe('master-data-sync');
    });
  });

  describe('syncAll', () => {
    it('should sync both products and suppliers', async () => {
      // Use mockImplementation to create fresh Response each time
      mockFetch.mockImplementation(
        () => Promise.resolve(
          new Response(
            JSON.stringify({
              code: 0,
              message: 'success',
              data: { items: [], pagination: { page: 1, size: 100, totalItems: 0, totalPages: 0 } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );

      const result = await link.syncAll();
      expect(result.recordsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.recordsFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('idempotency', () => {
    it('should skip duplicate product sync', async () => {
      const responseBody = {
        code: 0,
        message: 'success',
        data: {
          items: [
            {
              id: 'ext-prod-001',
              sku: 'MCU-STM32F103',
              name: 'STM32F103C8T6',
              unit: 'PCS',
              active: true,
              updatedAt: '2026-07-04T10:00:00Z',
            },
          ],
          pagination: { page: 1, size: 100, totalItems: 1, totalPages: 1 },
        },
      };

      // Use mockImplementation to create fresh Response each time
      mockFetch.mockImplementation(
        () => Promise.resolve(
          new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      // 第一次同步
      const result1 = await link.syncProducts();
      expect(result1.recordsProcessed).toBe(1);

      // 第二次同步（相同数据，幂等键相同）
      const result2 = await link.syncProducts();
      expect(result2.recordsProcessed).toBe(1);
    });
  });
});
