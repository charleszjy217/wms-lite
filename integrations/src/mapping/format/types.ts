// ============================================================================
// Format-layer shared types
// ============================================================================

/** Options for parsing fixed-width records */
export interface FixedWidthColumnDef {
  /** column name */
  name: string;
  /** start position (0‑based inclusive) */
  start: number;
  /** end position (0‑based exclusive), or width */
  end?: number;
  /** alternative to end – column width */
  width?: number;
  /** optional trim mode */
  trim?: 'left' | 'right' | 'both' | 'none';
  /** optional type cast */
  type?: 'string' | 'number' | 'boolean';
}

export interface FixedWidthParseOptions {
  columns: FixedWidthColumnDef[];
  encoding?: BufferEncoding;
  skipHeader?: boolean;
}

export interface FixedWidthSerializeOptions {
  columns: FixedWidthColumnDef[];
  padding?: string;
}

/** Options for CSV parsing / serialization */
export interface CsvParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  quoteChar?: string;
  encoding?: BufferEncoding;
}

export interface CsvSerializeOptions {
  delimiter?: string;
  quoteChar?: string;
  header?: string[];
  encoding?: BufferEncoding;
}

/** Options for XML parsing */
export interface XmlParseOptions {
  /** whether to collapse single‑element arrays into scalar */
  collapseArrays?: boolean;
  encoding?: BufferEncoding;
}

export interface XmlSerializeOptions {
  rootName?: string;
  pretty?: boolean;
  encoding?: BufferEncoding;
}

/** Options for JSON parsing */
export interface JsonParseOptions {
  encoding?: BufferEncoding;
  reviver?: (key: string, value: unknown) => unknown;
}

export interface JsonSerializeOptions {
  pretty?: boolean;
  replacer?: (key: string, value: unknown) => unknown;
  spaces?: number;
}
