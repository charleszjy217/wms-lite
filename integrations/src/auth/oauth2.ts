// ============================================================================
// OAuth2ClientCredentialsAdapter — OAuth2 Client Credentials 认证适配器
// ============================================================================
//
// 从 SecretStore 读取 client_id / client_secret, 调用 token endpoint
// 获取 access_token, 缓存并在过期后自动刷新。
//
// @example
// ```typescript
// const secrets = new EnvSecretStore('INTEGRATION_');
// const adapter = new OAuth2ClientCredentialsAdapter(secrets, {
//   clientIdKey: 'ERP_CLIENT_ID',
//   clientSecretKey: 'ERP_CLIENT_SECRET',
//   tokenEndpoint: 'https://auth.example.com/oauth/token',
//   scopes: ['read', 'write'],
// });
// const req = await adapter.authenticate({ url: '...', method: 'GET', headers: {} });
// // req.headers['Authorization'] === 'Bearer eyJxxx'
// ```
// ============================================================================

import type { SecretStore } from '../secrets/interface.js';
import type { AuthAdapter, HttpRequest } from '../core/auth.js';

/**
 * OAuth2 Token 端点响应
 */
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * 缓存的 Token 条目
 */
interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/**
 * OAuth2 Client Credentials 适配器配置
 */
export interface OAuth2ClientCredentialsConfig {
  /** client_id 在 SecretStore 中的名称 */
  clientIdKey: string;

  /** client_secret 在 SecretStore 中的名称 */
  clientSecretKey: string;

  /** Token 端点 URL */
  tokenEndpoint: string;

  /** 请求的 scope 列表 (可选) */
  scopes?: string[];

  /** Token 过期前提前刷新的毫秒数 (默认 60_000, 即 1 分钟) */
  refreshMarginMs?: number;
}

/**
 * OAuth2 Client Credentials 认证适配器
 *
 * 使用 client_credentials grant type 获取 access_token。
 * 内置内存缓存, 在 token 过期前自动刷新。
 */
export class OAuth2ClientCredentialsAdapter implements AuthAdapter {
  readonly name = 'oauth2-client-credentials';

  private readonly config: OAuth2ClientCredentialsConfig;
  private readonly secrets: SecretStore;
  private cachedToken: CachedToken | null = null;
  private refreshing: Promise<string> | null = null;

  /**
   * @param secrets  SecretStore 实例
   * @param config   适配器配置
   */
  constructor(secrets: SecretStore, config: OAuth2ClientCredentialsConfig) {
    this.secrets = secrets;
    this.config = {
      ...config,
      refreshMarginMs: config.refreshMarginMs ?? 60_000,
    };
  }

  async authenticate(request: HttpRequest): Promise<HttpRequest> {
    const token = await this.getAccessToken();

    return {
      ...request,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }

  /**
   * 获取有效的 access_token (带缓存和自动刷新)
   */
  private async getAccessToken(): Promise<string> {
    // 如果缓存有效且未过期, 直接返回
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.accessToken;
    }

    // 如果有正在进行中的刷新请求, 复用 (防止并发)
    if (this.refreshing) {
      return this.refreshing;
    }

    // 发起新的 token 请求
    this.refreshing = this.fetchNewToken();

    try {
      const token = await this.refreshing;
      return token;
    } finally {
      this.refreshing = null;
    }
  }

  /**
   * 向 token endpoint 发起 client_credentials 请求
   */
  private async fetchNewToken(): Promise<string> {
    const [clientId, clientSecret] = await Promise.all([
      this.secrets.get(this.config.clientIdKey),
      this.secrets.get(this.config.clientSecretKey),
    ]);

    if (!clientId) {
      throw new Error(
        `OAuth2ClientCredentialsAdapter: secret "${this.config.clientIdKey}" not found in SecretStore`,
      );
    }
    if (!clientSecret) {
      throw new Error(
        `OAuth2ClientCredentialsAdapter: secret "${this.config.clientSecretKey}" not found in SecretStore`,
      );
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);

    if (this.config.scopes && this.config.scopes.length > 0) {
      body.set('scope', this.config.scopes.join(' '));
    }

    let response: Response;
    try {
      response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err) {
      throw new Error(
        `OAuth2ClientCredentialsAdapter: failed to reach token endpoint "${this.config.tokenEndpoint}": ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `OAuth2ClientCredentialsAdapter: token endpoint returned ${response.status}: ${errorBody}`,
      );
    }

    let data: OAuth2TokenResponse;
    try {
      data = (await response.json()) as OAuth2TokenResponse;
    } catch (err) {
      throw new Error(
        `OAuth2ClientCredentialsAdapter: failed to parse token response: ${(err as Error).message}`,
      );
    }

    if (!data.access_token) {
      throw new Error(
        `OAuth2ClientCredentialsAdapter: token response missing access_token`,
      );
    }

    // 计算过期时间
    const expiresInMs = data.expires_in
      ? data.expires_in * 1000
      : 3600 * 1000; // 默认 1 小时
    const expiresAt = Date.now() + expiresInMs - (this.config.refreshMarginMs ?? 60_000);

    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt,
    };

    return data.access_token;
  }

  /**
   * 清除缓存的 token (强制下次请求时重新获取)
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}
