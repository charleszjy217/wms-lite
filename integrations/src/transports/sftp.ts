// ============================================================================
// SFTP + CSV 传输适配器 — 参考实现
// ============================================================================
//
// 支持 SFTP 文件上传/下载，结合 CSV 格式解析/序列化。
// 依赖可注入的 sftpClientFactory 以便测试 mock。
//
// 生产环境对接 ssh2:
//   import { Client } from 'ssh2';
//   const factory = async (cfg: SftpConnectionConfig) => {
//     const conn = new Client();
//     await new Promise((res, rej) =>
//       conn.on('ready', res).on('error', rej).connect(cfg)
//     );
//     const sftp = await new Promise((res, rej) =>
//       conn.sftp((err, sftp) => (err ? rej(err) : res(sftp)))
//     );
//     return new SftpClientWrapper(sftp, conn);
//   };

import type { TransportConnector, TransportResponse, EndpointConfig, ReceiveOptions } from '../connector/interfaces.js';
import { CsvFormatParser } from './csv.js';

// ---- 抽象接口（方便测试 mock） ----

export interface SftpConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SftpFileInfo {
  filename: string;
  longname?: string;
  attrs?: { size?: number; modifyTime?: number; [key: string]: unknown };
}

export interface SftpClient {
  readFile(remotePath: string): Promise<Buffer>;
  writeFile(remotePath: string, data: Buffer): Promise<void>;
  list(directory: string): Promise<SftpFileInfo[]>;
  delete(remotePath: string): Promise<void>;
  end(): Promise<void>;
}

export type SftpClientFactory = (config: SftpConnectionConfig) => Promise<SftpClient>;

export interface SftpTransportOptions {
  clientFactory?: SftpClientFactory;
}

// ---- Adapter ----

/**
 * SFTP + CSV 文件传输适配器
 *
 * 契约实现:
 * - initialize: 建立 SFTP 连接
 * - send: 将 payload 序列化为 CSV → 上传至远程文件
 * - receive: 从远程下载 CSV 文件 → 解析为结构化数据
 * - destroy: 关闭 SFTP 连接
 * - testConnection: 检查连接状态
 */
export class SftpTransportConnector implements TransportConnector {
  readonly name = 'sftp';
  readonly type = 'SFTP';

  private clientFactory: SftpClientFactory;
  private client: SftpClient | null = null;
  private csvParser = new CsvFormatParser();

  constructor(options?: SftpTransportOptions) {
    this.clientFactory =
      options?.clientFactory ?? SftpTransportConnector.defaultClientFactory;
  }

  /** 默认工厂 — 可在生产环境替换为真实 ssh2 实现 */
  static defaultClientFactory: SftpClientFactory = async (_config: SftpConnectionConfig) => {
    throw new Error(
      'SftpTransportConnector: no clientFactory provided. ' +
        'Inject a factory wrapping ssh2.Client().sftp()',
    );
  };

  get isConnected(): boolean {
    return this.client !== null;
  }

  async initialize(config?: Record<string, unknown>): Promise<void> {
    const host = (config?.host as string) ?? 'localhost';
    const port = (config?.port as number) ?? 22;
    const username = (config?.username as string) ?? '';
    const password = config?.password as string | undefined;
    const privateKey = config?.privateKey as string | undefined;
    const passphrase = config?.passphrase as string | undefined;

    const sftpConfig: SftpConnectionConfig = {
      host,
      port,
      username,
      password,
      privateKey,
      passphrase,
    };

    this.client = await this.clientFactory(sftpConfig);
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.end().catch(() => {});
      this.client = null;
    }
  }

  async send(endpoint: EndpointConfig, payload: unknown): Promise<TransportResponse> {
    this.ensureConnected();

    const opts = endpoint.transport.options ?? {};
    const remotePath = (opts.remotePath as string) || (opts.filePath as string) || '/data/output.csv';
    const delimiter = (opts.delimiter as string) ?? ',';
    const includeHeader = (opts.includeHeader as boolean) ?? true;

    // 序列化 payload 为 CSV
    const csvContent = await this.csvParser.serialize(payload, {
      delimiter,
      includeHeader,
    });

    // 上传至 SFTP 服务器
    await this.client!.writeFile(remotePath, Buffer.from(csvContent, 'utf-8'));

    return {
      status: 200,
      data: { path: remotePath, size: Buffer.byteLength(csvContent) },
      metadata: { remotePath, type: 'upload' },
    };
  }

  async receive(endpoint: EndpointConfig, _options?: ReceiveOptions): Promise<TransportResponse> {
    this.ensureConnected();

    const opts = endpoint.transport.options ?? {};
    const remotePath = (opts.remotePath as string) || (opts.filePath as string) || '/data/input.csv';
    const delimiter = (opts.delimiter as string) ?? ',';
    const hasHeader = (opts.hasHeader as boolean) ?? true;

    // 从 SFTP 下载文件
    const fileBuffer = await this.client!.readFile(remotePath);

    // 解析 CSV 内容
    const records = await this.csvParser.parse(fileBuffer, {
      delimiter,
      hasHeader,
    });

    return {
      status: 200,
      data: records,
      metadata: {
        remotePath,
        size: fileBuffer.length,
        recordCount: Array.isArray(records) ? records.length : 0,
        type: 'download',
      },
    };
  }

  async testConnection(_endpoint?: EndpointConfig): Promise<boolean> {
    return this.client !== null;
  }

  // ---- private ----

  private ensureConnected(): void {
    if (!this.client) {
      throw new Error('SFTP transport is not connected. Call initialize() first.');
    }
  }
}
