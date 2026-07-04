// ============================================================================
// SsoLoginLink — 类型定义
// ============================================================================

/** SSO 登录配置 */
export interface SsoLoginConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl?: string;
  userInfoUrl?: string;
  issuer: string;
  scopes: string[];
  defaultRole: string;
  redirectUri?: string;
}

/** 授权 URL 请求参数 */
export interface AuthorizeRequest {
  redirectUri: string;
  state?: string;
}

/** 授权 URL 响应 */
export interface AuthorizeResponse {
  authorizationUrl: string;
  state: string;
}

/** Token 交换请求 */
export interface TokenExchangeRequest {
  code: string;
  redirectUri: string;
  state?: string;
}

/** Token 交换响应 (来自 IDP) */
export interface IdpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope?: string;
}

/** ID Token 载荷 (OIDC 标准声明) */
export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

/** SSO 登录结果 */
export interface SsoLoginResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    roles: string[];
  };
  isNewUser: boolean;
}

/** 本地用户记录 (用于创建/匹配) */
export interface LocalUserRecord {
  id?: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
  ssoProvider: string;
  ssoSubject: string;
  roles: string[];
}
