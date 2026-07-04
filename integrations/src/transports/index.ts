// ============================================================================
// Transports — 传输适配器导出入口
// ============================================================================

// HTTP/REST
export { HttpTransportConnector } from './http.js';
export type { HttpTransportOptions } from './http.js';

// AMQP/RabbitMQ
export { AmqpTransportConnector } from './amqp.js';
export type {
  AmqpTransportOptions,
  AmqpConnection,
  AmqpChannel,
  AmqpMessage,
  AmqpConnectionFactory,
  AmqpSendOptions,
  AmqpReceiveOptions,
} from './amqp.js';

// SFTP + CSV
export { SftpTransportConnector } from './sftp.js';
export type {
  SftpTransportOptions,
  SftpClient,
  SftpClientFactory,
  SftpConnectionConfig,
  SftpFileInfo,
} from './sftp.js';

// CSV Format Parser
export { CsvFormatParser } from './csv.js';
export type { CsvParseOptions, CsvSerializeOptions } from './csv.js';

// Extension documentation
export { EXTENSIONS_DOC } from './extensions.js';
