import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, calculateDelay } from './retry.js';

describe('calculateDelay', () => {
  it('should calculate exponential backoff', () => {
    const config = { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 30000, jitter: false };
    expect(calculateDelay(1, config)).toBe(1000);
    expect(calculateDelay(2, config)).toBe(2000);
    expect(calculateDelay(3, config)).toBe(4000);
    expect(calculateDelay(4, config)).toBe(8000);
    expect(calculateDelay(5, config)).toBe(16000);
  });

  it('should cap at maxDelayMs', () => {
    const config = { maxAttempts: 10, baseDelayMs: 1000, maxDelayMs: 5000, jitter: false };
    expect(calculateDelay(4, config)).toBe(5000); // 8000 > 5000, capped
    expect(calculateDelay(10, config)).toBe(5000);
  });

  it('should add jitter when enabled', () => {
    const config = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, jitter: true };

    // Run multiple times to verify jitter range
    for (let i = 0; i < 50; i++) {
      const delay = calculateDelay(2, config); // base = 2000
      expect(delay).toBeGreaterThanOrEqual(1800);
      expect(delay).toBeLessThanOrEqual(2200);
    }
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    });

    // Fast-forward through retry delays
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();

    const result = await resultPromise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after all retries exhausted', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitter: false,
    });

    // Capture rejection to prevent unhandled rejection
    let rejection: Error | undefined;
    resultPromise.catch((e) => { rejection = e; });

    // Fast-forward through retry delays
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();

    // Wait for microtasks to settle
    await vi.advanceTimersByTimeAsync(0);

    expect(rejection).toBeInstanceOf(Error);
    expect(rejection!.message).toBe('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect shouldRetry callback', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

    const resultPromise = withRetry(
      fn,
      {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitter: false,
      },
      {
        shouldRetry: () => false, // never retry
      },
    );

    await expect(resultPromise).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const resultPromise = withRetry(
      fn,
      {
        maxAttempts: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitter: false,
      },
      { onRetry },
    );

    await vi.advanceTimersToNextTimerAsync();
    const result = await resultPromise;

    expect(result).toBe('ok');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
  });
});
