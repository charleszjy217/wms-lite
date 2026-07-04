// ============================================================================
// CSV format parser / serializer  (RFC 4180 subset)
// ============================================================================

import type { FormatParser, ParseOptions, SerializeOptions } from '../../connector/interfaces.js';
import type { CsvParseOptions, CsvSerializeOptions } from './types.js';

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseLine(line: string, delimiter: string, quoteChar: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === quoteChar) {
      if (inQuotes && i + 1 < line.length && line[i + 1] === quoteChar) {
        // escaped quote
        current += quoteChar;
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

/**
 * Serialize a single row to CSV string.
 */
function serializeRow(fields: string[], delimiter: string, quoteChar: string): string {
  return fields
    .map((f) => {
      if (f.includes(delimiter) || f.includes(quoteChar) || f.includes('\n') || f.includes('\r')) {
        return quoteChar + f.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar) + quoteChar;
      }
      return f;
    })
    .join(delimiter);
}

export class CsvFormatParser implements FormatParser {
  readonly name = 'csv';
  readonly format = 'CSV' as const;

  async parse<T = unknown>(data: string | Buffer, options?: ParseOptions): Promise<T> {
    const opts = (options ?? {}) as CsvParseOptions;
    const delimiter = opts.delimiter ?? ',';
    const quoteChar = opts.quoteChar ?? '"';
    const hasHeader = opts.hasHeader ?? true;
    const text = typeof data === 'string' ? data : data.toString(opts.encoding ?? 'utf-8');

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return [] as T;

    let header: string[];
    let startIndex: number;
    if (hasHeader) {
      header = parseLine(lines[0], delimiter, quoteChar);
      startIndex = 1;
    } else {
      header = [];
      startIndex = 0;
    }

    const result: Record<string, string>[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const fields = parseLine(lines[i], delimiter, quoteChar);
      if (hasHeader) {
        const row: Record<string, string> = {};
        for (let j = 0; j < header.length; j++) {
          row[header[j]] = fields[j] ?? '';
        }
        result.push(row);
      } else {
        const row: Record<string, string> = {};
        fields.forEach((f, idx) => {
          row[String(idx)] = f;
        });
        result.push(row);
      }
    }

    return result as T;
  }

  async serialize<T = unknown>(data: T, options?: SerializeOptions): Promise<string> {
    const opts = (options ?? {}) as CsvSerializeOptions;
    const delimiter = opts.delimiter ?? ',';
    const quoteChar = opts.quoteChar ?? '"';

    if (!Array.isArray(data)) {
      throw new Error('CSV serializer requires an array of records');
    }

    const rows = data as Record<string, unknown>[];
    if (rows.length === 0) return '';

    const header = opts.header ?? Object.keys(rows[0]);
    const lines: string[] = [serializeRow(header, delimiter, quoteChar)];

    for (const row of rows) {
      const fields = header.map((h) => String(row[h] ?? ''));
      lines.push(serializeRow(fields, delimiter, quoteChar));
    }

    return lines.join('\n');
  }

  getMimeType(): string {
    return 'text/csv';
  }
}
