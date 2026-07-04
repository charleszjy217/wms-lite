// ============================================================================
// MtlsAuthAdapter — mTLS 客户端证书认证适配器
// ============================================================================
//
// 从 SecretStore 读取 PEM 格式的客户端证书和私钥,
// 附加到请求的 TLS 选项中供传输层使用。
//
// @example
// ```typescript
// const secrets = new EnvSecretStore('INTEGRATION_');
// const adapter = new MtlsAuthAdapter(secrets, {
//   certKey: 'ERP_CLIENT_CERT',   // PEM 证书内容
//   keyKey: 'ERP_CLIENT_KEY',      // PEM 私钥内容
//   caKey: 'ERP_CA_CERT',          // 可选: CA 证书
// });
// const req = await adapter.authenticate({ url: '...', method: 'GET', headers: {} });
// // req.tls.cert 已设置
// // req.tls.key  已设置
// ```
// ============================================================================

import type { SecretStore } from '../secrets/interface.js';
import type { AuthAdapter, HttpRequest } from '../core/auth.js';

/**
 * mTLS 适配器配置
 */
export interface MtlsAuthAdapterConfig {
  /** 客户端 PEM 证书在 SecretStore 中的名称 */
  certKey: string;

  /** 客户端 PEM 私钥在 SecretStore 中的名称 */
  keyKey: string;

  /** CA 证书在 SecretStore 中的名称 (可选) */
  caKey?: string;
}

/**
 * mTLS 客户端证书认证适配器
 *
 * 从 SecretStore 加载 PEM 格式的客户端证书和私钥,
 * 通过 request.tls 传递给传输层进行双向 TLS 认证。
 *
 * 注意: 此适配器不验证证书格式, 仅负责从密钥存储加载并传递。
 * 证书格式验证由 TLS 传输层在建立连接时处理。
 */
export class MtlsAuthAdapter implements AuthAdapter {
  readonly name = 'mtls';

  private loadedCert: string | null = null;
  private loadedKey: string | null = null;
  private loadedCa: string | null = null;

  /**
   * @param secrets  SecretStore 实例
   * @param config   适配器配置
   */
  constructor(
    private readonly secrets: SecretStore,
    private readonly config: MtlsAuthAdapterConfig,
  ) {}

  async authenticate(request: HttpRequest): Promise<HttpRequest> {
    // 延迟加载: 只在首次认证时加载密钥
    if (!this.loadedCert) {
      this.loadedCert = await this.secrets.get(this.config.certKey);
    }
    if (!this.loadedKey) {
      this.loadedKey = await this.secrets.get(this.config.keyKey);
    }

    if (!this.loadedCert) {
      throw new Error(
        `MtlsAuthAdapter: secret "${this.config.certKey}" not found in SecretStore`,
      );
    }
    if (!this.loadedKey) {
      throw new Error(
        `MtlsAuthAdapter: secret "${this.config.keyKey}" not found in SecretStore`,
      );
    }

    // 可选加载 CA
    if (this.config.caKey && !this.loadedCa) {
      this.loadedCa = await this.secrets.get(this.config.caKey);
    }

    return {
      ...request,
      tls: {
        cert: this.loadedCert,
        key: this.loadedKey,
        ...(this.loadedCa ? { ca: this.loadedCa } : {}),
      },
    };
  }
}
