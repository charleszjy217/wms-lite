// ============================================================================
// Fixed‑width format parser / serializer
// ============================================================================

import type { FormatParser, ParseOptions, SerializeOptions } from '../../connector/interfaces.js';
import type { FixedWidthColumnDef, FixedWidthParseOptions, FixedWidthSerializeOptions } from './types.js';

function resolveColumnRange(col: FixedWidthColumnDef): [number, number] {
  if (col.end !== undefined) return [col.start, col.end];
  if (col.width !== undefined) return [col.start, col.start + col.width];
  throw new Error(`Column "${col.name}" must have either "end" or "width"`);
}

function trimValue(val: string, trim: 'left' | 'right' | 'both' | 'none'): string {
  switch (trim) {
    case 'left': return val.trimStart();
    case 'right': return val.trimEnd();
    case 'both': return val.trim();
    case 'none': return val;
    default: return val;
  }
}

function castValue(val: string, type?: 'string' | 'number' | 'boolean'): unknown {
  if (type === 'number') {
    const n = Number(val.trim());
    return Number.isNaN(n) ? val : n;
  }
  if (type === 'boolean') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y') return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'n') return false;
    return val;
  }
  return val;
}

export class FixedWidthFormatParser implements FormatParser {
  readonly name = 'fixed-width';
  readonly format = 'FLAT_FILE' as const;

  async parse<T = unknown>(data: string | Buffer, options?: ParseOptions): Promise<T> {
    const opts = (options ?? {}) as FixedWidthParseOptions;
    const text = typeof data === 'string' ? data : data.toString(opts.encoding ?? 'utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l !== '');

    const startLine = opts.skipHeader ? 1 : 0;
    const result: Record<string, unknown>[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const row: Record<string, unknown> = {};
      for (const col of opts.columns) {
        const [start, end] = resolveColumnRange(col);
        const raw = line.slice(start, end);
        const trimmed = trimValue(raw, col.trim ?? 'right');
        row[col.name] = castValue(trimmed, col.type);
      }
      result.push(row);
    }

    return result as T;
  }

  async serialize<T = unknown>(data: T, options?: SerializeOptions): Promise<string> {
    const opts = (options ?? {}) as FixedWidthSerializeOptions;
    const padding = opts.padding ?? ' ';

    if (!Array.isArray(data)) {
      throw new Error('Fixed‑width serializer requires an array of records');
    }

    const rows = data as Record<string, unknown>[];
    const lines: string[] = [];

    for (const row of rows) {
      let line = '';
      for (const col of opts.columns) {
        const [start, end] = resolveColumnRange(col);
        const width = end - start;
        const val = String(row[col.name] ?? '').padEnd(width, padding).slice(0, width);
        line += val;
      }
      lines.push(line);
    }

    return lines.join('\n');
  }

  getMimeType(): string {
    return 'text/plain';
  }
}
