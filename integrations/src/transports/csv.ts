// ============================================================================
// CSV Format Parser — 参考实现
// ============================================================================

import type { FormatParser, ParseOptions, SerializeOptions } from '../connector/interfaces.js';

export interface CsvParseOptions extends ParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
}

export interface CsvSerializeOptions extends SerializeOptions {
  delimiter?: string;
  includeHeader?: boolean;
}

/**
 * CSV 格式解析器
 * 支持不带外部依赖的标准 CSV 解析/序列化
 */
export class CsvFormatParser implements FormatParser {
  readonly name = 'csv';
  readonly format = 'CSV';

  async parse<T = unknown>(data: string | Buffer, options?: CsvParseOptions): Promise<T> {
    const text =
      typeof data === 'string' ? data : data.toString((options?.encoding as BufferEncoding) || 'utf-8');
    const delimiter = options?.delimiter ?? ',';
    const lines = this.splitLines(text);
    if (lines.length === 0) return [] as unknown as T;

    const hasHeader = options?.hasHeader ?? true;
    let headers: string[];
    let startIndex: number;

    if (hasHeader) {
      headers = this.parseLine(lines[0], delimiter);
      startIndex = 1;
    } else {
      // 无 header 时生成序号 keys
      const firstLine = this.parseLine(lines[0], delimiter);
      headers = firstLine.map((_, i) => `field_${i}`);
      startIndex = 0;
    }

    const records = lines.slice(startIndex).map((line) => {
      const values = this.parseLine(line, delimiter);
      const record: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        record[h] = i < values.length ? values[i] : '';
      });
      return record;
    });

    return records as unknown as T;
  }

  async serialize<T = unknown>(data: T, options?: CsvSerializeOptions): Promise<string> {
    const records = data as Record<string, unknown>[];
    if (!records || records.length === 0) return '';

    const delimiter = options?.delimiter ?? ',';
    const includeHeader = options?.includeHeader ?? true;
    const headers = Object.keys(records[0]);

    const lines: string[] = [];

    if (includeHeader) {
      lines.push(headers.map((h) => this.escapeField(h, delimiter)).join(delimiter));
    }

    for (const record of records) {
      const values = headers.map((h) => this.escapeField(String(record[h] ?? ''), delimiter));
      lines.push(values.join(delimiter));
    }

    return lines.join('\n') + '\n';
  }

  validate?(data: unknown): boolean {
    return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object';
  }

  getMimeType(): string {
    return 'text/csv';
  }

  // ---- private helpers ----

  private splitLines(text: string): string[] {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.length > 0);
  }

  private parseLine(line: string, delimiter: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }

  private escapeField(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
