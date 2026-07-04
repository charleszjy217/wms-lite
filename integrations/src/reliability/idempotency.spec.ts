import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryIdempotencyStore } from './idempotency.js';

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryIdempotencyStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should save and retrieve a record', async () => {
    await store.save('key-1', { result: 'done', status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + 60000 }, 60000);
    const record = await store.get('key-1');
    expect(record).not.toBeNull();
    expect(record!.result).toBe('done');
    expect(record!.status).toBe('COMPLETED');
  });

  it('should return null for non-existent key', async () => {
    const record = await store.get('non-existent');
    expect(record).toBeNull();
  });

  it('should return true for has() when key exists', async () => {
    await store.save('key-1', { result: 'done', status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + 60000 }, 60000);
    expect(await store.has('key-1')).toBe(true);
    expect(await store.has('non-existent')).toBe(false);
  });

  it('should remove a record', async () => {
    await store.save('key-1', { result: 'done', status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + 60000 }, 60000);
    await store.remove('key-1');
    expect(await store.get('key-1')).toBeNull();
  });

  it('should expire records after TTL', async () => {
    await store.save('key-1', { result: 'done', status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + 1000 }, 1000);

    // Before expiry
    expect(await store.has('key-1')).toBe(true);

    // Advance time past TTL
    vi.advanceTimersByTime(1500);

    // After expiry
    expect(await store.has('key-1')).toBe(false);
    expect(await store.get('key-1')).toBeNull();
  });

  it('should clear all records', async () => {
    await store.save('key-1', { result: 'a', status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + 60000 }, 60000);
    await store.save('key-2', { result: 'b', status: 'COMPLETED', createdAt: new Date().toISOString(), expiresAt: Date.now() + 60000 }, 60000);
    expect(store.size).toBe(2);
    store.clear();
    expect(store.size).toBe(0);
  });
});
