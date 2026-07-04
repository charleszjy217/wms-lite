// ============================================================================
// ApiKeyAuthAdapter 单元测试
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiKeyAuthAdapter } from './api-key.js';
import { EnvSecretStore } from '../secrets/env-store.js';
import type { HttpRequest } from '../core/auth.js';

describe('ApiKeyAuthAdapter', () => {
  let secrets: EnvSecretStore;
  let env: Record<string, string>;
  let request: HttpRequest;

  beforeEach(() => {
    env = { ERP_API_KEY: 'sk-test-123' };
    secrets = new EnvSecretStore('', env);
    request = { url: 'https://api.example.com/orders', method: 'GET', headers: {} };
  });

  it('should attach API key to default header (X-API-Key)', async () => {
    const adapter = new ApiKeyAuthAdapter(secrets, 'ERP_API_KEY');
    const result = await adapter.authenticate(request);
    expect(result.headers['X-API-Key']).toBe('sk-test-123');
  });

  it('should use custom header name when provided', async () => {
    const adapter = new ApiKeyAuthAdapter(secrets, 'ERP_API_KEY', {
      headerName: 'Api-Key',
    });
    const result = await adapter.authenticate(request);
    expect(result.headers['Api-Key']).toBe('sk-test-123');
  });

  it('should not override existing headers', async () => {
    const req: HttpRequest = {
      ...request,
      headers: { 'Content-Type': 'application/json' },
    };
    const adapter = new ApiKeyAuthAdapter(secrets, 'ERP_API_KEY');
    const result = await adapter.authenticate(req);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['X-API-Key']).toBe('sk-test-123');
  });

  it('should throw when secret is not found', async () => {
    const adapter = new ApiKeyAuthAdapter(secrets, 'NONEXISTENT');
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "NONEXISTENT" not found',
    );
  });

  it('should return a new request object (immutable)', async () => {
    const adapter = new ApiKeyAuthAdapter(secrets, 'ERP_API_KEY');
    const result = await adapter.authenticate(request);
    expect(result).not.toBe(request);
    // Original should be unchanged
    expect(request.headers['X-API-Key']).toBeUndefined();
  });

  it('should report correct name', () => {
    const adapter = new ApiKeyAuthAdapter(secrets, 'ERP_API_KEY');
    expect(adapter.name).toBe('api-key');
  });
});
