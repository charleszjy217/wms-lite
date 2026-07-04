// ============================================================================
// SsoLoginLink — 集成测试
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SsoLoginLink } from './sso-login-link.js';

/** 沙箱 SSO 配置 */
const SANDBOX_CONFIG = {
  provider: 'sandbox-idp',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  authorizeUrl: 'https://sandbox-idp.example.com/oauth/authorize',
  tokenUrl: 'https://sandbox-idp.example.com/oauth/token',
  jwksUrl: 'https://sandbox-idp.example.com/oauth/jwks',
  userInfoUrl: 'https://sandbox-idp.example.com/oauth/userinfo',
  issuer: 'https://sandbox-idp.example.com',
  scopes: ['openid', 'profile', 'email'],
  defaultRole: 'OPERATOR',
  redirectUri: 'http://localhost:5173/auth/callback',
};

/**
 * 生成测试用 JWT (模拟 ID Token)
 * 注意: 这是未签名的 JWT，仅供测试解码逻辑
 */
function createTestIdToken(overrides?: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key-1', typ: 'JWT' }))
    .toString('base64url');

  const payload = Buffer.from(
    JSON.stringify({
      sub: '00uid1b2c3d4e5f6a7b8c',
      iss: 'https://sandbox-idp.example.com',
      aud: 'test-client-id',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      name: 'John Doe',
      preferred_username: 'john.doe',
      email: 'john.doe@company.com',
      email_verified: true,
      ...overrides,
    }),
  ).toString('base64url');

  const signature = Buffer.from('fake-signature-for-testing').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('SsoLoginLink', () => {
  let link: SsoLoginLink;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 设置环境变量
    process.env.INTEGRATION_SSO_CLIENT_ID = 'test-client-id';
    process.env.INTEGRATION_SSO_CLIENT_SECRET = 'test-client-secret';
    process.env.INTEGRATION_SSO_AUTHORIZE_URL = 'https://sandbox-idp.example.com/oauth/authorize';
    process.env.INTEGRATION_SSO_TOKEN_URL = 'https://sandbox-idp.example.com/oauth/token';
    process.env.INTEGRATION_SSO_ISSUER = 'https://sandbox-idp.example.com';

    // Mock fetch BEFORE constructing the link (so HttpTransportConnector captures the spy)
    mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.reject(new Error('fetch not mocked for this test')),
    );

    link = new SsoLoginLink(SANDBOX_CONFIG);
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('initialization', () => {
    it('should create instance with sandbox config', () => {
      expect(link).toBeInstanceOf(SsoLoginLink);
      expect(link.name).toBe('sso-login');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return valid authorization URL', async () => {
      const result = await link.getAuthorizationUrl(
        'http://localhost:5173/auth/callback',
      );

      expect(result.authorizationUrl).toBeDefined();
      expect(result.authorizationUrl).toContain('response_type=code');
      expect(result.authorizationUrl).toContain('client_id=test-client-id');
      expect(result.authorizationUrl).toContain('redirect_uri');
      expect(result.authorizationUrl).toContain('scope=');
      expect(result.authorizationUrl).toContain('state=');
      expect(result.state).toBeDefined();
      expect(result.state.length).toBeGreaterThan(0);
    });

    it('should include provided state parameter', async () => {
      const customState = 'my-custom-state-123';
      const result = await link.getAuthorizationUrl(
        'http://localhost:5173/auth/callback',
        customState,
      );

      expect(result.authorizationUrl).toContain(`state=${customState}`);
      expect(result.state).toBe(customState);
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for token and return login result', async () => {
      const testIdToken = createTestIdToken();

      mockFetch.mockImplementation(
        async (url: string | URL | Request) => {
          const urlStr = url.toString();

          if (urlStr.includes('/oauth/token')) {
            return new Response(
              JSON.stringify({
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 86400,
                id_token: testIdToken,
                refresh_token: 'test-refresh-token',
                scope: 'openid profile email',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }

          if (urlStr.includes('/oauth/userinfo')) {
            return new Response(
              JSON.stringify({
                sub: '00uid1b2c3d4e5f6a7b8c',
                name: 'John Doe',
                preferred_username: 'john.doe',
                email: 'john.doe@company.com',
                email_verified: true,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }

          return new Response('Not Found', { status: 404 });
        },
      );

      const result = await link.handleCallback(
        'test-auth-code',
        'http://localhost:5173/auth/callback',
      );

      expect(result.accessToken).toBe('test-access-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(86400);
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('john.doe@company.com');
      expect(result.user.displayName).toBe('John Doe');
      expect(result.user.roles).toContain('OPERATOR');
      expect(typeof result.isNewUser).toBe('boolean');
    });

    it('should create local user with correct username format', async () => {
      const testIdToken = createTestIdToken();

      mockFetch.mockImplementation(
        async (url: string | URL | Request) => {
          const urlStr = url.toString();

          if (urlStr.includes('/oauth/token')) {
            return new Response(
              JSON.stringify({
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 86400,
                id_token: testIdToken,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }

          if (urlStr.includes('/oauth/userinfo')) {
            return new Response(
              JSON.stringify({
                sub: '00uid1b2c3d4e5f6a7b8c',
                email: 'john.doe@company.com',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }

          return new Response('Not Found', { status: 404 });
        },
      );

      const result = await link.handleCallback(
        'test-auth-code',
        'http://localhost:5173/auth/callback',
      );

      // 用户名格式: {email_local_part}@{provider}
      expect(result.user.username).toMatch(/^.+@sandbox-idp$/);
      expect(result.isNewUser).toBe(true);
    });

    it('should reject expired ID token', async () => {
      const expiredIdToken = createTestIdToken({
        exp: Math.floor(Date.now() / 1000) - 3600, // 1小时前过期
      });

      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'test-access-token',
            token_type: 'Bearer',
            expires_in: 86400,
            id_token: expiredIdToken,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        link.handleCallback('test-auth-code', 'http://localhost:5173/auth/callback'),
      ).rejects.toThrow('ID Token has expired');
    });

    it('should reject token with wrong issuer', async () => {
      const wrongIssuerToken = createTestIdToken({
        iss: 'https://evil-idp.example.com',
      });

      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'test-access-token',
            token_type: 'Bearer',
            expires_in: 86400,
            id_token: wrongIssuerToken,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        link.handleCallback('test-auth-code', 'http://localhost:5173/auth/callback'),
      ).rejects.toThrow(/Invalid ID Token issuer/);
    });

    it('should handle token endpoint failure', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Authorization code expired' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        link.handleCallback('invalid-code', 'http://localhost:5173/auth/callback'),
      ).rejects.toThrow();
    });

    it('should handle invalid ID Token format', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'test-access-token',
            token_type: 'Bearer',
            expires_in: 86400,
            id_token: 'not-a-valid-jwt',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        link.handleCallback('test-auth-code', 'http://localhost:5173/auth/callback'),
      ).rejects.toThrow('Invalid ID Token format');
    });
  });
});
