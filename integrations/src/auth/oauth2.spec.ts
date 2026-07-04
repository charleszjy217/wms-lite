// ============================================================================
// OAuth2ClientCredentialsAdapter 单元测试
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuth2ClientCredentialsAdapter } from './oauth2.js';
import { EnvSecretStore } from '../secrets/env-store.js';
import type { HttpRequest } from '../core/auth.js';

const TOKEN_ENDPOINT = 'https://auth.example.com/oauth/token';

// Helper: mock a successful token endpoint response
function mockFetchSuccess(accessToken = 'mock-access-token', expiresIn = 3600) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}

function mockFetchError(status: number, body = 'error') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, { status, headers: { 'Content-Type': 'text/plain' } }),
  );
}

describe('OAuth2ClientCredentialsAdapter', () => {
  let secrets: EnvSecretStore;
  let env: Record<string, string>;
  let request: HttpRequest;

  beforeEach(() => {
    env = {
      ERP_CLIENT_ID: 'my-client',
      ERP_CLIENT_SECRET: 'my-secret',
    };
    secrets = new EnvSecretStore('', env);
    request = { url: 'https://api.example.com/orders', method: 'GET', headers: {} };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should acquire token and attach Bearer header', async () => {
    const fetchMock = mockFetchSuccess('test-token-abc', 3600);

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    const result = await adapter.authenticate(request);

    expect(result.headers['Authorization']).toBe('Bearer test-token-abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify the request body contains client_credentials grant
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe(TOKEN_ENDPOINT);
    const body = callArgs[1]?.body as string;
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=my-client');
    expect(body).toContain('client_secret=my-secret');
  });

  it('should cache token and reuse on subsequent calls', async () => {
    const fetchMock = mockFetchSuccess('cached-token', 3600);

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    // First call
    const result1 = await adapter.authenticate(request);
    expect(result1.headers['Authorization']).toBe('Bearer cached-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call within cache window
    const result2 = await adapter.authenticate(request);
    expect(result2.headers['Authorization']).toBe('Bearer cached-token');
    // Should NOT have called fetch again
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should request new token when cached token is expired', async () => {
    // Token expires very quickly (1 second), with no refresh margin
    let fetchMock = mockFetchSuccess('token-1', 1); // expires in 1s

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
      refreshMarginMs: 0,
    });

    // First call
    await adapter.authenticate(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Second call should fetch a new token — reassign mock
    fetchMock = mockFetchSuccess('token-2', 3600);
    const result = await adapter.authenticate(request);
    expect(result.headers['Authorization']).toBe('Bearer token-2');
    expect(fetchMock).toHaveBeenCalledTimes(1); // the new mock was called once
  });

  it('should include scopes when configured', async () => {
    const fetchMock = mockFetchSuccess();

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
      scopes: ['read', 'write'],
    });

    await adapter.authenticate(request);
    const body = fetchMock.mock.calls[0][1]?.body as string;
    expect(body).toContain('scope=read+write');
  });

  it('should throw when client_id secret is missing', async () => {
    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'MISSING_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "MISSING_CLIENT_ID" not found',
    );
  });

  it('should throw when client_secret secret is missing', async () => {
    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'MISSING_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    await expect(adapter.authenticate(request)).rejects.toThrow(
      'secret "MISSING_SECRET" not found',
    );
  });

  it('should throw on HTTP error from token endpoint', async () => {
    mockFetchError(401, '{"error":"invalid_client"}');

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    await expect(adapter.authenticate(request)).rejects.toThrow(
      'token endpoint returned 401',
    );
  });

  it('should throw when token response has no access_token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    await expect(adapter.authenticate(request)).rejects.toThrow(
      'missing access_token',
    );
  });

  it('should handle network failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    await expect(adapter.authenticate(request)).rejects.toThrow(
      'failed to reach token endpoint',
    );
  });

  it('should not override existing headers', async () => {
    mockFetchSuccess('tok', 3600);

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    const req: HttpRequest = {
      ...request,
      headers: { Accept: 'application/json' },
    };
    const result = await adapter.authenticate(req);
    expect(result.headers['Accept']).toBe('application/json');
    expect(result.headers['Authorization']).toBe('Bearer tok');
  });

  it('should return a new request object (immutable)', async () => {
    mockFetchSuccess('tok', 3600);

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    const result = await adapter.authenticate(request);
    expect(result).not.toBe(request);
    expect(request.headers['Authorization']).toBeUndefined();
  });

  it('should report correct name', () => {
    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });
    expect(adapter.name).toBe('oauth2-client-credentials');
  });

  it('should allow clearing cache', async () => {
    let fetchMock = mockFetchSuccess('tok1', 3600);

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    await adapter.authenticate(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Clear cache and call again
    adapter.clearCache();

    fetchMock = mockFetchSuccess('tok2', 3600);
    const result = await adapter.authenticate(request);
    expect(result.headers['Authorization']).toBe('Bearer tok2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate concurrent token requests', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            callCount++;
            resolve(
              new Response(
                JSON.stringify({
                  access_token: `token-${callCount}`,
                  token_type: 'Bearer',
                  expires_in: 3600,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              ),
            );
          }, 100),
        ),
    );

    const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
      clientIdKey: 'ERP_CLIENT_ID',
      clientSecretKey: 'ERP_CLIENT_SECRET',
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    // Fire two concurrent requests
    const [result1, result2] = await Promise.all([
      adapter.authenticate(request),
      adapter.authenticate(request),
    ]);

    expect(result1.headers['Authorization']).toBe('Bearer token-1');
    expect(result2.headers['Authorization']).toBe('Bearer token-1');
    // fetch should only be called once
    expect(callCount).toBe(1);
  });
});
