// ============================================================================
// HmacAuthAdapter — HMAC 签名认证适配器
// ============================================================================
//
// 从 SecretStore 读取密钥, 对请求体进行 HMAC 签名,
// 将签名附加到请求头。
//
// @example
// ```typescript
// const secrets = new EnvSecretStore('INTEGRATION_');
// const adapter = new HmacAuthAdapter(secrets, 'ERP_HMAC_KEY', {
//   algorithm: 'sha256',
//   headerName: 'X-Signature',
// });
// const req = await adapter.authenticate({
//   url: '...', method: 'POST', headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ id: 1 }),
// });
// // req.headers['X-Signature'] === 'sha256=abc123...'
// ```
// ============================================================================

import { createHmac } from 'node:crypto';
import type { SecretStore } from '../secrets/interface.js';
import type { AuthAdapter, HttpRequest } from '../core/auth.js';

/**
 * HMAC 适配器配置
 */
export interface HmacAuthAdapterConfig {
  /**
   * HMAC 算法 (默认 'sha256')
   * 可选: 'sha1' | 'sha256' | 'sha384' | 'sha512'
   */
  algorithm?: string;

  /**
   * 签名请求头名称 (默认 'X-Hmac-Signature')
   */
  headerName?: string;

  /**
   * 签名格式: 'hex' (默认) 或 'base64'
   */
  encoding?: 'hex' | 'base64';

  /**
   * 是否在签名值前添加算法前缀, 如 'sha256=<sig>' (默认 true)
   */
  includeAlgorithmPrefix?: boolean;
}

/**
 * 支持的 HMAC 算法列表
 */
const SUPPORTED_ALGORITHMS = ['sha1', 'sha256', 'sha384', 'sha512'];

/**
 * HMAC 签名认证适配器
 *
 * 使用密钥对请求体进行 HMAC 签名, 将签名附加到自定义请求头。
 * 若请求无 body, 则对空字符串进行签名。
 */
export class HmacAuthAdapter implements AuthAdapter {
  readonly name = 'hmac';

  private readonly algorithm: string;
  private readonly headerName: string;
  private readonly encoding: 'hex' | 'base64';
  private readonly includeAlgorithmPrefix: boolean;
  private cachedSecret: string | null = null;

  /**
   * @param secrets    SecretStore 实例
   * @param secretKey  密钥在 SecretStore 中的名称
   * @param config     可选配置
   */
  constructor(
    private readonly secrets: SecretStore,
    private readonly secretKey: string,
    config?: HmacAuthAdapterConfig,
  ) {
    this.algorithm = config?.algorithm ?? 'sha256';
    this.headerName = config?.headerName ?? 'X-Hmac-Signature';
    this.encoding = config?.encoding ?? 'hex';
    this.includeAlgorithmPrefix = config?.includeAlgorithmPrefix ?? true;

    // 验证算法是否支持
    if (!SUPPORTED_ALGORITHMS.includes(this.algorithm)) {
      throw new Error(
        `HmacAuthAdapter: unsupported algorithm "${this.algorithm}". ` +
          `Supported: ${SUPPORTED_ALGORITHMS.join(', ')}`,
      );
    }
  }

  async authenticate(request: HttpRequest): Promise<HttpRequest> {
    // 延迟加载密钥
    if (!this.cachedSecret) {
      this.cachedSecret = await this.secrets.get(this.secretKey);
    }

    if (!this.cachedSecret) {
      throw new Error(
        `HmacAuthAdapter: secret "${this.secretKey}" not found in SecretStore`,
      );
    }

    const body = request.body ?? '';
    const signature = this.computeSignature(body, this.cachedSecret);

    return {
      ...request,
      headers: {
        ...request.headers,
        [this.headerName]: signature,
      },
    };
  }

  /**
   * 计算 HMAC 签名
   */
  private computeSignature(body: string, secret: string): string {
    const hmac = createHmac(this.algorithm, secret);
    hmac.update(body, 'utf-8');
    const digest = hmac.digest(this.encoding);

    if (this.includeAlgorithmPrefix) {
      return `${this.algorithm}=${digest}`;
    }
    return digest;
  }
}

