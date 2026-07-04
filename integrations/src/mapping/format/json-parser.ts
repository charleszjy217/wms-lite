// ============================================================================
// JSON format parser / serializer
// ============================================================================

import type { FormatParser, ParseOptions, SerializeOptions } from '../../connector/interfaces.js';
import type { JsonParseOptions, JsonSerializeOptions } from './types.js';

export class JsonFormatParser implements FormatParser {
  readonly name = 'json';
  readonly format = 'JSON' as const;

  async parse<T = unknown>(data: string | Buffer, options?: ParseOptions): Promise<T> {
    const opts = (options ?? {}) as JsonParseOptions;
    const text = typeof data === 'string' ? data : data.toString(opts.encoding ?? 'utf-8');
    return JSON.parse(text, opts.reviver) as T;
  }

  async serialize<T = unknown>(data: T, options?: SerializeOptions): Promise<string> {
    const opts = (options ?? {}) as JsonSerializeOptions;
    const spaces = opts.pretty ? (opts.spaces ?? 2) : undefined;
    return JSON.stringify(data, opts.replacer as ((key: string, value: unknown) => unknown) | undefined, spaces);
  }

  getMimeType(): string {
    return 'application/json';
  }
}
