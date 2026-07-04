import { describe, it, expect, beforeEach } from 'vitest';
import { EnvSecretStore } from './env-store.js';

describe('EnvSecretStore', () => {
  let env: Record<string, string>;
  let store: EnvSecretStore;

  beforeEach(() => {
    env = { ERP_API_KEY: 'sk-test-123', SFTP_PASSWORD: 'p@ss' };
    store = new EnvSecretStore('', env);
  });

  it('should get a secret value', async () => {
    const value = await store.get('ERP_API_KEY');
    expect(value).toBe('sk-test-123');
  });

  it('should return null for non-existent key', async () => {
    const value = await store.get('NONEXISTENT');
    expect(value).toBeNull();
  });

  it('should check if key exists', async () => {
    expect(await store.has('ERP_API_KEY')).toBe(true);
    expect(await store.has('NONEXISTENT')).toBe(false);
  });

  it('should set a runtime value', async () => {
    await store.set('NEW_KEY', 'new-value');
    expect(await store.get('NEW_KEY')).toBe('new-value');
  });

  it('should delete a runtime value', async () => {
    await store.delete('ERP_API_KEY');
    expect(await store.get('ERP_API_KEY')).toBeNull();
  });

  describe('with prefix', () => {
    beforeEach(() => {
      env = { INTEGRATION_ERP_API_KEY: 'sk-prefixed' };
      store = new EnvSecretStore('INTEGRATION_', env);
    });

    it('should prepend prefix to key', async () => {
      const value = await store.get('ERP_API_KEY');
      expect(value).toBe('sk-prefixed');
    });

    it('should not find unprefixed keys', async () => {
      const value = await store.get('INTEGRATION_ERP_API_KEY');
      expect(value).toBeNull(); // because the lookup is INTEGRATION_INTEGRATION_ERP_API_KEY
    });
  });
});
