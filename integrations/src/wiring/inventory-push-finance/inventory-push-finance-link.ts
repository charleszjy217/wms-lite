// ============================================================================
// InventoryPushFinanceLink — 库存/价值变动出站推送至财务链路
// ============================================================================
//
// 职责:
//   监听库存变动事件 → 组装 payload (含估值) → 推送至财务系统沙箱
//
// 依赖:
//   - HttpTransportConnector (HTTP 传输)
//   - HmacAuthAdapter (HMAC 签名认证)
//   - InMemoryIdempotencyStore (幂等去重)
//   - withRetry (指数退避重试)
//   - InMemoryDeadLetterQueue (死信队列)
//   - InMemorySyncTaskTracker (推送状态)
//
// 沙箱端点通过 INTEGRATION_FINANCE_BASE_URL 配置
// ============================================================================

import { HttpTransportConnector } from '../../transports/http.js';
import { HmacAuthAdapter } from '../../auth/hmac.js';
import { InMemoryIdempotencyStore } from '../../reliability/idempotency.js';
import { withRetry } from '../../reliability/retry.js';
import type { RetryConfig } from '../../reliability/retry.js';
import { InMemoryDeadLetterQueue } from '../../reliability/dead-letter.js';
import { InMemorySyncTaskTracker } from '../../sync/tracker.js';
import { EnvSecretStore } from '../../secrets/env-store.js';
import type { EndpointConfig } from '../../config/types.js';
import type {
  InventoryPushPayload,
  StockMovementEvent,
  PushResult,
  FinanceApiResponse,
} from './types.js';

/** 默认重试配置 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  jitter: true,
};

/** 默认幂等 TTL (1 小时) */
const DEFAULT_IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;

/** 默认货币 */
const DEFAULT_CURRENCY = 'CNY';

/** 默认估值方法 */
const DEFAULT_VALUATION_METHOD = 'MOVING_AVERAGE';

/**
 * 库存推送财务链路
 *
 * 监听库存变动事件，组装包含估值的 payload，推送至财务系统沙箱端点。
 * 所有端点 URL 通过配置/环境变量注入，指向沙箱。
 */
export class InventoryPushFinanceLink {
  readonly name = 'inventory-push-finance';

  private readonly transport: HttpTransportConnector;
  private readonly auth: HmacAuthAdapter;
  private readonly idempotency: InMemoryIdempotencyStore;
  private readonly deadLetter: InMemoryDeadLetterQueue;
  private readonly tracker: InMemorySyncTaskTracker;
  private readonly secrets: EnvSecretStore;
  private readonly endpoint: EndpointConfig;
  private readonly currency: string;
  private readonly valuationMethod: string;
  private readonly retryConfig: RetryConfig;

  constructor(
    endpoint: EndpointConfig,
    currency?: string,
    valuationMethod?: string,
    retryConfig?: RetryConfig,
  ) {
    this.endpoint = endpoint;
    this.transport = new HttpTransportConnector();
    this.secrets = new EnvSecretStore('INTEGRATION_');
    this.auth = new HmacAuthAdapter(this.secrets, 'FINANCE_HMAC_KEY', {
      algorithm: 'sha256',
      headerName: 'X-Hmac-Signature',
    });
    this.idempotency = new InMemoryIdempotencyStore();
    this.deadLetter = new InMemoryDeadLetterQueue();
    this.tracker = new InMemorySyncTaskTracker();
    this.currency = currency ?? DEFAULT_CURRENCY;
    this.valuationMethod = valuationMethod ?? DEFAULT_VALUATION_METHOD;
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
   * 处理库存变动事件
   *
   * @param event 库存变动事件数据
   * @returns 推送结果
   */
  async handleStockMovement(event: StockMovementEvent): Promise<PushResult> {
    // 幂等键: 使用 movementId 确保财务系统不会重复记账
    const idempotencyKey = `movement:${event.movementId}`;

    // 检查是否已处理
    const existing = await this.idempotency.get(idempotencyKey);
    if (existing) {
      return {
        endpointId: this.endpoint.id,
        movementId: event.movementId,
        success: true,
        statusCode: 200,
        completedAt: new Date().toISOString(),
      };
    }

    // 创建追踪任务
    const task = await this.tracker.create({
      endpointId: this.endpoint.id,
      direction: 'OUTBOUND',
      status: 'RUNNING',
      idempotencyKey,
      metadata: { movementId: event.movementId },
    });

    // 标记幂等处理中
    await this.idempotency.save(
      idempotencyKey,
      { result: null, status: 'IN_PROGRESS', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
      DEFAULT_IDEMPOTENCY_TTL_MS,
    );

    try {
      // 组装 payload
      const payload = this.assemblePayload(event);

      // 推送至财务系统（带重试）
      const response = await this.pushToFinance(payload, idempotencyKey);

      // 标记幂等完成
      await this.idempotency.save(
        idempotencyKey,
        { result: response, status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
        DEFAULT_IDEMPOTENCY_TTL_MS,
      );

      // 更新追踪状态
      await this.tracker.update(task.id, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        recordsProcessed: 1,
        recordsFailed: 0,
      });

      return {
        endpointId: this.endpoint.id,
        movementId: event.movementId,
        success: true,
        statusCode: response.status,
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = `Failed to push movement ${event.movementId} to finance: ${(err as Error).message}`;

      // 标记幂等失败
      await this.idempotency.save(
        idempotencyKey,
        { result: null, status: 'FAILED', createdAt: new Date().toISOString(), expiresAt: Date.now() + DEFAULT_IDEMPOTENCY_TTL_MS },
        DEFAULT_IDEMPOTENCY_TTL_MS,
      );

      // 更新追踪状态
      await this.tracker.update(task.id, {
        status: 'FAILED',
        error: errorMsg,
        completedAt: new Date().toISOString(),
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      // 推入死信队列
      await this.deadLetter.push({
        taskId: task.id,
        endpointId: this.endpoint.id,
        payload: event,
        errorMessage: errorMsg,
        errorStack: (err as Error).stack,
        maxRetries: 3,
      });

      return {
        endpointId: this.endpoint.id,
        movementId: event.movementId,
        success: false,
        error: errorMsg,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 批量处理库存变动事件
   *
   * @param events 库存变动事件列表
   * @returns 推送结果列表
   */
  async handleBatchStockMovements(events: StockMovementEvent[]): Promise<PushResult[]> {
    return Promise.all(events.map((event) => this.handleStockMovement(event)));
  }

  // ---- Private Helpers ----

  /**
   * 组装推送 payload（含估值计算）
   */
  private assemblePayload(event: StockMovementEvent): InventoryPushPayload {
    const totalValue = parseFloat((event.quantity * event.unitPrice).toFixed(2));

    return {
      eventType: 'stock_movement.created',
      occurredAt: event.occurredAt,
      movement: {
        movementId: event.movementId,
        movementType: event.movementType,
        productSku: event.productSku,
        productName: event.productName,
        batchNo: event.batchNo,
        fromLocationCode: event.fromLocationCode,
        toLocationCode: event.toLocationCode,
        quantity: event.quantity,
        unit: event.unit,
        unitPrice: event.unitPrice,
        referenceType: event.referenceType,
        referenceNo: event.referenceNo,
        operator: event.operator,
      },
      valuation: {
        totalValue,
        currency: this.currency,
        valuationMethod: this.valuationMethod,
      },
    };
  }

  /**
   * 推送至财务系统（带指数退避重试）
   *
   * @returns TransportResponse (包含 status 和 data)
   */
  private async pushToFinance(
    payload: InventoryPushPayload,
    idempotencyKey: string,
  ): Promise<{ status: number; data: FinanceApiResponse }> {
    return withRetry(
      async () => {
        const url = `${this.endpoint.baseUrl}/inventory-valuation`;

        // 序列化 payload 为 JSON 字符串 (用于 HMAC 签名)
        const body = JSON.stringify(payload);

        // 使用 HMAC 认证适配器签名
        const authedRequest = await this.auth.authenticate({
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            'X-Event-Id': `evt-${payload.movement.movementId}`,
            'X-Source-System': 'wms-lite',
          },
          body,
        });

        // 发送 HTTP 请求
        const transportResponse = await this.transport.send(
          {
            ...this.endpoint,
            baseUrl: url,
            transport: {
              ...this.endpoint.transport,
              options: {
                ...this.endpoint.transport.options,
                method: 'POST',
                headers: authedRequest.headers,
              },
            },
          },
          payload,
        );

        if (transportResponse.status < 200 || transportResponse.status >= 300) {
          throw new Error(
            `Finance API returned status ${transportResponse.status}: ${JSON.stringify(transportResponse.data)}`,
          );
        }

        return {
          status: transportResponse.status,
          data: transportResponse.data as FinanceApiResponse,
        };
      },
      this.retryConfig,
      {
        shouldRetry: (error, attempt) => {
          // 4xx 错误不重试（客户端错误无需重试）
          if (error.message.includes('status 4')) {
            return false;
          }
          return attempt < DEFAULT_RETRY_CONFIG.maxAttempts;
        },
      },
    );
  }
}
