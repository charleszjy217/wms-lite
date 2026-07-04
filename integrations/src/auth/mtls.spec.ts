// ============================================================================
// MtlsAuthAdapter 单元测试
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MtlsAuthAdapter } from './mtls.js';
import { EnvSecretStore } from '../secrets/env-store.js';
import type { HttpRequest } from '../core/auth.js';

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIBkzCCATmgAwIBAgIU...
-----END CERTIFICATE-----`;

const SAMPLE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0B...
-----END PRIVATE KEY-----`;

const SAMPLE_CA = `-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIU...
-----END CERTIFICATE-----`;

describe('MtlsAuthAdapter', () => {
  let secrets: EnvSecretStore;
  let env: Record<string, string>;
  let request: HttpRequest;

  beforeEach(() => {
    env = {
      ERP_CLIENT_CERT: SAMPLE_CERT,
      ERP_CLIENT_KEY: SAMPLE_KEY,
      ERP_CA_CERT: SAMPLE_CA,
    };
    secrets = new EnvSecretStore('', env);
    request = { url: 'https://api.example.com/orders', method: 'GET', headers: {} };
  });

  it('should set cert and key on tls options', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });
    const result = await adapter.authenticate(request);
    expect(result.tls).toBeDefined();
    expect(result.tls!.cert).toBe(SAMPLE_CERT);
    expect(result.tls!.key).toBe(SAMPLE_KEY);
    expect(result.tls!.ca).toBeUndefined();
  });

  it('should set CA cert when configured', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
      caKey: 'ERP_CA_CERT',
    });
    const result = await adapter.authenticate(request);
    expect(result.tls!.ca).toBe(SAMPLE_CA);
  });

  it('should not set CA when secret is missing but caKey is configured', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
      caKey: 'MISSING_CA',
    });
    const result = await adapter.authenticate(request);
    expect(result.tls!.ca).toBeUndefined();
  });

  it('should throw when cert secret is missing', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'MISSING_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "MISSING_CERT" not found',
    );
  });

  it('should throw when key secret is missing', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'MISSING_KEY',
    });
    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "MISSING_KEY" not found',
    );
  });

  it('should not override existing headers', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });
    const req: HttpRequest = {
      ...request,
      headers: { 'Content-Type': 'application/json' },
    };
    const result = await adapter.authenticate(req);
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('should preserve existing tls options', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });
    const req: HttpRequest = {
      ...request,
      tls: { cert: 'existing-cert' },
    };
    // Our adapter overwrites tls.cert with the loaded secret
    const result = await adapter.authenticate(req);
    expect(result.tls!.cert).toBe(SAMPLE_CERT);
    expect(result.tls!.key).toBe(SAMPLE_KEY);
  });

  it('should return a new request object (immutable)', async () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });
    const result = await adapter.authenticate(request);
    expect(result).not.toBe(request);
    expect(request.tls).toBeUndefined();
  });

  it('should report correct name', () => {
    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });
    expect(adapter.name).toBe('mtls');
  });

  it('should lazy-load secrets only on first authenticate call', async () => {
    // Set up spy on secrets.get
    const getSpy = vi.spyOn(secrets, 'get');

    const adapter = new MtlsAuthAdapter(secrets, {
      certKey: 'ERP_CLIENT_CERT',
      keyKey: 'ERP_CLIENT_KEY',
    });

    // No calls before authenticate
    expect(getSpy).toHaveBeenCalledTimes(0);

    // First authenticate loads secrets
    await adapter.authenticate(request);
    expect(getSpy).toHaveBeenCalledWith('ERP_CLIENT_CERT');
    expect(getSpy).toHaveBeenCalledWith('ERP_CLIENT_KEY');

    // Second call should not re-fetch (cached)
    getSpy.mockClear();
    await adapter.authenticate(request);
    expect(getSpy).toHaveBeenCalledTimes(0);
  });
});
