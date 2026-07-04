// ============================================================================
// 指数退避重试 (Exponential Backoff Retry)
// ============================================================================

/** 重试配置 */
export interface RetryConfig {
  /** 最大重试次数 (含首次) */
  maxAttempts: number;

  /** 基础延迟 (ms) */
  baseDelayMs: number;

  /** 最大延迟 (ms) */
  maxDelayMs: number;

  /** 是否启用抖动 (jitter) */
  jitter: boolean;
}

/** 重试选项 */
export interface RetryOptions {
  /**
   * 自定义是否应重试的判断函数
   * @param error 捕获的错误
   * @param attempt 当前已尝试次数 (从 1 开始)
   * @returns true 表示应重试
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /** 每次重试前的回调 (用于日志/指标) */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * 计算延迟时间
 *
 * 公式: min(baseDelay * 2^(attempt-1), maxDelay)
 * 若启用 jitter, 增加 ±10% 的随机抖动
 *
 * @param attempt 当前尝试次数 (从 1 开始)
 * @param config 重试配置
 * @returns 延迟毫秒数
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  if (!config.jitter) {
    return clampedDelay;
  }

  // 10% 范围的随机抖动: [0.9 * delay, 1.1 * delay]
  const jitterRange = clampedDelay * 0.1;
  const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
  return Math.round(clampedDelay + jitterOffset);
}

/**
 * 使用指数退避策略执行重试
 *
 * @param fn 要执行的异步函数
 * @param config 重试配置
 * @param options 额外选项
 * @returns 函数执行结果
 * @throws 最后一次尝试的错误
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, jitter: true }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  options?: RetryOptions,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最后一次尝试 — 直接抛出
      if (attempt >= config.maxAttempts) {
        throw lastError;
      }

      // 检查是否应重试
      if (options?.shouldRetry && !options.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      const delayMs = calculateDelay(attempt, config);

      // 触发回调
      options?.onRetry?.(lastError, attempt, delayMs);

      // 等待
      await sleep(delayMs);
    }
  }

  // 不会到达这里, 但 TypeScript 需要
  throw lastError!;
}

/** 休眠指定毫秒数 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
