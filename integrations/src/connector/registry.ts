// ============================================================================
// ConnectorRegistry — 插件注册/获取机制
// ============================================================================

import type { TransportConnector } from './interfaces.js';
import type { AuthConnector } from './interfaces.js';
import type { FormatParser } from './interfaces.js';

/**
 * 全局 Connector 注册表
 *
 * 采用策略模式: 新增协议 = 实现接口 + registry.register()
 * 职责: 管理传输/认证/格式三类插件的注册与获取
 */
export class ConnectorRegistry {
  private readonly transports = new Map<string, TransportConnector>();
  private readonly auths = new Map<string, AuthConnector>();
  private readonly formats = new Map<string, FormatParser>();

  // ---- Transport ----

  /** 注册传输连接器 */
  registerTransport(connector: TransportConnector): void {
    const key = connector.name;
    if (this.transports.has(key)) {
      throw new Error(`Transport connector '${key}' is already registered`);
    }
    this.transports.set(key, connector);
  }

  /** 获取传输连接器 */
  getTransport(name: string): TransportConnector {
    const conn = this.transports.get(name);
    if (!conn) {
      throw new Error(`No transport connector registered for '${name}'`);
    }
    return conn;
  }

  /** 列出所有已注册的传输连接器名称 */
  listTransports(): string[] {
    return Array.from(this.transports.keys());
  }

  /** 判断传输连接器是否已注册 */
  hasTransport(name: string): boolean {
    return this.transports.has(name);
  }

  /** 移除传输连接器 */
  unregisterTransport(name: string): boolean {
    return this.transports.delete(name);
  }

  // ---- Auth ----

  /** 注册认证连接器 */
  registerAuth(connector: AuthConnector): void {
    const key = connector.name;
    if (this.auths.has(key)) {
      throw new Error(`Auth connector '${key}' is already registered`);
    }
    this.auths.set(key, connector);
  }

  /** 获取认证连接器 */
  getAuth(name: string): AuthConnector {
    const conn = this.auths.get(name);
    if (!conn) {
      throw new Error(`No auth connector registered for '${name}'`);
    }
    return conn;
  }

  /** 列出所有已注册的认证连接器名称 */
  listAuths(): string[] {
    return Array.from(this.auths.keys());
  }

  /** 判断认证连接器是否已注册 */
  hasAuth(name: string): boolean {
    return this.auths.has(name);
  }

  /** 移除认证连接器 */
  unregisterAuth(name: string): boolean {
    return this.auths.delete(name);
  }

  // ---- Format ----

  /** 注册格式解析器 */
  registerFormat(parser: FormatParser): void {
    const key = parser.name;
    if (this.formats.has(key)) {
      throw new Error(`Format parser '${key}' is already registered`);
    }
    this.formats.set(key, parser);
  }

  /** 获取格式解析器 */
  getFormat(name: string): FormatParser {
    const parser = this.formats.get(name);
    if (!parser) {
      throw new Error(`No format parser registered for '${name}'`);
    }
    return parser;
  }

  /** 列出所有已注册的格式解析器名称 */
  listFormats(): string[] {
    return Array.from(this.formats.keys());
  }

  /** 判断格式解析器是否已注册 */
  hasFormat(name: string): boolean {
    return this.formats.has(name);
  }

  /** 移除格式解析器 */
  unregisterFormat(name: string): boolean {
    return this.formats.delete(name);
  }

  // ---- Utility ----

  /** 清空所有注册 */
  clear(): void {
    this.transports.clear();
    this.auths.clear();
    this.formats.clear();
  }

  /** 获取所有注册摘要 */
  summary(): RegistrySummary {
    return {
      transports: this.listTransports(),
      auths: this.listAuths(),
      formats: this.listFormats(),
    };
  }
}

export interface RegistrySummary {
  transports: string[];
  auths: string[];
  formats: string[];
}
