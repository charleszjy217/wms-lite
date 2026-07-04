// ============================================================================
// HmacAuthAdapter 单元测试
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HmacAuthAdapter } from './hmac.js';
import { EnvSecretStore } from '../secrets/env-store.js';
import type { HttpRequest } from '../core/auth.js';

describe('HmacAuthAdapter', () => {
  let secrets: EnvSecretStore;
  let env: Record<string, string>;
  let request: HttpRequest;

  beforeEach(() => {
    env = { ERP_HMAC_KEY: 'my-hmac-secret-key' };
    secrets = new EnvSecretStore('', env);
    request = {
      url: 'https://api.example.com/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, name: 'test' }),
    };
  });

  it('should attach HMAC signature in default header', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    const result = await adapter.authenticate(request);
    expect(result.headers['X-Hmac-Signature']).toBeDefined();
    // Should start with algorithm prefix
    expect(result.headers['X-Hmac-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
  });

  it('should use custom header name', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY', {
      headerName: 'X-Signature',
    });
    const result = await adapter.authenticate(request);
    expect(result.headers['X-Signature']).toBeDefined();
    expect(result.headers['X-Hmac-Signature']).toBeUndefined();
  });

  it('should use custom algorithm', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY', {
      algorithm: 'sha512',
    });
    const result = await adapter.authenticate(request);
    expect(result.headers['X-Hmac-Signature']).toMatch(/^sha512=[a-f0-9]+$/);
  });

  it('should support base64 encoding', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY', {
      encoding: 'base64',
    });
    const result = await adapter.authenticate(request);
    expect(result.headers['X-Hmac-Signature']).toMatch(/^sha256=[A-Za-z0-9+/=]+$/);
  });

  it('should omit algorithm prefix when configured', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY', {
      includeAlgorithmPrefix: false,
    });
    const result = await adapter.authenticate(request);
    // Should be pure hex without prefix
    expect(result.headers['X-Hmac-Signature']).toMatch(/^[a-f0-9]+$/);
  });

  it('should sign empty body when request has no body', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    const noBodyReq: HttpRequest = {
      url: 'https://api.example.com/ping',
      method: 'GET',
      headers: {},
    };
    const result = await adapter.authenticate(noBodyReq);
    expect(result.headers['X-Hmac-Signature']).toBeDefined();
    // Should produce a consistent signature for empty string
    expect(result.headers['X-Hmac-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
  });

  it('should produce deterministic signatures for same input', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    const result1 = await adapter.authenticate({ ...request });
    const result2 = await adapter.authenticate({ ...request });
    expect(result1.headers['X-Hmac-Signature']).toBe(
      result2.headers['X-Hmac-Signature'],
    );
  });

  it('should produce different signatures for different keys', async () => {
    const adapter1 = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    const env2 = { ERP_HMAC_KEY_2: 'different-key' };
    const secrets2 = new EnvSecretStore('', env2);
    const adapter2 = new HmacAuthAdapter(secrets2, 'ERP_HMAC_KEY_2');

    const result1 = await adapter1.authenticate({ ...request });
    const result2 = await adapter2.authenticate({ ...request });
    expect(result1.headers['X-Hmac-Signature']).not.toBe(
      result2.headers['X-Hmac-Signature'],
    );
  });

  it('should throw when secret is not found', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'NONEXISTENT');
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "NONEXISTENT" not found',
    );
  });

  it('should throw for unsupported algorithm', () => {
    expect(
      () => new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY', { algorithm: 'md5' }),
    ).toThrow('unsupported algorithm "md5"');
  });

  it('should not override existing headers', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    const req: HttpRequest = {
      ...request,
      headers: { 'X-Request-Id': 'abc-123' },
    };
    const result = await adapter.authenticate(req);
    expect(result.headers['X-Request-Id']).toBe('abc-123');
    expect(result.headers['X-Hmac-Signature']).toBeDefined();
  });

  it('should return a new request object (immutable)', async () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    const result = await adapter.authenticate(request);
    expect(result).not.toBe(request);
    expect(request.headers['X-Hmac-Signature']).toBeUndefined();
  });

  it('should report correct name', () => {
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    expect(adapter.name).toBe('hmac');
  });

  it('should lazy-load secret only on first authenticate call', async () => {
    const getSpy = vi.spyOn(secrets, 'get');
    const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY');
    expect(getSpy).toHaveBeenCalledTimes(0);

    await adapter.authenticate(request);
    expect(getSpy).toHaveBeenCalledWith('ERP_HMAC_KEY');

    getSpy.mockClear();
    await adapter.authenticate(request);
    expect(getSpy).toHaveBeenCalledTimes(0); // cached
  });
});
