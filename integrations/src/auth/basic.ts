// ============================================================================
// BasicAuthAdapter — Basic 认证适配器
// ============================================================================
//
// 从 SecretStore 读取 username 和 password, Base64 编码后附加到请求头。
//
// @example
// ```typescript
// const secrets = new EnvSecretStore('INTEGRATION_');
// const adapter = new BasicAuthAdapter(secrets, 'ERP_USERNAME', 'ERP_PASSWORD');
// const req = await adapter.authenticate({ url: '...', method: 'GET', headers: {} });
// // req.headers['Authorization'] === 'Basic dXNlcjpwYXNz'
// ```
// ============================================================================

import type { SecretStore } from '../secrets/interface.js';
import type { AuthAdapter, HttpRequest } from '../core/auth.js';

/**
 * Basic 认证适配器选项
 */
export interface BasicAuthAdapterOptions {
  /** 自定义请求头名称 (默认 'Authorization') */
  headerName?: string;
}

/**
 * Basic 认证适配器
 *
 * 从 SecretStore 分别读取用户名和密码, 按 `username:password` 格式
 * Base64 编码后附加到 `Authorization: Basic <base64>` 请求头。
 */
export class BasicAuthAdapter implements AuthAdapter {
  readonly name = 'basic';

  private readonly headerName: string;

  /**
   * @param secrets        SecretStore 实例
   * @param usernameKey    username 在 SecretStore 中的名称
   * @param passwordKey    password 在 SecretStore 中的名称
   * @param options        可选配置
   */
  constructor(
    private readonly secrets: SecretStore,
    private readonly usernameKey: string,
    private readonly passwordKey: string,
    options?: BasicAuthAdapterOptions,
  ) {
    this.headerName = options?.headerName ?? 'Authorization';
  }

  async authenticate(request: HttpRequest): Promise<HttpRequest> {
    const [username, password] = await Promise.all([
      this.secrets.get(this.usernameKey),
      this.secrets.get(this.passwordKey),
    ]);

    if (!username) {
      throw new Error(
        `BasicAuthAdapter: secret "${this.usernameKey}" not found in SecretStore`,
      );
    }
    if (!password) {
      throw new Error(
        `BasicAuthAdapter: secret "${this.passwordKey}" not found in SecretStore`,
      );
    }

    const encoded = encodeBasicCredentials(username, password);

    return {
      ...request,
      headers: {
        ...request.headers,
        [this.headerName]: `Basic ${encoded}`,
      },
    };
  }
}

/**
 * Base64 编码 username:password
 *
 * 使用全局 Buffer (Node.js) 进行 Base64 编码。
 * 浏览器环境可用 btoa() 替代。
 */
export function encodeBasicCredentials(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return Buffer.from(credentials, 'utf-8').toString('base64');
}
