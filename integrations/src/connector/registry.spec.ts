import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorRegistry } from './registry.js';
import type { TransportConnector, AuthConnector, FormatParser } from './interfaces.js';

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry;

  beforeEach(() => {
    registry = new ConnectorRegistry();
  });

  describe('Transport', () => {
    const mockTransport: TransportConnector = {
      name: 'http',
      type: 'HTTP',
    };

    it('should register a transport connector', () => {
      registry.registerTransport(mockTransport);
      expect(registry.hasTransport('http')).toBe(true);
      expect(registry.listTransports()).toEqual(['http']);
    });

    it('should throw when registering duplicate transport', () => {
      registry.registerTransport(mockTransport);
      expect(() => registry.registerTransport(mockTransport)).toThrow(
        "Transport connector 'http' is already registered",
      );
    });

    it('should get a registered transport', () => {
      registry.registerTransport(mockTransport);
      const conn = registry.getTransport('http');
      expect(conn).toBe(mockTransport);
    });

    it('should throw when getting unregistered transport', () => {
      expect(() => registry.getTransport('unknown')).toThrow(
        "No transport connector registered for 'unknown'",
      );
    });

    it('should unregister a transport', () => {
      registry.registerTransport(mockTransport);
      expect(registry.unregisterTransport('http')).toBe(true);
      expect(registry.hasTransport('http')).toBe(false);
    });
  });

  describe('Auth', () => {
    const mockAuth: AuthConnector = {
      name: 'api-key',
      type: 'API_KEY',
      authenticate: async () => ({
        accessToken: 'test-token',
        tokenType: 'api-key',
      }),
    };

    it('should register an auth connector', () => {
      registry.registerAuth(mockAuth);
      expect(registry.hasAuth('api-key')).toBe(true);
    });

    it('should throw when registering duplicate auth', () => {
      registry.registerAuth(mockAuth);
      expect(() => registry.registerAuth(mockAuth)).toThrow(
        "Auth connector 'api-key' is already registered",
      );
    });

    it('should get a registered auth connector', async () => {
      registry.registerAuth(mockAuth);
      const auth = registry.getAuth('api-key');
      const result = await auth.authenticate({});
      expect(result.accessToken).toBe('test-token');
    });
  });

  describe('Format', () => {
    const mockParser: FormatParser = {
      name: 'json',
      format: 'JSON',
      parse: async (data) => JSON.parse(data as string),
      serialize: async (data) => JSON.stringify(data),
      getMimeType: () => 'application/json',
    };

    it('should register a format parser', () => {
      registry.registerFormat(mockParser);
      expect(registry.hasFormat('json')).toBe(true);
    });

    it('should get a registered format parser', async () => {
      registry.registerFormat(mockParser);
      const parser = registry.getFormat('json');
      const result = await parser.parse('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should list all registered formats', () => {
      registry.registerFormat(mockParser);
      expect(registry.listFormats()).toEqual(['json']);
    });
  });

  describe('clear and summary', () => {
    it('should clear all registrations', () => {
      registry.registerTransport({ name: 'http', type: 'HTTP' });
      registry.registerAuth({ name: 'basic', type: 'BASIC', authenticate: async () => ({ accessToken: '' }) });
      registry.registerFormat({ name: 'csv', format: 'CSV', parse: async () => ({}), serialize: async () => '', getMimeType: () => 'text/csv' });
      expect(registry.listTransports()).toHaveLength(1);
      registry.clear();
      expect(registry.listTransports()).toHaveLength(0);
      expect(registry.listAuths()).toHaveLength(0);
      expect(registry.listFormats()).toHaveLength(0);
    });

    it('should return a summary of all registrations', () => {
      registry.registerTransport({ name: 'http', type: 'HTTP' });
      const summary = registry.summary();
      expect(summary.transports).toEqual(['http']);
      expect(summary.auths).toEqual([]);
      expect(summary.formats).toEqual([]);
    });
  });
});
