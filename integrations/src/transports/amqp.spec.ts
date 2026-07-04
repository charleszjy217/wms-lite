// ============================================================================
// AMQP/RabbitMQ 传输适配器 — 单元测试
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmqpTransportConnector } from './amqp.js';
import type {
  AmqpConnection,
  AmqpChannel,
  AmqpMessage,
  AmqpConnectionFactory,
} from './amqp.js';
import type { EndpointConfig } from '../config/types.js';

// ---- Helpers ----

function makeMockChannel(): AmqpChannel {
  return {
    assertQueue: vi.fn().mockResolvedValue({ queue: 'test-queue' }),
    assertExchange: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockReturnValue(true),
    consume: vi.fn().mockResolvedValue({ consumerTag: 'tag-1' }),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
}

function makeMockConnection(channel?: AmqpChannel): AmqpConnection {
  const ch = channel ?? makeMockChannel();
  return {
    createChannel: vi.fn().mockResolvedValue(ch),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
}

function makeEndpoint(overrides?: Partial<EndpointConfig>): EndpointConfig {
  return {
    id: 'amqp-endpoint',
    name: 'AMQP Test',
    transport: { type: 'QUEUE', options: { routingKey: 'test.key', queue: 'test-queue' } },
    auth: { type: 'NONE' },
    format: { type: 'JSON' },
    direction: 'OUTBOUND',
    trigger: 'EVENT',
    environment: 'DEVELOPMENT',
    baseUrl: 'amqp://localhost',
    timeout: 5000,
    enabled: true,
    ...overrides,
  };
}

function makeMessage(content: Record<string, unknown>): AmqpMessage {
  return {
    content: Buffer.from(JSON.stringify(content)),
    fields: { routingKey: 'test.key' },
    properties: { contentType: 'application/json' },
  };
}

// ---- Tests ----

describe('AmqpTransportConnector', () => {
  let mockChannel: AmqpChannel;
  let mockConnection: AmqpConnection;
  let factory: AmqpConnectionFactory;

  beforeEach(() => {
    mockChannel = makeMockChannel();
    mockConnection = makeMockConnection(mockChannel);
    factory = vi.fn().mockResolvedValue(mockConnection);
  });

  describe('name / type', () => {
    it('should have correct name and type', () => {
      const adapter = new AmqpTransportConnector();
      expect(adapter.name).toBe('amqp');
      expect(adapter.type).toBe('QUEUE');
    });
  });

  describe('initialize / destroy', () => {
    it('should connect using the factory', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize({ url: 'amqp://rabbitmq:5672' });

      expect(factory).toHaveBeenCalledWith('amqp://rabbitmq:5672');
      expect(mockConnection.createChannel).toHaveBeenCalledOnce();
      expect(adapter.isConnected).toBe(true);
    });

    it('should destroy and cleanup', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize();
      expect(adapter.isConnected).toBe(true);

      await adapter.destroy();
      expect(mockChannel.close).toHaveBeenCalledOnce();
      expect(mockConnection.close).toHaveBeenCalledOnce();
      expect(adapter.isConnected).toBe(false);
    });

    it('should fail when factory rejects', async () => {
      const badFactory: AmqpConnectionFactory = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const adapter = new AmqpTransportConnector({
        connectionFactory: badFactory,
        maxReconnectAttempts: 1,
        reconnectDelayMs: 10,
      });

      await expect(adapter.initialize({ url: 'amqp://bad-host' })).rejects.toThrow(
        /AMQP connection failed after 1 attempts/,
      );
      expect(adapter.isConnected).toBe(false);
    });
  });

  describe('send', () => {
    it('should publish a message to the exchange', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize();

      const endpoint = makeEndpoint({
        transport: {
          type: 'QUEUE',
          options: { exchange: 'test-exchange', routingKey: 'test.key', persistent: true },
        },
      });
      const payload = { hello: 'world' };
      const result = await adapter.send(endpoint, payload);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-exchange',
        'test.key',
        Buffer.from(JSON.stringify(payload)),
        expect.objectContaining({ persistent: true, contentType: 'application/json' }),
      );
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ published: true, exchange: 'test-exchange', routingKey: 'test.key' });
    });

    it('should throw if not connected', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      const endpoint = makeEndpoint();

      await expect(adapter.send(endpoint, {})).rejects.toThrow('AMQP transport is not connected');
    });
  });

  describe('receive', () => {
    it('should consume a message from the queue', async () => {
      const testMsg = makeMessage({ orderId: '123' });
      mockChannel.consume = vi.fn().mockImplementation(
        (_queue: string, cb: (msg: AmqpMessage | null) => void) => {
          setTimeout(() => cb(testMsg), 10);
          return Promise.resolve({ consumerTag: 'tag-1' });
        },
      );

      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize();

      const endpoint = makeEndpoint({
        transport: {
          type: 'QUEUE',
          options: { queue: 'orders', autoAck: true },
        },
      });
      const result = await adapter.receive(endpoint);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('orders', { durable: true });
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ orderId: '123' });
    });

    it('should return 204 when no message (timeout)', async () => {
      // consume that never delivers a message
      mockChannel.consume = vi.fn().mockResolvedValue({ consumerTag: 'tag-1' });

      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize();

      const endpoint = makeEndpoint({
        transport: {
          type: 'QUEUE',
          options: { queue: 'empty-queue', autoAck: true },
        },
      });
      const result = await adapter.receive(endpoint, { timeout: 100 });

      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    });

    it('should throw if no queue specified', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize();

      const endpoint = makeEndpoint({
        transport: { type: 'QUEUE', options: {} },
      });

      await expect(adapter.receive(endpoint)).rejects.toThrow(
        'AMQP receive requires a queue name',
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when connected', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      await adapter.initialize();

      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const adapter = new AmqpTransportConnector({ connectionFactory: factory });
      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });
});
