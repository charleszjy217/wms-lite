// ============================================================================
// AMQP/RabbitMQ 传输适配器 — 参考实现
// ============================================================================
//
// 支持连接管理、发布/消费、自动重连。
// 依赖可注入的 connectionFactory 以便测试 mock。
//
// 生产环境对接 amqplib:
//   import amqp from 'amqplib';
//   const factory = async (url: string) => {
//     const conn = await amqp.connect(url);
//     return new AmqpConnectionWrapper(conn);
//   };

import type { TransportConnector, TransportResponse, EndpointConfig, ReceiveOptions } from '../connector/interfaces.js';

// ---- 抽象接口（方便测试 mock） ----

export interface AmqpMessage {
  content: Buffer;
  fields: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export interface AmqpChannel {
  assertQueue(queue: string, options?: Record<string, unknown>): Promise<{ queue: string }>;
  assertExchange(exchange: string, type: string, options?: Record<string, unknown>): Promise<void>;
  bindQueue(queue: string, exchange: string, routingKey: string): Promise<void>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Record<string, unknown>,
  ): boolean;
  consume(
    queue: string,
    onMessage: (msg: AmqpMessage | null) => void,
    options?: Record<string, unknown>,
  ): Promise<{ consumerTag: string }>;
  ack(message: AmqpMessage): void;
  nack(message: AmqpMessage, allUpTo?: boolean, requeue?: boolean): void;
  close(): Promise<void>;
  on(event: 'close' | 'error', listener: (...args: unknown[]) => void): void;
}

export interface AmqpConnection {
  createChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
  on(event: 'close' | 'error', listener: (...args: unknown[]) => void): void;
}

export type AmqpConnectionFactory = (url: string) => Promise<AmqpConnection>;

export interface AmqpTransportOptions {
  connectionFactory?: AmqpConnectionFactory;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export interface AmqpSendOptions {
  exchange?: string;
  routingKey?: string;
  persistent?: boolean;
}

export interface AmqpReceiveOptions extends ReceiveOptions {
  queue?: string;
  exchange?: string;
  routingKey?: string;
  autoAck?: boolean;
}

// ---- Adapter ----

/**
 * AMQP/RabbitMQ 传输适配器
 *
 * 契约实现:
 * - initialize: 建立 AMQP 连接并创建 channel
 * - send: 发布消息到 exchange/routingKey
 * - receive: 消费队列消息（单次拉取模式）
 * - destroy: 关闭连接
 * - testConnection: 检查连接状态
 */
export class AmqpTransportConnector implements TransportConnector {
  readonly name = 'amqp';
  readonly type = 'QUEUE';

  private connectionFactory: AmqpConnectionFactory;
  private reconnectDelayMs: number;
  private maxReconnectAttempts: number;

  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private connected = false;

  constructor(options?: AmqpTransportOptions) {
    this.connectionFactory =
      options?.connectionFactory ?? AmqpTransportConnector.defaultConnectionFactory;
    this.reconnectDelayMs = options?.reconnectDelayMs ?? 2000;
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 5;
  }

  /** 默认工厂 — 可在生产环境替换为真实 amqplib 实现 */
  static defaultConnectionFactory: AmqpConnectionFactory = async (_url: string) => {
    throw new Error(
      'AmqpTransportConnector: no connectionFactory provided. ' +
        'Inject a factory wrapping amqplib.connect()',
    );
  };

  get isConnected(): boolean {
    return this.connected;
  }

  async initialize(config?: Record<string, unknown>): Promise<void> {
    const url = (config?.url as string) ?? 'amqp://localhost';
    await this.connectWithRetry(url);
  }

  async destroy(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close().catch(() => {});
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close().catch(() => {});
        this.connection = null;
      }
    } finally {
      this.connected = false;
    }
  }

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    this.ensureConnected();

    const opts = (endpoint.transport.options ?? {}) as AmqpSendOptions;
    const exchange = opts.exchange ?? '';
    const routingKey = opts.routingKey ?? '';
    const persistent = opts.persistent ?? true;

    const content = Buffer.from(JSON.stringify(payload), 'utf-8');

    const published = this.channel!.publish(exchange, routingKey, content, {
      persistent,
      contentType: 'application/json',
    });

    return {
      status: published ? 200 : 500,
      data: { published, exchange, routingKey },
      metadata: { exchange, routingKey },
    };
  }

  async receive(endpoint: EndpointConfig, options?: ReceiveOptions): Promise<TransportResponse> {
    this.ensureConnected();

    const opts = (endpoint.transport.options ?? {}) as AmqpReceiveOptions;
    const queue = opts.queue;
    if (!queue) {
      throw new Error('AMQP receive requires a queue name in transport.options.queue');
    }

    const exchange = opts.exchange;
    const routingKey = opts.routingKey;
    const autoAck = opts.autoAck ?? true;

    // 声明队列并绑定 exchange
    await this.channel!.assertQueue(queue, { durable: true });
    if (exchange) {
      await this.channel!.assertExchange(exchange, 'topic', { durable: true });
      await this.channel!.bindQueue(queue, exchange, routingKey || '#');
    }

    // 单次拉取：包装 consume 为 Promise
    const message = await new Promise<AmqpMessage | null>((resolve, reject) => {
      const timeout = options?.timeout ?? 30000;
      const timer = setTimeout(() => {
        resolve(null); // 超时返回 null
      }, timeout);

      this.channel!.consume(
        queue,
        (msg) => {
          if (msg) {
            resolve(msg);
          } else {
            resolve(null); // consumer cancelled
          }
        },
        { noAck: autoAck },
      ).catch(reject);

      // 超时清理
      timer.unref?.();
    });

    if (!message) {
      return { status: 204, data: null };
    }

    if (!autoAck) {
      this.channel!.ack(message);
    }

    // 解析 JSON 内容
    let data: unknown;
    try {
      data = JSON.parse(message.content.toString('utf-8'));
    } catch {
      data = message.content.toString('utf-8');
    }

    return {
      status: 200,
      data,
      metadata: {
        ...message.fields,
        ...message.properties,
        queue,
      },
    };
  }

  async testConnection(_endpoint?: EndpointConfig): Promise<boolean> {
    return this.connected && this.channel !== null;
  }

  // ---- private ----

  private ensureConnected(): void {
    if (!this.connected || !this.channel) {
      throw new Error('AMQP transport is not connected. Call initialize() first.');
    }
  }

  private async connectWithRetry(url: string, attempt = 1): Promise<void> {
    try {
      const conn = await this.connectionFactory(url);
      this.connection = conn;

      // 监听连接关闭
      conn.on('close', () => {
        this.connected = false;
        this.attemptReconnect(url);
      });
      conn.on('error', () => {
        this.connected = false;
      });

      this.channel = await conn.createChannel();
      this.connected = true;
    } catch (err) {
      if (attempt >= this.maxReconnectAttempts) {
        throw new Error(
          `AMQP connection failed after ${attempt} attempts: ${(err as Error).message}`,
        );
      }
      await this.sleep(this.reconnectDelayMs * attempt);
      return this.connectWithRetry(url, attempt + 1);
    }
  }

  private attemptReconnect(url: string): void {
    this.connected = false;
    this.channel = null;
    this.connection = null;

    // 异步重连（不阻塞调用方）
    this.connectWithRetry(url).catch(() => {
      // 重连失败静默处理
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
