// ============================================================================
// @wms-lite/integrations — 可插拔集成框架核心
// ============================================================================

// ---- Connector ----
export type {
  TransportConnector,
  TransportType,
  TransportResponse,
  ReceiveOptions,
  AuthConnector,
  AuthType,
  AuthResult,
  FormatParser,
  FormatType,
  ParseOptions,
  SerializeOptions,
} from './connector/interfaces.js';
export { ConnectorRegistry } from './connector/registry.js';
export type { RegistrySummary } from './connector/registry.js';

// ---- Config ----
export type {
  SyncDirection,
  TriggerType,
  Environment,
  EndpointConfig,
  RetryConfig as EndpointRetryConfig,
  CircuitBreakerConfig as EndpointCircuitBreakerConfig,
  AuthConfig,
  TransportConfig,
  FormatConfig,
} from './config/types.js';

// ---- ACL ----
export type {
  CanonicalBase,
  CanonicalProduct,
  CanonicalSpecAttribute,
  CanonicalBatch,
  CanonicalBatchStatus,
  CanonicalStockMovement,
  CanonicalMovementType,
  CanonicalInventoryBalance,
  CanonicalPriceList,
  CanonicalPriceListType,
  CanonicalProductPrice,
} from './acl/models.js';

// ---- Reliability ----
export { InMemoryIdempotencyStore } from './reliability/idempotency.js';
export type { IdempotencyStore, IdempotencyRecord, IdempotencyStatus } from './reliability/idempotency.js';

export { withRetry, calculateDelay, sleep } from './reliability/retry.js';
export type { RetryConfig, RetryOptions } from './reliability/retry.js';

export { InMemoryDeadLetterQueue, DeadLetterQueueError } from './reliability/dead-letter.js';
export type { DeadLetterRecord, DeadLetterStatus, DeadLetterFilter, DeadLetterQueue } from './reliability/dead-letter.js';

export { CircuitBreaker, CircuitBreakerOpenError } from './reliability/circuit-breaker.js';
export type { CircuitBreakerConfig, CircuitState } from './reliability/circuit-breaker.js';

// ---- Secrets ----
export type { SecretStore } from './secrets/interface.js';
export { EnvSecretStore } from './secrets/env-store.js';

// ---- Sync ----
export type { SyncTask, SyncTaskStatus, SyncTaskFilter } from './sync/types.js';
export { InMemorySyncTaskTracker, SyncTaskTrackerError } from './sync/tracker.js';
export type { SyncTaskTracker } from './sync/tracker.js';
