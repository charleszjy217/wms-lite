// ============================================================================
// BasicAuthAdapter 单元测试
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { BasicAuthAdapter, encodeBasicCredentials } from './basic.js';
import { EnvSecretStore } from '../secrets/env-store.js';
import type { HttpRequest } from '../core/auth.js';

describe('encodeBasicCredentials', () => {
  it('should encode username:password in base64', () => {
    const result = encodeBasicCredentials('alice', 'p@ss');
    // Base64 of 'alice:p@ss'
    expect(result).toBe('YWxpY2U6cEBzcw==');
  });

  it('should handle special characters', () => {
    const result = encodeBasicCredentials('user@example.com', 'secret!123');
    expect(result).toBe('dXNlckBleGFtcGxlLmNvbTpzZWNyZXQhMTIz');
  });
});

describe('BasicAuthAdapter', () => {
  let secrets: EnvSecretStore;
  let env: Record<string, string>;
  let request: HttpRequest;

  beforeEach(() => {
    env = { ERP_USERNAME: 'admin', ERP_PASSWORD: 's3cret' };
    secrets = new EnvSecretStore('', env);
    request = { url: 'https://api.example.com/orders', method: 'GET', headers: {} };
  });

  it('should attach Basic auth header', async () => {
    const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'ERP_PASSWORD');
    const result = await adapter.authenticate(request);
    expect(result.headers['Authorization']).toBe('Basic YWRtaW46czNjcmV0');
  });

  it('should throw when username secret is missing', async () => {
    const adapter = new BasicAuthAdapter(secrets, 'MISSING_USER', 'ERP_PASSWORD');
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "MISSING_USER" not found',
    );
  });

  it('should throw when password secret is missing', async () => {
    const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'MISSING_PASS');
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "MISSING_PASS" not found',
    );
  });

  it('should not override existing headers', async () => {
    const req: HttpRequest = {
      ...request,
      headers: { 'Content-Type': 'text/xml' },
    };
    const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'ERP_PASSWORD');
    const result = await adapter.authenticate(req);
    expect(result.headers['Content-Type']).toBe('text/xml');
    expect(result.headers['Authorization']).toBe('Basic YWRtaW46czNjcmV0');
  });

  it('should use custom header name when provided', async () => {
    const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'ERP_PASSWORD', {
      headerName: 'X-Authorization',
    });
    const result = await adapter.authenticate(request);
    expect(result.headers['X-Authorization']).toBe('Basic YWRtaW46czNjcmV0');
  });

  it('should return a new request object (immutable)', async () => {
    const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'ERP_PASSWORD');
    const result = await adapter.authenticate(request);
    expect(result).not.toBe(request);
    expect(request.headers['Authorization']).toBeUndefined();
  });

  it('should report correct name', () => {
    const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'ERP_PASSWORD');
    expect(adapter.name).toBe('basic');
  });
});
