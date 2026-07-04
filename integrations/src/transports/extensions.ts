// ============================================================================
// 扩展协议文档 — 接口与扩展点
// ============================================================================
//
// 本文件为非全量实现的协议定义扩展点，
// 供后续开发者参考实现其余协议适配器。
//
// 已实现的适配器: HTTP, AMQP/RabbitMQ, SFTP+CSV
// 待实现协议: SOAP, GraphQL, gRPC, Kafka, Redis, MQTT, WebSocket
//
// 实现新协议只需:
//   1. 实现 TransportConnector 接口
//   2. 注册到 ConnectorRegistry
//
// 示例见下方说明。

import type { TransportConnector, TransportResponse, EndpointConfig, ReceiveOptions } from '../connector/interfaces.js';

// ============================================================================
// 1. SOAP 适配器 (待实现)
// ============================================================================
//
// 接口:
//   - 基于 XML/SOAP over HTTP
//   - 需 XML 解析器（如 fast-xml-parser）
//
// EndpointConfig.transport.options:
//   {
//     wsdl: 'https://example.com/service?wsdl',
//     operation: 'GetOrder',
//     namespace: 'http://example.com/soap',
//     soapAction: 'http://example.com/GetOrder',
//   }
//
// 参考骨架:

/*
export class SoapTransportConnector implements TransportConnector {
  readonly name = 'soap';
  readonly type = 'CUSTOM';

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    // 1. 加载 WSDL (可缓存)
    // 2. 构建 SOAP Envelope XML
    // 3. POST 到 endpoint.baseUrl
    // 4. 解析 SOAP Response XML
    throw new Error('SOAP adapter not implemented');
  }

  async receive(endpoint: EndpointConfig, options?: ReceiveOptions): Promise<TransportResponse> {
    throw new Error('SOAP adapter not implemented');
  }
}
*/

// ============================================================================
// 2. GraphQL 适配器 (待实现)
// ============================================================================
//
// 接口:
//   - GraphQL over HTTP
//   - 支持查询/变更/订阅
//
// EndpointConfig.transport.options:
//   {
//     query: 'query { orders { id status } }',
//     variables: { dateFrom: '2024-01-01' },
//     operationName: 'GetOrders',
//   }
//
// 参考骨架:

/*
export class GraphqlTransportConnector implements TransportConnector {
  readonly name = 'graphql';
  readonly type = 'HTTP';

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    // 1. 构建 GraphQL 请求体 { query, variables }
    // 2. POST 到 endpoint.baseUrl
    // 3. 解析 JSON 响应
    throw new Error('GraphQL adapter not implemented');
  }
}
*/

// ============================================================================
// 3. gRPC 适配器 (待实现)
// ============================================================================
//
// 接口:
//   - 基于 Protocol Buffers
//   - 需 @grpc/grpc-js 和 proto-loader
//
// EndpointConfig.transport.options:
//   {
//     protoFile: './protos/order.proto',
//     service: 'OrderService',
//     method: 'GetOrder',
//     package: 'com.example.orders',
//   }
//
// 参考骨架:

/*
export class GrpcTransportConnector implements TransportConnector {
  readonly name = 'grpc';
  readonly type = 'CUSTOM';

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    // 1. 加载 .proto 文件
    // 2. 创建 gRPC client
    // 3. 调用远程方法
    throw new Error('gRPC adapter not implemented');
  }
}
*/

// ============================================================================
// 4. Kafka 适配器 (待实现)
// ============================================================================
//
// 接口:
//   - 基于 kafkajs 库
//   - 支持生产者/消费者
//
// EndpointConfig.transport.options:
//   {
//     topic: 'orders',
//     groupId: 'integration-consumer',
//     clientId: 'wms-integration',
//     fromBeginning: false,
//   }
//
// 参考骨架:

/*
export class KafkaTransportConnector implements TransportConnector {
  readonly name = 'kafka';
  readonly type = 'QUEUE';

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    // 1. 创建 Kafka 生产者
    // 2. 发送消息到 topic
    // 3. 等待 ack
    throw new Error('Kafka adapter not implemented');
  }

  async receive(endpoint: EndpointConfig, options?: ReceiveOptions): Promise<TransportResponse> {
    // 1. 创建 Kafka 消费者
    // 2. 订阅 topic
    // 3. 拉取消息
    throw new Error('Kafka adapter not implemented');
  }
}
*/

// ============================================================================
// 5. WebSocket 适配器 (待实现)
// ============================================================================
//
// 接口:
//   - 基于 ws 库
//   - 支持双向实时通信
//
// EndpointConfig.transport.options:
//   {
//     protocol: 'wss',
//     path: '/events',
//     reconnect: true,
//     subscriptions: ['order.created', 'inventory.updated'],
//   }
//
// 参考骨架:

/*
export class WebSocketTransportConnector implements TransportConnector {
  readonly name = 'websocket';
  readonly type = 'CUSTOM';

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    throw new Error('WebSocket adapter not implemented');
  }

  async receive(endpoint: EndpointConfig, options?: ReceiveOptions): Promise<TransportResponse> {
    throw new Error('WebSocket adapter not implemented');
  }
}
*/

// ============================================================================
// 6. MQTT 适配器 (待实现)
// ============================================================================
//
// 接口:
//   - 基于 mqtt.js 库
//   - 适用于 IoT 场景
//
// EndpointConfig.transport.options:
//   {
//     topic: 'warehouse/sensor/temperature',
//     qos: 1,
//     retain: false,
//     clientId: 'wms-iot-bridge',
//   }
//
// 参考骨架:

/*
export class MqttTransportConnector implements TransportConnector {
  readonly name = 'mqtt';
  readonly type = 'QUEUE';

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    throw new Error('MQTT adapter not implemented');
  }

  async receive(endpoint: EndpointConfig, options?: ReceiveOptions): Promise<TransportResponse> {
    throw new Error('MQTT adapter not implemented');
  }
}
*/

// ============================================================================
// 扩展点总结
// ============================================================================
//
// 所有传输适配器共享的约定:
//
// 1. **命名**: 统一小写 + 连字符 (如 'http', 'amqp', 'sftp', 'graphql')
//
// 2. **配置驱动**: 通过 EndpointConfig.transport.options 传递协议特定参数
//
// 3. **连接生命周期**:
//    initialize(config) → 建立连接/创建客户端
//    send/receive → 业务操作
//    destroy() → 关闭连接/释放资源
//
// 4. **错误处理**: 对外暴露标准的 TransportResponse.status (HTTP 语义),
//    网络/协议错误 throw Error 由上层 retry/circuit-breaker 处理
//
// 5. **测试**: 所有适配器通过依赖注入 (connectionFactory) 支持单元测试 mock
//
// 6. **注册示例**:
//    import { ConnectorRegistry } from '../connector/registry.js';
//    import { HttpTransportConnector } from './http.js';
//    const registry = new ConnectorRegistry();
//    registry.registerTransport(new HttpTransportConnector());

export const EXTENSIONS_DOC = true;
