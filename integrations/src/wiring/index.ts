// ============================================================================
// 集成链路 (Wiring) — 导出入口
//
// 三条参考集成链路:
//   1. MasterDataSyncLink      — 主数据入站同步（商品/供应商）
//   2. InventoryPushFinanceLink — 库存/价值变动出站推送至财务
//   3. SsoLoginLink            — SSO 用户登录
// ============================================================================

export { MasterDataSyncLink } from './master-data-sync/master-data-sync-link.js';
export type {
  ExternalProduct,
  ExternalSupplier,
  PaginatedResponse,
  SyncResult,
  MasterDataSyncLinkConfig,
} from './master-data-sync/types.js';

export { InventoryPushFinanceLink } from './inventory-push-finance/inventory-push-finance-link.js';
export type {
  InventoryPushPayload,
  StockMovementEvent,
  PushResult,
  FinanceApiResponse,
  InventoryPushFinanceLinkConfig,
} from './inventory-push-finance/types.js';

export { SsoLoginLink } from './sso-login/sso-login-link.js';
export type {
  SsoLoginConfig,
  AuthorizeRequest,
  AuthorizeResponse,
  TokenExchangeRequest,
  IdpTokenResponse,
  IdTokenClaims,
  SsoLoginResult,
  LocalUserRecord,
} from './sso-login/types.js';
