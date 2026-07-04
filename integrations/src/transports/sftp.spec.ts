// ============================================================================
// SFTP + CSV 传输适配器 — 单元测试
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SftpTransportConnector } from './sftp.js';
import type { SftpClient, SftpClientFactory } from './sftp.js';
import type { EndpointConfig } from '../config/types.js';

// ---- Helpers ----

function makeMockSftpClient(): SftpClient {
  return {
    readFile: vi.fn().mockResolvedValue(Buffer.from('name,age\nAlice,30\nBob,25\n', 'utf-8')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEndpoint(overrides?: Partial<EndpointConfig>): EndpointConfig {
  return {
    id: 'sftp-endpoint',
    name: 'SFTP Test',
    transport: {
      type: 'SFTP',
      options: {
        remotePath: '/data/input.csv',
        delimiter: ',',
        hasHeader: true,
        includeHeader: true,
      },
    },
    auth: { type: 'BASIC', credentials: { username: 'user', password: 'pass' } },
    format: { type: 'CSV' },
    direction: 'BIDIRECTIONAL',
    trigger: 'SCHEDULED',
    environment: 'DEVELOPMENT',
    baseUrl: 'sftp://sftp.example.com:22',
    timeout: 30000,
    enabled: true,
    ...overrides,
  };
}

// ---- Tests ----

describe('SftpTransportConnector', () => {
  let mockClient: SftpClient;
  let factory: SftpClientFactory;

  beforeEach(() => {
    mockClient = makeMockSftpClient();
    factory = vi.fn().mockResolvedValue(mockClient);
  });

  describe('name / type', () => {
    it('should have correct name and type', () => {
      const adapter = new SftpTransportConnector();
      expect(adapter.name).toBe('sftp');
      expect(adapter.type).toBe('SFTP');
    });
  });

  describe('initialize / destroy', () => {
    it('should connect using the factory', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      await adapter.initialize({
        host: 'sftp.example.com',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      expect(factory).toHaveBeenCalledWith({
        host: 'sftp.example.com',
        port: 22,
        username: 'user',
        password: 'pass',
      });
      expect(adapter.isConnected).toBe(true);
    });

    it('should destroy and cleanup', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      await adapter.initialize({ host: 'localhost', port: 22, username: 'test' });
      expect(adapter.isConnected).toBe(true);

      await adapter.destroy();
      expect(mockClient.end).toHaveBeenCalledOnce();
      expect(adapter.isConnected).toBe(false);
    });

    it('should handle factory rejection', async () => {
      const badFactory: SftpClientFactory = vi.fn().mockRejectedValue(new Error('Authentication failed'));
      const adapter = new SftpTransportConnector({ clientFactory: badFactory });

      await expect(
        adapter.initialize({ host: 'bad-host', port: 22, username: 'user' }),
      ).rejects.toThrow('Authentication failed');
      expect(adapter.isConnected).toBe(false);
    });
  });

  describe('send', () => {
    it('should serialize payload to CSV and upload', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      await adapter.initialize({ host: 'sftp.example.com', port: 22, username: 'user' });

      const payload = [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ];

      const endpoint = makeEndpoint({
        transport: {
          type: 'SFTP',
          options: { remotePath: '/data/users.csv', delimiter: ',', includeHeader: true },
        },
      });

      const result = await adapter.send(endpoint, payload);

      expect(mockClient.writeFile).toHaveBeenCalledWith(
        '/data/users.csv',
        expect.any(Buffer),
      );

      // Verify the CSV content
      const writtenBuffer = (mockClient.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as Buffer;
      expect(writtenBuffer.toString('utf-8')).toBe('name,age\nAlice,30\nBob,25\n');

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ path: '/data/users.csv', size: expect.any(Number) });
    });

    it('should throw if not connected', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      const endpoint = makeEndpoint();

      await expect(adapter.send(endpoint, [])).rejects.toThrow(
        'SFTP transport is not connected',
      );
    });
  });

  describe('receive', () => {
    it('should download and parse CSV file', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      await adapter.initialize({ host: 'sftp.example.com', port: 22, username: 'user' });

      const endpoint = makeEndpoint({
        transport: {
          type: 'SFTP',
          options: { remotePath: '/data/input.csv', delimiter: ',', hasHeader: true },
        },
      });

      const result = await adapter.receive(endpoint);

      expect(mockClient.readFile).toHaveBeenCalledWith('/data/input.csv');
      expect(result.status).toBe(200);
      expect(result.data).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ]);
      expect(result.metadata).toMatchObject({
        remotePath: '/data/input.csv',
        recordCount: 2,
        type: 'download',
      });
    });

    it('should throw if not connected', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      const endpoint = makeEndpoint();

      await expect(adapter.receive(endpoint)).rejects.toThrow(
        'SFTP transport is not connected',
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when connected', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      await adapter.initialize({ host: 'sftp.example.com', port: 22, username: 'user' });

      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const adapter = new SftpTransportConnector({ clientFactory: factory });
      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });
});
