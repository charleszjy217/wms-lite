// ============================================================================
// EndpointConfig 类型定义
// ============================================================================

/** 同步方向 */
export type SyncDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';

/** 触发方式 */
export type TriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT' | 'WEBHOOK';

/** 运行环境 */
export type Environment = 'PRODUCTION' | 'STAGING' | 'SANDBOX' | 'DEVELOPMENT';

/** 重试配置 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

/** 熔断器配置 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxRequests: number;
}

/** 端点认证配置 */
export interface AuthConfig {
  type: string;
  credentials?: Record<string, string>;
}

/** 端点传输配置 */
export interface TransportConfig {
  type: string;
  options?: Record<string, unknown>;
}

/** 端点格式配置 */
export interface FormatConfig {
  type: string;
  options?: Record<string, unknown>;
}

/**
 * 集成端点配置
 * 描述一个完整的外部系统集成端点的所有配置信息
 */
export interface EndpointConfig {
  /** 端点唯一标识 */
  id: string;

  /** 端点名称 */
  name: string;

  /** 端点描述 */
  description?: string;

  /** 传输协议配置 */
  transport: TransportConfig;

  /** 认证配置 */
  auth: AuthConfig;

  /** 数据格式配置 */
  format: FormatConfig;

  /** 同步方向 */
  direction: SyncDirection;

  /** 触发方式 */
  trigger: TriggerType;

  /** 运行环境 (默认沙箱) */
  environment: Environment;

  /** 基础 URL */
  baseUrl?: string;

  /** 请求超时 (ms) */
  timeout?: number;

  /** 重试策略 */
  retry?: RetryConfig;

  /** 熔断器配置 */
  circuitBreaker?: CircuitBreakerConfig;

  /** Cron 表达式 (仅 SCHEDULED 触发) */
  schedule?: string;

  /** Webhook 路径 (仅 WEBHOOK 触发) */
  webhookPath?: string;

  /** 是否启用 */
  enabled: boolean;

  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}
