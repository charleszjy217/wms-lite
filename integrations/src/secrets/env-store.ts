// ============================================================================
// EnvSecretStore — 基于环境变量的密钥存储
// ============================================================================

import type { SecretStore } from './interface.js';

/**
 * 基于环境变量的密钥存储实现
 *
 * 从 process.env 读取密钥, 支持可选的统一前缀。
 *
 * @example
 * ```typescript
 * const secrets = new EnvSecretStore('INTEGRATION_');
 * const apiKey = await secrets.get('ERP_API_KEY');
 * // 实际读取 process.env['INTEGRATION_ERP_API_KEY']
 * ```
 */
export class EnvSecretStore implements SecretStore {
  /**
   * @param prefix 可选的环境变量前缀, 如 'INTEGRATION_'
   * @param env 可选的环境变量对象 (默认 process.env)
   */
  constructor(
    private readonly prefix: string = '',
    private readonly env: Record<string, string | undefined> = process.env as Record<
      string,
      string | undefined
    >,
  ) {}

  /**
   * 获取密钥值
   * 实际读取 process.env[prefix + key]
   */
  async get(key: string): Promise<string | null> {
    const envKey = this.resolveKey(key);
    const value = this.env[envKey];
    return value ?? null;
  }

  /**
   * 设置密钥值
   * 注意: process.env 在 Node.js 中是只读的 (无法持久化写入),
   * 此操作仅修改运行时内存中的 env 对象。
   * 对于持久化需求, 应使用文件 .env 或 Vault 实现。
   */
  async set(key: string, value: string): Promise<void> {
    const envKey = this.resolveKey(key);
    this.env[envKey] = value;
  }

  /**
   * 删除密钥
   * 注意: 同理, 仅删除运行时内存中的值。
   */
  async delete(key: string): Promise<void> {
    const envKey = this.resolveKey(key);
    delete this.env[envKey];
  }

  /**
   * 判断密钥是否存在
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * 解析完整的环境变量键名
   */
  private resolveKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
