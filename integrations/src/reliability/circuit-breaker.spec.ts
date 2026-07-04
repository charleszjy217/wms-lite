import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 10000,
      halfOpenMaxRequests: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('should allow successful calls in CLOSED state', async () => {
    const result = await cb.call(async () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should open circuit after failure threshold reached', async () => {
    const failingFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(failingFn)).rejects.toThrow('fail');
    }

    expect(cb.getState()).toBe('OPEN');
    expect(cb.getFailureCount()).toBe(3);
  });

  it('should reset failure count on success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await expect(cb.call(fn)).rejects.toThrow('fail');
    expect(cb.getFailureCount()).toBe(1);

    await expect(cb.call(fn)).rejects.toThrow('fail');
    expect(cb.getFailureCount()).toBe(2);

    // Success resets failure count
    await cb.call(fn);
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should reject requests when circuit is OPEN', async () => {
    const failingFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(failingFn)).rejects.toThrow('fail');
    }

    // Circuit is now OPEN
    await expect(cb.call(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const failingFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(failingFn)).rejects.toThrow('fail');
    }

    expect(cb.getState()).toBe('OPEN');

    // Advance time past timeout
    vi.advanceTimersByTime(10001);

    // This call should transition to HALF_OPEN and proceed
    const result = await cb.call(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('should close circuit after success threshold in HALF_OPEN', async () => {
    // Open the circuit first
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow();
    }
    expect(cb.getState()).toBe('OPEN');

    // Wait for timeout
    vi.advanceTimersByTime(10001);

    // First success → HALF_OPEN
    await cb.call(async () => 'ok');
    expect(cb.getState()).toBe('HALF_OPEN');
    expect(cb.getSuccessCount()).toBe(1);

    // Second success → CLOSED
    await cb.call(async () => 'ok');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('should return to OPEN if call fails in HALF_OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow();
    }
    expect(cb.getState()).toBe('OPEN');

    // Wait for timeout
    vi.advanceTimersByTime(10001);

    // Try and fail in HALF_OPEN → back to OPEN
    await expect(cb.call(async () => { throw new Error('still failing'); })).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
  });

  it('should limit requests in HALF_OPEN state', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(async () => { throw new Error('fail'); })).rejects.toThrow();
    }

    // Wait for timeout
    vi.advanceTimersByTime(10001);

    // First call goes through (HALF_OPEN)
    const resultPromise = cb.call(async () => 'ok');

    // Second call should be rejected
    await expect(cb.call(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);

    await resultPromise;
  });

  it('should reset the circuit breaker', () => {
    cb.trip();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('should support sync calls', () => {
    expect(cb.callSync(() => 'ok')).toBe('ok');
    expect(() => cb.callSync(() => { throw new Error('fail'); })).toThrow('fail');
  });
});
