// ============================================================================
// AuthAdapter — 统一认证接口
// ============================================================================
//
// 所有认证适配器实现此接口. 如需扩展自定义认证方式, 实现 AuthAdapter 即可.
//
// @example
// ```typescript
// class MyCustomAuth implements AuthAdapter {
//   readonly name = 'my-custom-auth';
//   async authenticate(req: HttpRequest): Promise<HttpRequest> {
//     req.headers['X-Custom'] = 'token';
//     return req;
//   }
// }
// ```
// ============================================================================

/**
 * HTTP 请求对象
 *
 * 适配器通过修改此对象的 headers / body / tls 属性来附加认证信息。
 */
export interface HttpRequest {
  /** 请求 URL */
  url: string;

  /** HTTP 方法 */
  method: string;

  /** 请求头 */
  headers: Record<string, string>;

  /** 请求体 (字符串格式) */
  body?: string;

  /** TLS 配置 (仅 mTLS 等传输层认证使用) */
  tls?: {
    /** PEM 格式的客户端证书 */
    cert?: string;
    /** PEM 格式的客户端私钥 */
    key?: string;
    /** PEM 格式的 CA 证书 (可选) */
    ca?: string;
  };
}

/**
 * 认证适配器统一接口
 *
 * 每个适配器实现 authenticate(request) → signed request 的单一职责。
 * 密钥从 SecretStore 获取, 不与配置混合。
 */
export interface AuthAdapter {
  /** 适配器唯一标识, 如 'api-key', 'oauth2' */
  readonly name: string;

  /**
   * 对请求进行认证签名
   *
   * @param request 原始 HTTP 请求
   * @returns 附加认证信息后的请求
   */
  authenticate(request: HttpRequest): Promise<HttpRequest>;
}
