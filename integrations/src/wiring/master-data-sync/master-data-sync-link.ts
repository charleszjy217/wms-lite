// ============================================================================
// MasterDataSyncLink — 主数据入站同步链路
// ============================================================================
//
// 职责:
//   轮询外部 ERP 沙箱端点 → 字段映射 → 幂等去重 → 写入本地数据
//
// 依赖:
//   - HttpTransportConnector (HTTP 传输)
//   - ApiKeyAuthAdapter (API Key 认证)
//   - FieldMapper (字段映射)
//   - InMemoryIdempotencyStore (幂等去重)
//   - withRetry (指数退避重试)
//   - InMemoryDeadLetterQueue (死信队列)
//   - InMemorySyncTaskTracker (同步状态)
//
// 沙箱端点通过 INTEGRATION_MASTER_DATA_BASE_URL 配置
// ============================================================================

import { HttpTransportConnector } from '../../transports/http.js';
import { ApiKeyAuthAdapter } from '../../auth/api-key.js';
import { FieldMapper } from '../../mapping/field-mapper.js';
import { InMemoryIdempotencyStore } from '../../reliability/idempotency.js';
import { withRetry } from '../../reliability/retry.js';
import type { RetryConfig } from '../../reliability/retry.js';
import { InMemoryDeadLetterQueue } from '../../reliability/dead-letter.js';
import { InMemorySyncTaskTracker } from '../../sync/tracker.js';
import { EnvSecretStore } from '../../secrets/env-store.js';
import type { EndpointConfig } from '../../config/types.js';
import type {
  ExternalProduct,
  ExternalSupplier,
  PaginatedResponse,
  SyncResult,
} from './types.js';

/** 默认重试配置 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  jitter: true,
};

/** 默认幂等 TTL (24 小时) */
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 主数据同步链路
 *
 * 从外部 ERP 系统同步商品和供应商主数据到本地。
 * 所有端点 URL 通过配置/环境变量注入，指向沙箱。
 */
export class MasterDataSyncLink {
  readonly name = 'master-data-sync';

  private readonly transport: HttpTransportConnector;
  private readonly auth: ApiKeyAuthAdapter;
  private readonly mapper: FieldMapper;
  private readonly idempotency: InMemoryIdempotencyStore;
  private readonly deadLetter: InMemoryDeadLetterQueue;
  private readonly tracker: InMemorySyncTaskTracker;
  private readonly secrets: EnvSecretStore;
  private readonly endpoint: EndpointConfig;
  private readonly retryConfig: RetryConfig;

  constructor(
    endpoint: EndpointConfig,
    mapper?: FieldMapper,
    retryConfig?: RetryConfig,
  ) {
    this.endpoint = endpoint;
    this.transport = new HttpTransportConnector();
    this.secrets = new EnvSecretStore('INTEGRATION_');
    this.auth = new ApiKeyAuthAdapter(this.secrets, 'ERP_API_KEY');
    this.mapper = mapper ?? new FieldMapper();
    this.idempotency = new InMemoryIdempotencyStore();
    this.deadLetter = new InMemoryDeadLetterQueue();
    this.tracker = new InMemorySyncTaskTracker();
    this.retryConfig = retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  // ---- Public API ----

  /** 获取幂等存储 (测试/监控用) */
  getIdempotencyStore(): InMemoryIdempotencyStore {
    return this.idempotency;
  }

  /** 获取死信队列 (测试/监控用) */
  getDeadLetterQueue(): InMemoryDeadLetterQueue {
    return this.deadLetter;
  }

  /** 获取同步追踪器 (测试/监控用) */
  getTracker(): InMemorySyncTaskTracker {
    return this.tracker;
  }

  /**
   * 执行全量同步：商品 + 供应商
   */
  async syncAll(): Promise<SyncResult> {
    const productResult = await this.syncProducts();
    const supplierResult = await this.syncSuppliers();

    return {
      endpointId: this.endpoint.id,
      recordsProcessed: productResult.recordsProcessed + supplierResult.recordsProcessed,
      recordsFailed: productResult.recordsFailed + supplierResult.recordsFailed,
      errors: [...productResult.errors, ...supplierResult.errors],
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * 同步商品数据
   */
  async syncProducts(): Promise<SyncResult> {
    const task = await this.tracker.create({
      endpointId: this.endpoint.id,
      direction: 'INBOUND',
      status: 'RUNNING',
      idempotencyKey: `sync-products-${Date.now()}`,
    });

    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    try {
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const result = await this.fetchProducts(page);
        totalPages = result.data.pagination.totalPages;

        for (const extProduct of result.data.items) {
          try {
            await this.processProduct(extProduct);
            processed++;
          } catch (err) {
            failed++;
            const errorMsg = `Failed to process product ${extProduct.sku}: ${(err as Error).message}`;
            errors.push(errorMsg);

            // 推入死信队列
            await this.deadLetter.push({
              taskId: task.id,
              endpointId: this.endpoint.id,
              payload: extProduct,
              errorMessage: errorMsg,
              errorStack: (err as Error).stack,
              maxRetries: 3,
            });
          }
        }

        page++;
      }

      await this.tracker.update(task.id, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        recordsProcessed: processed,
        recordsFailed: failed,
      });
    } catch (err) {
      await this.tracker.update(task.id, {
        status: 'FAILED',
        error: (err as Error).message,
        completedAt: new Date().toISOString(),
        recordsProcessed: processed,
        recordsFailed: failed,
      });
      throw err;
    }

    return {
      endpointId: this.endpoint.id,
      recordsProcessed: processed,
      recordsFailed: failed,
      errors,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * 同步供应商数据
   */
  async syncSuppliers(): Promise<SyncResult> {
    const task = await this.tracker.create({
      endpointId: this.endpoint.id,
      direction: 'INBOUND',
      status: 'RUNNING',
      idempotencyKey: `sync-suppliers-${Date.now()}`,
    });

    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    try {
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const result = await this.fetchSuppliers(page);
        totalPages = result.data.pagination.totalPages;

        for (const extSupplier of result.data.items) {
          try {
            await this.processSupplier(extSupplier);
            processed++;
          } catch (err) {
            failed++;
            const errorMsg = `Failed to process supplier ${extSupplier.code}: ${(err as Error).message}`;
            errors.push(errorMsg);

            await this.deadLetter.push({
              taskId: task.id,
              endpointId: this.endpoint.id,
              payload: extSupplier,
              errorMessage: errorMsg,
              errorStack: (err as Error).stack,
              maxRetries: 3,
            });
          }
        }

        page++;
      }

      await this.tracker.update(task.id, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        recordsProcessed: processed,
        recordsFailed: failed,
      });
    } catch (err) {
      await this.tracker.update(task.id, {
        status: 'FAILED',
        error: (err as Error).message,
        completedAt: new Date().toISOString(),
        recordsProcessed: processed,
        recordsFailed: failed,
      });
      throw err;
    }

    return {
      endpointId: this.endpoint.id,
      recordsProcessed: processed,
      recordsFailed: failed,
      errors,
      completedAt: new Date().toISOString(),
    };
  }

  // ---- Private Helpers ----

  /**
   * 从外部 API 获取商品列表（带重试）
   */
  private async fetchProducts(page: number): Promise<PaginatedResponse<ExternalProduct>> {
    return withRetry(async () => {
      const url = `${this.endpoint.baseUrl}/products?page=${page}&size=100`;

      // 使用 API Key 认证适配器注入认证头
      const authedRequest = await this.auth.authenticate({
        url,
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      // 发送 HTTP 请求
      const response = await this.transport.send(
        {
          ...this.endpoint,
          baseUrl: url,
          transport: {
            ...this.endpoint.transport,
            options: {
              ...this.endpoint.transport.options,
              method: 'GET',
              headers: authedRequest.headers,
            },
          },
        },
        undefined,
      );

      if (response.status !== 200) {
        throw new Error(`External API returned status ${response.status}`);
      }

      return response.data as PaginatedResponse<ExternalProduct>;
    }, this.retryConfig);
  }

  /**
   * 从外部 API 获取供应商列表（带重试）
   */
  private async fetchSuppliers(page: number): Promise<PaginatedResponse<ExternalSupplier>> {
    return withRetry(async () => {
      const url = `${this.endpoint.baseUrl}/suppliers?page=${page}&size=100`;

      const authedRequest = await this.auth.authenticate({
        url,
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const response = await this.transport.send(
        {
          ...this.endpoint,
          baseUrl: url,
          transport: {
            ...this.endpoint.transport,
            options: {
              ...this.endpoint.transport.options,
              method: 'GET',
              headers: authedRequest.headers,
            },
          },
        },
        undefined,
      );

      if (response.status !== 200) {
        throw new Error(`External API returned status ${response.status}`);
      }

      return response.data as PaginatedResponse<ExternalSupplier>;
    }, DEFAULT_RETRY_CONFIG);
  }

  /**
   * 处理单条商品记录（映射 + 幂等去重）
   */
  private async processProduct(extProduct: ExternalProduct): Promise<void> {
    // 幂等键: 外部 ID + updatedAt 确保变更重复处理
    const idempotencyKey = `product:${extProduct.id}:${extProduct.updatedAt}`;

    // 检查是否已处理
    const existing = await this.idempotency.get(idempotencyKey);
    if (existing) {
      return; // 已处理过的幂等请求，跳过
    }

    // 标记处理中
    await this.idempotency.save(
      idempotencyKey,
      { result: null, status: 'IN_PROGRESS', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
      DEFAULT_IDEMPOTENCY_TTL_MS,
    );

    try {
      // 字段映射 (外部格式 → 规范格式)
      let canonicalProduct: Record<string, unknown>;

      if (this.mapper.hasMapping('ERP', 'Product')) {
        canonicalProduct = this.mapper.map('ERP', 'Product', extProduct as unknown as Record<string, unknown>);
      } else {
        // 无配置映射时使用默认映射
        canonicalProduct = {
          sourceSystem: 'ERP',
          sourceId: extProduct.id,
          sku: extProduct.sku,
          name: extProduct.name,
          description: extProduct.description,
          categoryPath: extProduct.categoryPath,
          brand: extProduct.brand,
          unit: extProduct.unit,
          barcode: extProduct.barcode,
          active: extProduct.active,
          specAttributes: extProduct.specAttributes,
          images: extProduct.images,
          sourceUpdatedAt: extProduct.updatedAt,
          lastSyncAt: new Date().toISOString(),
        };
      }

      // TODO: 实际写入本地 Product 表（Prisma）
      // await this.prisma.product.upsert({
      //   where: { skuCode: canonicalProduct.sku as string },
      //   create: { ... },
      //   update: { ... },
      // });

      // 标记完成
      await this.idempotency.save(
        idempotencyKey,
        { result: canonicalProduct, status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
        DEFAULT_IDEMPOTENCY_TTL_MS,
      );
    } catch (err) {
      // 标记失败
      await this.idempotency.save(
        idempotencyKey,
        { result: null, status: 'FAILED', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
        DEFAULT_IDEMPOTENCY_TTL_MS,
      );
      throw err;
    }
  }

  /**
   * 处理单条供应商记录
   */
  private async processSupplier(extSupplier: ExternalSupplier): Promise<void> {
    const idempotencyKey = `supplier:${extSupplier.id}:${extSupplier.updatedAt}`;

    const existing = await this.idempotency.get(idempotencyKey);
    if (existing) {
      return;
    }

    await this.idempotency.save(
      idempotencyKey,
      { result: null, status: 'IN_PROGRESS', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
      DEFAULT_IDEMPOTENCY_TTL_MS,
    );

    try {
      const canonicalSupplier = {
        sourceSystem: 'ERP',
        sourceId: extSupplier.id,
        code: extSupplier.code,
        name: extSupplier.name,
        contactPerson: extSupplier.contactPerson,
        email: extSupplier.email,
        phone: extSupplier.phone,
        address: extSupplier.address,
        active: extSupplier.active,
        sourceUpdatedAt: extSupplier.updatedAt,
        lastSyncAt: new Date().toISOString(),
      };

      // TODO: 实际写入本地 Supplier 表
      // await this.prisma.supplier.upsert({ ... });

      await this.idempotency.save(
        idempotencyKey,
        { result: canonicalSupplier, status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
        DEFAULT_IDEMPOTENCY_TTL_MS,
      );
    } catch (err) {
      await this.idempotency.save(
        idempotencyKey,
        { result: null, status: 'FAILED', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
        DEFAULT_IDEMPOTENCY_TTL_MS,
      );
      throw err;
    }
  }
}
