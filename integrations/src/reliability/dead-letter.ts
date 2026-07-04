// ============================================================================
// 死信队列 (Dead Letter Queue)
// ============================================================================

/** 死信记录状态 */
export type DeadLetterStatus = 'PENDING_RETRY' | 'RETRYING' | 'FAILED' | 'ARCHIVED';

/** 死信记录 */
export interface DeadLetterRecord {
  /** 唯一标识 */
  id: string;

  /** 关联的同步任务 ID */
  taskId: string;

  /** 关联的端点 ID */
  endpointId: string;

  /** 失败时的载荷 */
  payload: unknown;

  /** 错误消息 */
  errorMessage: string;

  /** 错误堆栈 */
  errorStack?: string;

  /** 首次失败时间 (ISO 8601) */
  failedAt: string;

  /** 已重试次数 */
  retryCount: number;

  /** 最大重试次数 */
  maxRetries: number;

  /** 当前状态 */
  status: DeadLetterStatus;

  /** 下次重试时间 (ISO 8601) */
  nextRetryAt?: string;
}

/** 死信记录筛选条件 */
export interface DeadLetterFilter {
  status?: DeadLetterStatus;
  endpointId?: string;
}

/**
 * 死信队列接口
 *
 * 用于存储处理失败的消息/任务, 支持重试和人工介入。
 */
export interface DeadLetterQueue {
  /**
   * 将失败记录推入死信队列
   * @returns 生成的记录 ID
   */
  push(record: Omit<DeadLetterRecord, 'id' | 'failedAt' | 'retryCount' | 'status'>): Promise<string>;

  /**
   * 取出最早的一条待重试记录
   * @returns 死信记录或 null (队列为空)
   */
  pop(): Promise<DeadLetterRecord | null>;

  /**
   * 查看指定记录
   */
  peek(id: string): Promise<DeadLetterRecord | null>;

  /**
   * 按条件列出死信记录
   */
  list(filter?: DeadLetterFilter): Promise<DeadLetterRecord[]>;

  /**
   * 标记记录为失败 (不再重试)
   */
  markFailed(id: string): Promise<void>;

  /**
   * 标记记录为重试中
   */
  markRetrying(id: string, nextRetryAt?: string): Promise<void>;

  /**
   * 标记记录为已归档
   */
  markArchived(id: string): Promise<void>;

  /**
   * 统计记录数
   */
  count(filter?: DeadLetterFilter): Promise<number>;
}

/**
 * 内存死信队列 (默认实现, 适合单实例/测试)
 */
export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  private readonly records = new Map<string, DeadLetterRecord>();
  private idCounter = 0;

  async push(
    record: Omit<DeadLetterRecord, 'id' | 'failedAt' | 'retryCount' | 'status'>,
  ): Promise<string> {
    const id = `dlq-${++this.idCounter}-${Date.now()}`;
    const newRecord: DeadLetterRecord = {
      ...record,
      id,
      failedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING_RETRY',
    };
    this.records.set(id, newRecord);
    return id;
  }

  async pop(): Promise<DeadLetterRecord | null> {
    // 找到最早的一条 PENDING_RETRY 记录
    const pending = Array.from(this.records.values())
      .filter((r) => r.status === 'PENDING_RETRY')
      .sort((a, b) => a.failedAt.localeCompare(b.failedAt));

    return pending[0] ?? null;
  }

  async peek(id: string): Promise<DeadLetterRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(filter?: DeadLetterFilter): Promise<DeadLetterRecord[]> {
    let items = Array.from(this.records.values());

    if (filter?.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter?.endpointId) {
      items = items.filter((r) => r.endpointId === filter.endpointId);
    }

    // 按失败时间排序 (最新的在前)
    return items.sort((a, b) => b.failedAt.localeCompare(a.failedAt));
  }

  async markFailed(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) {
      throw new DeadLetterQueueError(`Record '${id}' not found`);
    }
    record.status = 'FAILED';
  }

  async markRetrying(id: string, nextRetryAt?: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) {
      throw new DeadLetterQueueError(`Record '${id}' not found`);
    }
    record.status = 'RETRYING';
    record.retryCount += 1;
    if (nextRetryAt) {
      record.nextRetryAt = nextRetryAt;
    }
  }

  async markArchived(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) {
      throw new DeadLetterQueueError(`Record '${id}' not found`);
    }
    record.status = 'ARCHIVED';
  }

  async count(filter?: DeadLetterFilter): Promise<number> {
    const items = await this.list(filter);
    return items.length;
  }

  /** 清空所有记录 */
  clear(): void {
    this.records.clear();
  }
}

/** 死信队列错误 */
export class DeadLetterQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeadLetterQueueError';
  }
}
