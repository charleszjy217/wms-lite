// ============================================================================
// ApiKeyAuthAdapter — API Key 认证适配器
// ============================================================================
//
// 从 SecretStore 读取 API Key, 附加到请求头。
//
// @example
// ```typescript
// const secrets = new EnvSecretStore('INTEGRATION_');
// const adapter = new ApiKeyAuthAdapter(secrets, 'ERP_API_KEY');
// const req = await adapter.authenticate({ url: '...', method: 'GET', headers: {} });
// // req.headers['X-API-Key'] === 'sk-xxx'
// ```
// ============================================================================

import type { SecretStore } from '../secrets/interface.js';
import type { AuthAdapter, HttpRequest } from '../core/auth.js';

/**
 * API Key 认证适配器选项
 */
export interface ApiKeyAuthAdapterOptions {
  /** 自定义请求头名称 (默认 'X-API-Key') */
  headerName?: string;
}

/**
 * API Key 认证适配器
 *
 * 从 SecretStore 读取 API Key, 以指定请求头名称附加到请求。
 * 默认请求头: X-API-Key
 */
export class ApiKeyAuthAdapter implements AuthAdapter {
  readonly name = 'api-key';

  private readonly headerName: string;

  /**
   * @param secrets     SecretStore 实例
   * @param keyName     密钥在 SecretStore 中的名称
   * @param options     可选配置
   */
  constructor(
    private readonly secrets: SecretStore,
    private readonly keyName: string,
    options?: ApiKeyAuthAdapterOptions,
  ) {
    this.headerName = options?.headerName ?? 'X-API-Key';
  }

  async authenticate(request: HttpRequest): Promise<HttpRequest> {
    const apiKey = await this.secrets.get(this.keyName);
    if (!apiKey) {
      throw new Error(
        `ApiKeyAuthAdapter: secret "${this.keyName}" not found in SecretStore`,
      );
    }

    return {
      ...request,
      headers: {
        ...request.headers,
        [this.headerName]: apiKey,
      },
    };
  }
}
