// ============================================================================
// 幂等键 (Idempotency Key)
// ============================================================================

/** 幂等记录状态 */
export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/** 幂等记录 */
export interface IdempotencyRecord {
  /** 操作结果 */
  result: unknown;

  /** 执行状态 */
  status: IdempotencyStatus;

  /** 创建时间 (ISO 8601) */
  createdAt: string;

  /** 过期时间 (epoch ms) */
  expiresAt: number;
}

/**
 * 幂等键存储接口
 *
 * 确保同一操作不会因重复请求而执行多次。
 * 每个唯一请求在首次处理时记录其键值，后续相同键的请求直接返回缓存结果。
 */
export interface IdempotencyStore {
  /**
   * 保存幂等记录
   * @param key 幂等键 (通常从请求头或载荷中提取)
   * @param record 幂等记录
   * @param ttlMs 生存时间 (ms)
   */
  save(key: string, record: IdempotencyRecord, ttlMs: number): Promise<void>;

  /**
   * 获取幂等记录
   * @param key 幂等键
   * @returns 记录或 null
   */
  get(key: string): Promise<IdempotencyRecord | null>;

  /**
   * 判断幂等键是否存在
   * @param key 幂等键
   */
  has(key: string): Promise<boolean>;

  /**
   * 删除幂等记录
   * @param key 幂等键
   */
  remove(key: string): Promise<void>;
}

/**
 * 内存幂等键存储 (默认实现, 适合单实例/测试)
 * 生产环境应替换为 Redis 或数据库实现
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async save(key: string, record: IdempotencyRecord, ttlMs: number): Promise<void> {
    // 清除已有定时器
    const existingTimer = this.expiryTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.store.set(key, record);

    // 设置自动过期
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.expiryTimers.delete(key);
    }, ttlMs);

    // 防止 Node.js 因定时器未关闭而阻止进程退出
    if (timer.unref) {
      timer.unref();
    }

    this.expiryTimers.set(key, timer);
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.store.get(key);
    if (!record) return null;

    // 检查是否已过期
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      this.expiryTimers.delete(key);
      return null;
    }

    return record;
  }

  async has(key: string): Promise<boolean> {
    const record = await this.get(key);
    return record !== null;
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
    const timer = this.expiryTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(key);
    }
  }

  /** 清空所有记录 */
  clear(): void {
    this.store.clear();
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
  }

  /** 获取当前存储的记录数 (仅用于测试/监控) */
  get size(): number {
    return this.store.size;
  }
}
