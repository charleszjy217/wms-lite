// ============================================================================
// BearerTokenAuthAdapter — Bearer Token 认证适配器
// ============================================================================
//
// 从 SecretStore 读取 bearer token, 附加到 Authorization 请求头。
//
// @example
// ```typescript
// const secrets = new EnvSecretStore('INTEGRATION_');
// const adapter = new BearerTokenAuthAdapter(secrets, 'ERP_TOKEN');
// const req = await adapter.authenticate({ url: '...', method: 'GET', headers: {} });
// // req.headers['Authorization'] === 'Bearer eyJxxx'
// ```
// ============================================================================

import type { SecretStore } from '../secrets/interface.js';
import type { AuthAdapter, HttpRequest } from '../core/auth.js';

/**
 * Bearer Token 认证适配器选项
 */
export interface BearerTokenAuthAdapterOptions {
  /** 自定义请求头名称 (默认 'Authorization') */
  headerName?: string;
}

/**
 * Bearer Token 认证适配器
 *
 * 从 SecretStore 读取 bearer token, 以 `Authorization: Bearer <token>` 格式
 * 附加到请求头。
 */
export class BearerTokenAuthAdapter implements AuthAdapter {
  readonly name = 'bearer-token';

  private readonly headerName: string;

  /**
   * @param secrets     SecretStore 实例
   * @param keyName     密钥在 SecretStore 中的名称
   * @param options     可选配置
   */
  constructor(
    private readonly secrets: SecretStore,
    private readonly keyName: string,
    options?: BearerTokenAuthAdapterOptions,
  ) {
    this.headerName = options?.headerName ?? 'Authorization';
  }

  async authenticate(request: HttpRequest): Promise<HttpRequest> {
    const token = await this.secrets.get(this.keyName);
    if (!token) {
      throw new Error(
        `BearerTokenAuthAdapter: secret "${this.keyName}" not found in SecretStore`,
      );
    }

    return {
      ...request,
      headers: {
        ...request.headers,
        [this.headerName]: `Bearer ${token}`,
      },
    };
  }
}
