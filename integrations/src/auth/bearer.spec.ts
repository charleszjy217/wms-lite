// ============================================================================
// BearerTokenAuthAdapter 单元测试
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { BearerTokenAuthAdapter } from './bearer.js';
import { EnvSecretStore } from '../secrets/env-store.js';
import type { HttpRequest } from '../core/auth.js';

describe('BearerTokenAuthAdapter', () => {
  let secrets: EnvSecretStore;
  let env: Record<string, string>;
  let request: HttpRequest;

  beforeEach(() => {
    env = { ERP_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.dGVzdA' };
    secrets = new EnvSecretStore('', env);
    request = { url: 'https://api.example.com/orders', method: 'GET', headers: {} };
  });

  it('should attach Bearer token to Authorization header', async () => {
    const adapter = new BearerTokenAuthAdapter(secrets, 'ERP_TOKEN');
    const result = await adapter.authenticate(request);
    expect(result.headers['Authorization']).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.dGVzdA');
  });

  it('should use custom header name when provided', async () => {
    const adapter = new BearerTokenAuthAdapter(secrets, 'ERP_TOKEN', {
      headerName: 'X-Auth-Token',
    });
    const result = await adapter.authenticate(request);
    expect(result.headers['X-Auth-Token']).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.dGVzdA');
  });

  it('should not override existing headers', async () => {
    const req: HttpRequest = {
      ...request,
      headers: { Accept: 'application/json' },
    };
    const adapter = new BearerTokenAuthAdapter(secrets, 'ERP_TOKEN');
    const result = await adapter.authenticate(req);
    expect(result.headers['Accept']).toBe('application/json');
    expect(result.headers['Authorization']).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.dGVzdA');
  });

  it('should throw when secret is not found', async () => {
    const adapter = new BearerTokenAuthAdapter(secrets, 'NONEXISTENT');
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "NONEXISTENT" not found',
    );
  });

  it('should return a new request object (immutable)', async () => {
    const adapter = new BearerTokenAuthAdapter(secrets, 'ERP_TOKEN');
    const result = await adapter.authenticate(request);
    expect(result).not.toBe(request);
    expect(request.headers['Authorization']).toBeUndefined();
  });

  it('should report correct name', () => {
    const adapter = new BearerTokenAuthAdapter(secrets, 'ERP_TOKEN');
    expect(adapter.name).toBe('bearer-token');
  });
});
