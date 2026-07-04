// ============================================================================
// Connector 统一接口
// ============================================================================

import type { EndpointConfig } from '../config/types.js';

// Re-export for transport adapter implementations
export type { EndpointConfig } from '../config/types.js';

// ---- Transport (传输连接器) ----

export type TransportType = 'HTTP' | 'SFTP' | 'DATABASE' | 'QUEUE' | 'CUSTOM';

export interface TransportResponse {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ReceiveOptions {
  timeout?: number;
  maxRetries?: number;
}

/**
 * 传输连接器 — 负责与外部系统的通信协议
 * 每个传输协议适配器实现此接口
 */
export interface TransportConnector {
  /** 协议唯一标识, 如 'http', 'sftp', 'amqp' */
  readonly name: string;

  /** 传输协议类型 */
  readonly type: TransportType;

  /** 初始化 (生命周期: 应用启动时调用) */
  initialize?(config: Record<string, unknown>): Promise<void>;

  /** 销毁 (生命周期: 应用关闭时调用) */
  destroy?(): Promise<void>;

  /** 出站: 发送数据到外部系统 */
  send?(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse>;

  /** 入站: 从外部系统接收数据 */
  receive?(endpoint: EndpointConfig, options?: ReceiveOptions): Promise<TransportResponse>;

  /** 连通性测试 */
  testConnection?(endpoint: EndpointConfig): Promise<boolean>;
}

// ---- Auth (认证连接器) ----

export type AuthType = 'API_KEY' | 'OAUTH2' | 'BASIC' | 'JWT' | 'CERTIFICATE' | 'CUSTOM';

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType?: string;
  scope?: string[];
}

/**
 * 认证连接器 — 负责与外部系统的认证握手
 */
export interface AuthConnector {
  /** 认证类型标识, 如 'api-key', 'oauth2' */
  readonly name: string;

  /** 认证类型 */
  readonly type: AuthType;

  /** 认证获取凭证 */
  authenticate(credentials: Record<string, unknown>): Promise<AuthResult>;

  /** 刷新凭证 (可选) */
  refresh?(token: string): Promise<AuthResult>;

  /** 校验凭证是否有效 (可选) */
  validate?(token: string): Promise<boolean>;
}

// ---- Format (格式解析器) ----

export type FormatType = 'JSON' | 'XML' | 'CSV' | 'EDIFACT' | 'PROTOBUF' | 'FLAT_FILE' | 'CUSTOM';

export interface ParseOptions {
  schema?: unknown;
  encoding?: string;
  [key: string]: unknown;
}

export interface SerializeOptions {
  pretty?: boolean;
  encoding?: string;
  [key: string]: unknown;
}

/**
 * 格式解析器 — 负责数据的序列化/反序列化
 */
export interface FormatParser {
  /** 解析器唯一标识, 如 'json', 'xml', 'csv' */
  readonly name: string;

  /** 数据格式类型 */
  readonly format: FormatType;

  /** 反序列化: 将原始数据解析为结构化对象 */
  parse<T = unknown>(data: string | Buffer, options?: ParseOptions): Promise<T>;

  /** 序列化: 将结构化对象转换为原始数据 */
  serialize<T = unknown>(data: T, options?: SerializeOptions): Promise<string | Buffer>;

  /** 数据校验 (可选) */
  validate?(data: unknown): boolean;

  /** 获取 MIME 类型 */
  getMimeType(): string;
}
