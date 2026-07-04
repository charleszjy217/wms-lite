// ============================================================================
// SsoLoginLink — SSO 用户登录链路
// ============================================================================
//
// 职责:
//   对接外部 OIDC/OAuth2 身份提供者（沙箱），实现 SSO 登录
//   → 自动创建/匹配本地 User 记录
//
// 依赖:
//   - HttpTransportConnector (HTTP 传输, 用于 Token/UserInfo 端点)
//   - OAuth2ClientCredentialsAdapter (OAuth2 客户端凭证认证)
//
// 沙箱端点通过环境变量注入:
//   INTEGRATION_SSO_CLIENT_ID / INTEGRATION_SSO_CLIENT_SECRET
//   INTEGRATION_SSO_AUTHORIZE_URL / INTEGRATION_SSO_TOKEN_URL
//   INTEGRATION_SSO_JWKS_URL / INTEGRATION_SSO_USERINFO_URL
//   INTEGRATION_SSO_ISSUER
// ============================================================================

import { HttpTransportConnector } from '../../transports/http.js';
import { EnvSecretStore } from '../../secrets/env-store.js';
import type {
  SsoLoginConfig,
  AuthorizeResponse,
  IdpTokenResponse,
  IdTokenClaims,
  SsoLoginResult,
  LocalUserRecord,
} from './types.js';

/**
 * SSO 登录链路
 *
 * 实现 OAuth2 Authorization Code Flow + OIDC ID Token 验证。
 * 登录成功后自动创建或匹配本地 User 记录。
 * 所有端点 URL 通过配置/环境变量注入，指向沙箱。
 */
export class SsoLoginLink {
  readonly name = 'sso-login';

  private readonly transport: HttpTransportConnector;
  private readonly secrets: EnvSecretStore;
  private readonly config: SsoLoginConfig;

  constructor(config?: Partial<SsoLoginConfig>) {
    this.transport = new HttpTransportConnector();
    this.secrets = new EnvSecretStore('INTEGRATION_SSO_');
    this.config = this.resolveConfig(config);
  }

  /**
   * 从环境变量 + 构造函数参数解析完整配置
   */
  private resolveConfig(partial?: Partial<SsoLoginConfig>): SsoLoginConfig {
    return {
      provider: partial?.provider ?? this.getEnv('PROVIDER', 'sandbox-idp'),
      clientId: partial?.clientId ?? this.getEnv('CLIENT_ID', 'sandbox-client-id'),
      clientSecret: partial?.clientSecret ?? this.getEnv('CLIENT_SECRET', 'sandbox-client-secret'),
      authorizeUrl: partial?.authorizeUrl ?? this.getEnv('AUTHORIZE_URL', 'https://sandbox-idp.example.com/oauth/authorize'),
      tokenUrl: partial?.tokenUrl ?? this.getEnv('TOKEN_URL', 'https://sandbox-idp.example.com/oauth/token'),
      jwksUrl: partial?.jwksUrl ?? this.getEnv('JWKS_URL', 'https://sandbox-idp.example.com/oauth/jwks'),
      userInfoUrl: partial?.userInfoUrl ?? this.getEnv('USERINFO_URL', 'https://sandbox-idp.example.com/oauth/userinfo'),
      issuer: partial?.issuer ?? this.getEnv('ISSUER', 'https://sandbox-idp.example.com'),
      scopes: partial?.scopes ?? this.getEnv('SCOPES', 'openid,profile,email').split(','),
      defaultRole: partial?.defaultRole ?? this.getEnv('DEFAULT_ROLE', 'OPERATOR'),
      redirectUri: partial?.redirectUri,
    };
  }

  /**
   * 获取环境变量，不存在时返回默认值
   */
  private getEnv(key: string, defaultValue: string): string {
    const value = process.env[`INTEGRATION_SSO_${key}`];
    return value ?? defaultValue;
  }

  // ---- Public API ----

  /**
   * 获取 SSO 授权 URL
   *
   * @param redirectUri 回调地址
   * @param state 可选 CSRF state 参数（不传则自动生成）
   * @returns 授权 URL 和 state
   */
  async getAuthorizationUrl(
    redirectUri: string,
    state?: string,
  ): Promise<AuthorizeResponse> {
    const generatedState = state ?? this.generateState();
    const scopes = encodeURIComponent(this.config.scopes.join(' '));
    const redirectUriEncoded = encodeURIComponent(redirectUri);

    const authorizationUrl =
      `${this.config.authorizeUrl}` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(this.config.clientId)}` +
      `&redirect_uri=${redirectUriEncoded}` +
      `&scope=${scopes}` +
      `&state=${generatedState}`;

    return {
      authorizationUrl,
      state: generatedState,
    };
  }

  /**
   * 处理 SSO 登录回调
   *
   * 1. 用授权码交换 Token
   * 2. 解码并验证 ID Token
   * 3. 从 ID Token 或 UserInfo 端点获取用户信息
   * 4. 创建或匹配本地 User 记录
   * 5. 返回登录结果
   *
   * @param code 授权码
   * @param redirectUri 回调地址（必须与获取授权码时一致）
   * @returns SSO 登录结果
   */
  async handleCallback(code: string, redirectUri: string): Promise<SsoLoginResult> {
    // 步骤 1: 交换 Token
    const tokenResponse = await this.exchangeCodeForToken(code, redirectUri);

    // 步骤 2: 解码 ID Token (JWT)
    const idTokenClaims = this.decodeIdToken(tokenResponse.id_token);

    // 步骤 3: 验证 issuer 和 audience
    this.validateIdToken(idTokenClaims);

    // 步骤 4: 获取用户信息
    let userInfo: Record<string, unknown>;
    if (this.config.userInfoUrl) {
      userInfo = await this.fetchUserInfo(tokenResponse.access_token);
    } else {
      userInfo = idTokenClaims as unknown as Record<string, unknown>;
    }

    // 步骤 5: 构建或匹配本地用户
    const isNewUser = !(await this.findLocalUser(
      idTokenClaims.sub,
      (userInfo.email as string) ?? idTokenClaims.email ?? '',
    ));

    const localUser = await this.createOrMatchUser(
      idTokenClaims.sub,
      userInfo,
    );

    return {
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
      refreshToken: tokenResponse.refresh_token,
      user: {
        id: localUser.id ?? 'new-user-id',
        username: localUser.username,
        email: localUser.email,
        displayName: localUser.displayName,
        roles: localUser.roles,
      },
      isNewUser,
    };
  }

  // ---- Private Methods ----

  /**
   * 生成随机 state 参数 (CSRF 防护)
   */
  private generateState(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `sso-${result}-${Date.now()}`;
  }

  /**
   * 用授权码交换 Token (Authorization Code Flow)
   *
   * 直接使用 fetch 而非 HttpTransportConnector，因为 Token 端点
   * 需要 application/x-www-form-urlencoded 格式（非 JSON）。
   */
  private async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<IdpTokenResponse> {
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', redirectUri);
    body.set('client_id', this.config.clientId);
    body.set('client_secret', this.config.clientSecret);

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `SSO: Token endpoint returned status ${response.status}: ${errorBody}`,
      );
    }

    return (await response.json()) as IdpTokenResponse;
  }

  /**
   * 解码 ID Token (不验证签名 — 沙箱环境)
   * 生产环境应使用 JWKS 公钥验证 JWT 签名
   */
  private decodeIdToken(idToken: string): IdTokenClaims {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('SSO: Invalid ID Token format (expected JWT)');
    }

    try {
      const payload = parts[1];
      // Base64 URL decode
      const decoded = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf-8');

      return JSON.parse(decoded) as IdTokenClaims;
    } catch (err) {
      throw new Error(
        `SSO: Failed to decode ID Token payload: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 验证 ID Token 的 issuer 和 audience
   */
  private validateIdToken(claims: IdTokenClaims): void {
    // 验证 issuer
    if (claims.iss !== this.config.issuer) {
      throw new Error(
        `SSO: Invalid ID Token issuer. Expected "${this.config.issuer}", got "${claims.iss}"`,
      );
    }

    // 验证 audience
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(this.config.clientId)) {
      throw new Error(
        `SSO: Invalid ID Token audience. Expected "${this.config.clientId}", got "${claims.aud}"`,
      );
    }

    // 验证过期时间
    if (claims.exp * 1000 < Date.now()) {
      throw new Error('SSO: ID Token has expired');
    }
  }

  /**
   * 从 UserInfo 端点获取用户信息
   */
  private async fetchUserInfo(accessToken: string): Promise<Record<string, unknown>> {
    if (!this.config.userInfoUrl) {
      return {};
    }

    const response = await this.transport.send(
      {
        id: 'sso-userinfo',
        name: 'SSO UserInfo',
        transport: {
          type: 'HTTP',
          options: {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          },
        },
        auth: { type: 'none' },
        format: { type: 'JSON' },
        direction: 'OUTBOUND',
        trigger: 'EVENT',
        environment: 'SANDBOX',
        baseUrl: this.config.userInfoUrl,
        enabled: true,
      },
      undefined,
    );

    if (response.status !== 200) {
      throw new Error(
        `SSO: UserInfo endpoint returned status ${response.status}`,
      );
    }

    return response.data as Record<string, unknown>;
  }

  /**
   * 模拟查找本地用户
   * 生产环境应查数据库
   */
  private async findLocalUser(
    subject: string,
    email: string,
  ): Promise<LocalUserRecord | null> {
    // 模拟: 沙箱环境内存查找
    // 生产环境:
    //   - 按 email 查 User 表
    //   - 或按 ssoProvider + ssoSubject 查
    return null; // 沙箱模式默认返回 null，模拟新用户
  }

  /**
   * 创建或匹配本地用户
   */
  private async createOrMatchUser(
    subject: string,
    userInfo: Record<string, unknown>,
  ): Promise<LocalUserRecord> {
    const email = (userInfo.email as string) ?? `${subject}@${this.config.provider}`;
    const displayName =
      (userInfo.name as string) ??
      (userInfo.preferred_username as string) ??
      email.split('@')[0];

    // 用户名格式: {email_local_part}@{provider}
    const usernameLocalPart = email.split('@')[0];
    const username = `${usernameLocalPart}@${this.config.provider}`;

    // TODO: 生产环境写入数据库
    const localUser: LocalUserRecord = {
      username,
      email,
      displayName,
      status: 'ACTIVE',
      ssoProvider: this.config.provider,
      ssoSubject: subject,
      roles: [this.config.defaultRole],
    };

    return localUser;
  }
}
