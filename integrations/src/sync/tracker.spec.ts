import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySyncTaskTracker, SyncTaskTrackerError } from './tracker.js';

describe('InMemorySyncTaskTracker', () => {
  let tracker: InMemorySyncTaskTracker;

  beforeEach(() => {
    tracker = new InMemorySyncTaskTracker();
  });

  const sampleTask = {
    endpointId: 'erp-product-sync',
    direction: 'INBOUND' as const,
    status: 'PENDING' as const,
    idempotencyKey: 'idem-001',
  };

  it('should create a sync task', async () => {
    const task = await tracker.create(sampleTask);
    expect(task.id).toBeTruthy();
    expect(task.id).toContain('sync-');
    expect(task.startedAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
    expect(task.endpointId).toBe('erp-product-sync');
    expect(task.status).toBe('PENDING');
  });

  it('should update a sync task', async () => {
    const task = await tracker.create(sampleTask);
    const updated = await tracker.update(task.id, {
      status: 'RUNNING',
    });
    expect(updated.status).toBe('RUNNING');
    // updatedAt should be a valid ISO string and >= startedAt
    expect(updated.updatedAt).toBeTruthy();
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(task.startedAt).getTime()
    );
    // id should remain unchanged
    expect(updated.id).toBe(task.id);
  });

  it('should throw when updating non-existent task', async () => {
    await expect(tracker.update('non-existent', { status: 'RUNNING' })).rejects.toThrow(
      SyncTaskTrackerError,
    );
  });

  it('should get a task by id', async () => {
    const task = await tracker.create(sampleTask);
    const found = await tracker.get(task.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(task.id);
  });

  it('should return null for non-existent task', async () => {
    const found = await tracker.get('non-existent');
    expect(found).toBeNull();
  });

  it('should list all tasks', async () => {
    await tracker.create(sampleTask);
    await tracker.create({ ...sampleTask, endpointId: 'ep-2' });

    const all = await tracker.list();
    expect(all).toHaveLength(2);
  });

  it('should filter tasks by endpointId', async () => {
    await tracker.create(sampleTask);
    await tracker.create({ ...sampleTask, endpointId: 'ep-2' });

    const filtered = await tracker.list({ endpointId: 'erp-product-sync' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].endpointId).toBe('erp-product-sync');
  });

  it('should filter tasks by status', async () => {
    const task = await tracker.create(sampleTask);
    await tracker.create({ ...sampleTask, endpointId: 'ep-2' });

    await tracker.update(task.id, { status: 'RUNNING' });

    const pending = await tracker.list({ status: 'PENDING' });
    expect(pending).toHaveLength(1);

    const running = await tracker.list({ status: 'RUNNING' });
    expect(running).toHaveLength(1);
  });

  it('should return tasks sorted by startedAt descending', async () => {
    const task1 = await tracker.create(sampleTask);
    const task2 = await tracker.create({ ...sampleTask, endpointId: 'ep-2' });

    const all = await tracker.list();
    expect(all[0].id).toBe(task2.id); // newest first
    expect(all[1].id).toBe(task1.id);
  });

  it('should clear all tasks', async () => {
    await tracker.create(sampleTask);
    await tracker.create(sampleTask);
    expect((await tracker.list()).length).toBe(2);
    tracker.clear();
    expect((await tracker.list()).length).toBe(0);
  });
});
