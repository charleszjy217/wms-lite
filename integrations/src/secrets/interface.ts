// ============================================================================
// SecretStore 接口
// ============================================================================

/**
 * 密钥存储接口
 *
 * 密钥绝不与应用配置混合, 通过此抽象层获取。
 * 默认实现为环境变量, 生产环境可替换为 Vault / AWS Secrets Manager 等。
 */
export interface SecretStore {
  /**
   * 获取密钥值
   * @param key 密钥名称
   * @returns 密钥值或 null (不存在时)
   */
  get(key: string): Promise<string | null>;

  /**
   * 设置密钥值
   * @param key 密钥名称
   * @param value 密钥值
   */
  set(key: string, value: string): Promise<void>;

  /**
   * 删除密钥
   * @param key 密钥名称
   */
  delete(key: string): Promise<void>;

  /**
   * 判断密钥是否存在
   * @param key 密钥名称
   */
  has(key: string): Promise<boolean>;
}
