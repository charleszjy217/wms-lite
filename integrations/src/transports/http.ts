// ============================================================================
// HTTP/REST 传输适配器 — 参考实现
// ============================================================================
//
// 基于 fetch API（Node 18+ 内置），支持 GET/POST/PUT/DELETE，
// JSON 请求/响应，自定义 headers。
//
// 可注入 mock fetch 以便测试。

import type { TransportConnector, TransportResponse, EndpointConfig, ReceiveOptions } from '../connector/interfaces.js';

export interface HttpTransportOptions {
  /** 可替换的 fetch 函数（方便测试 mock） */
  fetch?: typeof fetch;
}

/**
 * HTTP/REST 传输适配器
 *
 * 契约实现:
 * - send: 根据 endpoint 配置发起 HTTP 请求
 * - receive: 执行 GET 请求（轮询模式）
 * - testConnection: HEAD 请求检查连通性
 */
export class HttpTransportConnector implements TransportConnector {
  readonly name = 'http';
  readonly type = 'HTTP';
  private fetchFn: typeof fetch;

  constructor(options?: HttpTransportOptions) {
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    const url = endpoint.baseUrl || '';
    const opts = endpoint.transport.options ?? {};
    const method = String(opts.method ?? 'GET').toUpperCase();
    const customHeaders = (opts.headers as Record<string, string> | undefined) ?? {};
    const timeout = endpoint.timeout ?? 30000;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    const hasBody = !['GET', 'HEAD'].includes(method);

    const response = await this.fetchFn(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(timeout),
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      data,
      headers: responseHeaders,
    };
  }

  async receive(endpoint: EndpointConfig, _options?: ReceiveOptions): Promise<TransportResponse> {
    // receive 复用 send 但强制 GET 方法
    const receiveEndpoint: EndpointConfig = {
      ...endpoint,
      transport: {
        ...endpoint.transport,
        options: {
          ...endpoint.transport.options,
          method: 'GET',
        },
      },
    };
    return this.send(receiveEndpoint, undefined);
  }

  async testConnection(endpoint: EndpointConfig): Promise<boolean> {
    try {
      const url = endpoint.baseUrl || '';
      const timeout = endpoint.timeout ?? 10000;
      const response = await this.fetchFn(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(timeout),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
