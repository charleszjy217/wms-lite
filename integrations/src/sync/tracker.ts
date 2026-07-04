// ============================================================================
// SyncTaskTracker — 同步任务状态追踪
// ============================================================================

import type { SyncTask, SyncTaskFilter, SyncTaskStatus } from './types.js';

/**
 * 同步任务追踪器接口
 *
 * 职责: 记录和查询每次同步任务的执行状态。
 * 生产环境应使用数据库实现以实现持久化和分布式一致性。
 */
export interface SyncTaskTracker {
  /**
   * 创建同步任务
   */
  create(task: Omit<SyncTask, 'id' | 'startedAt' | 'updatedAt'>): Promise<SyncTask>;

  /**
   * 更新同步任务 (部分更新)
   */
  update(id: string, updates: Partial<Omit<SyncTask, 'id'>>): Promise<SyncTask>;

  /**
   * 获取同步任务
   */
  get(id: string): Promise<SyncTask | null>;

  /**
   * 按条件列出同步任务
   */
  list(filter?: SyncTaskFilter): Promise<SyncTask[]>;
}

/**
 * 内存同步任务追踪器 (默认实现, 适合单实例/测试)
 */
export class InMemorySyncTaskTracker implements SyncTaskTracker {
  private readonly tasks = new Map<string, SyncTask>();
  private idCounter = 0;

  async create(
    task: Omit<SyncTask, 'id' | 'startedAt' | 'updatedAt'>,
  ): Promise<SyncTask> {
    const id = `sync-${++this.idCounter}-${Date.now()}`;
    const now = new Date().toISOString();
    const newTask: SyncTask = {
      ...task,
      id,
      startedAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, newTask);
    return newTask;
  }

  async update(id: string, updates: Partial<Omit<SyncTask, 'id'>>): Promise<SyncTask> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new SyncTaskTrackerError(`Sync task '${id}' not found`);
    }

    const updated: SyncTask = {
      ...existing,
      ...updates,
      id: existing.id, // id 不可变
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async get(id: string): Promise<SyncTask | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(filter?: SyncTaskFilter): Promise<SyncTask[]> {
    let items = Array.from(this.tasks.values());

    if (filter?.endpointId) {
      items = items.filter((t) => t.endpointId === filter.endpointId);
    }
    if (filter?.status) {
      items = items.filter((t) => t.status === filter.status);
    }

    // 按开始时间降序排列, 相同时间按 id 降序 (稳定排序)
    return items.sort((a, b) => {
      const timeCmp = b.startedAt.localeCompare(a.startedAt);
      if (timeCmp !== 0) return timeCmp;
      return b.id.localeCompare(a.id);
    });
  }

  /** 清空所有任务 */
  clear(): void {
    this.tasks.clear();
  }
}

/** 同步任务追踪器错误 */
export class SyncTaskTrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncTaskTrackerError';
  }
}
