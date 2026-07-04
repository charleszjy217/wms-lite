// ============================================================================
// HTTP/REST 传输适配器 — 单元测试
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { HttpTransportConnector } from './http.js';
import type { EndpointConfig } from '../config/types.js';

/** 创建一个 mock Response 对象 */
function mockResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string>; contentType?: string },
): Response {
  const status = init?.status ?? 200;
  const contentType = init?.contentType ?? 'application/json';
  const headers = new Headers({ 'content-type': contentType, ...init?.headers });

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(bodyStr, { status, headers });
}

function makeEndpoint(overrides?: Partial<EndpointConfig>): EndpointConfig {
  return {
    id: 'test-endpoint',
    name: 'Test',
    transport: { type: 'HTTP', options: { method: 'GET' } },
    auth: { type: 'NONE' },
    format: { type: 'JSON' },
    direction: 'OUTBOUND',
    trigger: 'MANUAL',
    environment: 'DEVELOPMENT',
    baseUrl: 'https://api.example.com/data',
    timeout: 5000,
    enabled: true,
    ...overrides,
  };
}

describe('HttpTransportConnector', () => {
  describe('name / type', () => {
    it('should have correct name and type', () => {
      const adapter = new HttpTransportConnector();
      expect(adapter.name).toBe('http');
      expect(adapter.type).toBe('HTTP');
    });
  });

  describe('send', () => {
    it('should perform GET request and return JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ key: 'value' }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      const result = await adapter.send(endpoint, undefined);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should perform POST request with JSON body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ id: 1 }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint({
        transport: { type: 'HTTP', options: { method: 'POST' } },
      });
      const payload = { name: 'Alice' };
      const result = await adapter.send(endpoint, payload);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal),
      });
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ id: 1 });
    });

    it('should support custom headers from endpoint config', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ ok: true }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint({
        transport: {
          type: 'HTTP',
          options: {
            method: 'GET',
            headers: { Authorization: 'Bearer token123', 'X-Custom': 'value' },
          },
        },
      });
      await adapter.send(endpoint, undefined);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer token123',
            'X-Custom': 'value',
          },
        }),
      );
    });

    it('should handle non-JSON response', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse('plain text', { contentType: 'text/plain' }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      const result = await adapter.send(endpoint, undefined);

      expect(result.data).toBe('plain text');
    });

    it('should handle error status codes', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ error: 'Not Found' }, { status: 404 }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      const result = await adapter.send(endpoint, undefined);

      expect(result.status).toBe(404);
      expect(result.data).toEqual({ error: 'Not Found' });
    });

    it('should propagate fetch errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      await expect(adapter.send(endpoint, undefined)).rejects.toThrow('Network error');
    });
  });

  describe('receive', () => {
    it('should perform GET request (polling mode)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ data: 'polled' }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint({
        transport: { type: 'HTTP', options: { method: 'POST' } }, // original is POST
      });
      const result = await adapter.receive(endpoint);

      // receive forces GET
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.data).toEqual({ data: 'polled' });
    });
  });

  describe('testConnection', () => {
    it('should return true for successful HEAD request', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse('', { status: 200 }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      const result = await adapter.testConnection(endpoint);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'HEAD' }),
      );
    });

    it('should return false for failed HEAD request', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse('', { status: 500 }));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      const result = await adapter.testConnection(endpoint);

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Timeout'));
      const adapter = new HttpTransportConnector({ fetch: mockFetch });

      const endpoint = makeEndpoint();
      const result = await adapter.testConnection(endpoint);

      expect(result).toBe(false);
    });
  });
});
