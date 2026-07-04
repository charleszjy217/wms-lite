// ============================================================================
// 同步任务类型定义
// ============================================================================

import type { SyncDirection } from '../config/types.js';

/** 同步任务状态 */
export type SyncTaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

/** 同步任务 */
export interface SyncTask {
  /** 任务唯一标识 */
  id: string;

  /** 关联的端点 ID */
  endpointId: string;

  /** 同步方向 */
  direction: SyncDirection;

  /** 当前状态 */
  status: SyncTaskStatus;

  /** 任务开始时间 (ISO 8601) */
  startedAt: string;

  /** 任务最后更新时间 (ISO 8601) */
  updatedAt: string;

  /** 任务完成时间 (ISO 8601) */
  completedAt?: string;

  /** 错误消息 */
  error?: string;

  /** 已处理记录数 */
  recordsProcessed?: number;

  /** 失败记录数 */
  recordsFailed?: number;

  /** 幂等键 */
  idempotencyKey: string;

  /** 任务元数据 */
  metadata?: Record<string, unknown>;
}

/** 同步任务筛选条件 */
export interface SyncTaskFilter {
  endpointId?: string;
  status?: SyncTaskStatus;
}
