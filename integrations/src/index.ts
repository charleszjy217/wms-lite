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

// ---- Transports ----
export { HttpTransportConnector, AmqpTransportConnector, SftpTransportConnector, CsvFormatParser } from './transports/index.js';
export type { HttpTransportOptions, AmqpTransportOptions, AmqpConnection, AmqpChannel, AmqpMessage, AmqpConnectionFactory, AmqpSendOptions, AmqpReceiveOptions, SftpTransportOptions, SftpClient, SftpClientFactory, SftpConnectionConfig, SftpFileInfo, CsvParseOptions, CsvSerializeOptions } from './transports/index.js';

// ---- Auth ----
export { ApiKeyAuthConnector, BearerTokenAuthConnector, OAuth2ClientCredentialsConnector, BasicAuthConnector, MtlsAuthConnector, HmacAuthConnector } from './auth/index.js';
export type { ApiKeyAuthConfig, BearerTokenAuthConfig, OAuth2ClientCredentialsConfig, BasicAuthConfig, MtlsAuthConfig, HmacAuthConfig, AuthResult } from './auth/index.js';

// ---- Mapping & Format ----
export { JsonFormatParser } from './mapping/format/json-parser.js';
export { XmlFormatParser } from './mapping/format/xml-parser.js';
export { CsvFormatParser } from './mapping/format/csv-parser.js';
export { FixedWidthFormatParser } from './mapping/format/fixed-width-parser.js';
export { FieldMapper } from './mapping/field-mapper.js';
export { CodeMapper } from './mapping/code-mapper.js';
export { UnitConverter } from './mapping/unit-converter.js';
export { DateConverter } from './mapping/date-converter.js';
export { SchemaValidator } from './mapping/schema-validator.js';
  loadConfigFile,
  loadConfigDirectory,
  loadMappingConfigs,
} from './mapping/mapping-config.js';

export type { FixedWidthColumnDef, CsvParseOptions, XmlParseOptions, JsonParseOptions } from './mapping/format/types.js';
export type { FieldMappingRule, FieldMappingConfig, FieldTransform } from './mapping/field-mapper.js';
export type { CodeMappingEntry, CodeMappingDict } from './mapping/code-mapper.js';
export type { UnitCategory, UnitDefinition } from './mapping/unit-converter.js';
export type { DatePrecision, DateConversionRule } from './mapping/date-converter.js';
export type { SchemaFieldType, SchemaFieldDef, SchemaDefinition, SchemaValidationError } from './mapping/schema-validator.js';
export type { MappingConfigBundle } from './mapping/mapping-config.js';
