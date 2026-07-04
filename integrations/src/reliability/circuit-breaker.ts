// ============================================================================
// 熔断器 (Circuit Breaker)
// ============================================================================

/** 熔断器状态 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** 熔断器配置 */
export interface CircuitBreakerConfig {
  /** 熔断器名称 (用于日志/指标) */
  name: string;

  /** 触发熔断的连续失败次数阈值 (默认: 5) */
  failureThreshold?: number;

  /** 半开状态下的连续成功次数阈值 (默认: 2) */
  successThreshold?: number;

  /** 熔断后自动尝试恢复的等待时间 (ms, 默认: 30000) */
  timeoutMs?: number;

  /** 半开状态下允许的最大请求数 (默认: 1) */
  halfOpenMaxRequests?: number;
}

/** 默认熔断器配置值 */
const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  name: 'unnamed',
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 30000,
  halfOpenMaxRequests: 1,
};

/**
 * 熔断器
 *
 * 防止对失败的外部系统进行重复调用, 避免级联故障。
 * 三个状态: CLOSED (正常) → OPEN (熔断) → HALF_OPEN (尝试恢复) → CLOSED (恢复)
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenRequestCount = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 调用受熔断器保护的操作
   *
   * @param fn 要执行的异步函数
   * @returns 函数执行结果
   * @throws CircuitBreakerOpenError 当熔断器处于 OPEN 状态且未到恢复时间
   * @throws 原函数抛出的错误
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 同步调用受熔断器保护的操作 (用于非异步场景)
   */
  callSync<T>(fn: () => T): T {
    this.checkState();

    try {
      const result = fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 检查当前状态, 决定是否允许请求通过
   */
  private checkState(): void {
    if (this.state === 'OPEN') {
      // 检查是否达到恢复等待时间
      if (Date.now() - this.lastFailureTime >= this.config.timeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenRequestCount = 0;
        this.successCount = 0;
      } else {
        throw new CircuitBreakerOpenError(this.config.name);
      }
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequestCount++;
      if (this.halfOpenRequestCount > this.config.halfOpenMaxRequests) {
        throw new CircuitBreakerOpenError(this.config.name);
      }
    }
  }

  /** 处理成功 */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequestCount--;
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        // 恢复为 CLOSED
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      // 成功时重置失败计数
      this.failureCount = 0;
    }
  }

  /** 处理失败 */
  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequestCount--;
      // 半开状态下失败 → 立即回到 OPEN
      this.state = 'OPEN';
      this.successCount = 0;
    } else if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'OPEN';
      }
    }
    // OPEN 状态下失败 — 记录时间即可 (已经是最新)
  }

  // ---- 状态查询 ----

  /** 获取当前熔断器状态 */
  getState(): CircuitState {
    return this.state;
  }

  /** 获取连续失败次数 */
  getFailureCount(): number {
    return this.failureCount;
  }

  /** 获取连续成功次数 (仅在半开状态有意义) */
  getSuccessCount(): number {
    return this.successCount;
  }

  /** 手动重置为 CLOSED 状态 */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRequestCount = 0;
    this.lastFailureTime = 0;
  }

  /** 强制熔断 */
  trip(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }

  /** 获取配置 */
  getConfig(): Readonly<Required<CircuitBreakerConfig>> {
    return { ...this.config };
  }
}

/** 熔断器开启错误 — 请求被拒绝 */
export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is OPEN — request rejected`);
    this.name = 'CircuitBreakerOpenError';
  }
}
