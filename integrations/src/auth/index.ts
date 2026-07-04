// ============================================================================
// @wms-lite/integrations — Auth 认证适配器
// ============================================================================

export type { AuthAdapter, HttpRequest } from '../core/auth.js';

// ---- API Key ----
export { ApiKeyAuthAdapter } from './api-key.js';
export type { ApiKeyAuthAdapterOptions } from './api-key.js';

// ---- Bearer Token ----
export { BearerTokenAuthAdapter } from './bearer.js';
export type { BearerTokenAuthAdapterOptions } from './bearer.js';

// ---- Basic Auth ----
export { BasicAuthAdapter, encodeBasicCredentials } from './basic.js';
export type { BasicAuthAdapterOptions } from './basic.js';

// ---- OAuth2 Client Credentials ----
export { OAuth2ClientCredentialsAdapter } from './oauth2.js';
export type {
  OAuth2ClientCredentialsConfig,
  OAuth2TokenResponse,
} from './oauth2.js';

// ---- mTLS ----
export { MtlsAuthAdapter } from './mtls.js';
export type { MtlsAuthAdapterConfig } from './mtls.js';

// ---- HMAC ----
export { HmacAuthAdapter } from './hmac.js';
export type { HmacAuthAdapterConfig } from './hmac.js';
