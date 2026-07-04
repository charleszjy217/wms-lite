import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDeadLetterQueue, DeadLetterQueueError } from './dead-letter.js';

describe('InMemoryDeadLetterQueue', () => {
  let dlq: InMemoryDeadLetterQueue;

  beforeEach(() => {
    dlq = new InMemoryDeadLetterQueue();
  });

  const sampleRecord = {
    taskId: 'task-1',
    endpointId: 'erp-product-sync',
    payload: { sku: 'TEST-001' },
    errorMessage: 'Connection timeout',
    maxRetries: 3,
  };

  it('should push a record and return an id', async () => {
    const id = await dlq.push(sampleRecord);
    expect(id).toBeTruthy();
    expect(id).toContain('dlq-');
  });

  it('should pop the oldest PENDING_RETRY record', async () => {
    const id1 = await dlq.push({ ...sampleRecord, taskId: 'task-1' });
    // Small delay to ensure ordering
    const id2 = await dlq.push({ ...sampleRecord, taskId: 'task-2' });

    const popped = await dlq.pop();
    expect(popped).not.toBeNull();
    expect(popped!.id).toBe(id1);
    expect(popped!.taskId).toBe('task-1');
    expect(popped!.status).toBe('PENDING_RETRY');
    expect(popped!.retryCount).toBe(0);
  });

  it('should return null when queue is empty', async () => {
    const result = await dlq.pop();
    expect(result).toBeNull();
  });

  it('should peek a record by id', async () => {
    const id = await dlq.push(sampleRecord);
    const record = await dlq.peek(id);
    expect(record).not.toBeNull();
    expect(record!.id).toBe(id);
  });

  it('should return null when peeking non-existent record', async () => {
    const record = await dlq.peek('non-existent');
    expect(record).toBeNull();
  });

  it('should list records with filters', async () => {
    await dlq.push({ ...sampleRecord, endpointId: 'ep-1' });
    await dlq.push({ ...sampleRecord, endpointId: 'ep-2' });

    const all = await dlq.list();
    expect(all).toHaveLength(2);

    const filtered = await dlq.list({ endpointId: 'ep-1' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].endpointId).toBe('ep-1');
  });

  it('should mark record as failed', async () => {
    const id = await dlq.push(sampleRecord);
    await dlq.markFailed(id);
    const record = await dlq.peek(id);
    expect(record!.status).toBe('FAILED');
  });

  it('should mark record as retrying', async () => {
    const id = await dlq.push(sampleRecord);
    await dlq.markRetrying(id, new Date(Date.now() + 5000).toISOString());
    const record = await dlq.peek(id);
    expect(record!.status).toBe('RETRYING');
    expect(record!.retryCount).toBe(1);
    expect(record!.nextRetryAt).toBeTruthy();
  });

  it('should mark record as archived', async () => {
    const id = await dlq.push(sampleRecord);
    await dlq.markArchived(id);
    const record = await dlq.peek(id);
    expect(record!.status).toBe('ARCHIVED');
  });

  it('should count records', async () => {
    expect(await dlq.count()).toBe(0);
    await dlq.push(sampleRecord);
    expect(await dlq.count()).toBe(1);
    await dlq.push(sampleRecord);
    expect(await dlq.count()).toBe(2);
    expect(await dlq.count({ status: 'PENDING_RETRY' })).toBe(2);
  });

  it('should throw when marking non-existent record', async () => {
    await expect(dlq.markFailed('non-existent')).rejects.toThrow(DeadLetterQueueError);
    await expect(dlq.markRetrying('non-existent')).rejects.toThrow(DeadLetterQueueError);
    await expect(dlq.markArchived('non-existent')).rejects.toThrow(DeadLetterQueueError);
  });

  it('should clear all records', async () => {
    await dlq.push(sampleRecord);
    await dlq.push(sampleRecord);
    expect(await dlq.count()).toBe(2);
    dlq.clear();
    expect(await dlq.count()).toBe(0);
  });
});
