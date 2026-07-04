// ============================================================================
// XML format parser / serializer  (no external dependencies)
// ============================================================================

import type { FormatParser, ParseOptions, SerializeOptions } from '../../connector/interfaces.js';
import type { XmlParseOptions, XmlSerializeOptions } from './types.js';

// --------------------------------------------------------------------------
// Minimal well‑formed XML tokeniser / parser  (RFC-compatible subset)
// --------------------------------------------------------------------------

interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: (XmlElement | string)[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Minimal tokeniser.  Returns a flat array of tokens.
 */
function tokenize(xml: string): { type: 'open' | 'close' | 'text' | 'selfclose'; tag?: string; attrs?: Record<string, string>; text?: string }[] {
  const tokens: ReturnType<typeof tokenize> = [];
  const re = /<(\/?)([\w:-]+)([^>]*?)(\/?)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    // character content before this tag
    if (match.index > lastIndex) {
      const text = xml.slice(lastIndex, match.index);
      if (text.trim()) tokens.push({ type: 'text', text });
    }
    const [, slash, tag, attrsRaw, selfClose] = match;
    const attrs: Record<string, string> = {};
    const attrRe = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrsRaw)) !== null) {
      attrs[am[1]] = am[2];
    }
    if (selfClose === '/') {
      tokens.push({ type: 'selfclose', tag, attrs });
    } else if (slash === '/') {
      tokens.push({ type: 'close', tag });
    } else {
      tokens.push({ type: 'open', tag, attrs });
    }
    lastIndex = match.index + match[0].length;
  }
  // trailing text
  if (lastIndex < xml.length) {
    const text = xml.slice(lastIndex);
    if (text.trim()) tokens.push({ type: 'text', text });
  }
  return tokens;
}

/**
 * Build a tree from tokens.
 */
function buildTree(tokens: ReturnType<typeof tokenize>, collapseArrays: boolean): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: { obj: Record<string, unknown>; tag: string }[] = [];
  let current = root;

  for (const tok of tokens) {
    if (tok.type === 'open' || tok.type === 'selfclose') {
      const el: Record<string, unknown> = { __text: undefined };
      if (tok.attrs && Object.keys(tok.attrs).length > 0) {
        el.__attrs = tok.attrs;
      }
      const tag = tok.tag!;

      if (tok.type === 'selfclose') {
        // append self-closing element to current
        _append(current, tag, el, collapseArrays);
        continue;
      }

      // open tag – push stack
      stack.push({ obj: current, tag });
      // Append element using _append to handle repeated tags
      _append(current, tag, el, collapseArrays);
      current = el;
    } else if (tok.type === 'close') {
      if (stack.length > 0) {
        const prev = stack.pop()!;
        // if current has only __text and no __attrs, fold it into parent
        const keys = Object.keys(current).filter((k) => k !== '__attrs');
        if (keys.length === 1 && keys[0] === '__text' && typeof current.__text === 'string') {
          const textVal = current.__text as string;
          // The parent may have stored the element as a scalar (collapseArrays=true, single child)
          // or as an array (multiple children)
          const parentVal = prev.obj[prev.tag];
          if (Array.isArray(parentVal)) {
            // Replace the last element (our element) with the text
            parentVal[parentVal.length - 1] = textVal;
          } else if (parentVal && typeof parentVal === 'object' && '__text' in (parentVal as Record<string, unknown>)) {
            // Single element stored as object - replace with text
            prev.obj[prev.tag] = textVal;
          }
        }
        current = prev.obj;
      }
    } else if (tok.type === 'text') {
      const existing = current.__text;
      current.__text = existing ? existing + tok.text : tok.text;
    }
  }

  return _postProcess(root, collapseArrays);
}

function _append(parent: Record<string, unknown>, key: string, val: unknown, collapseArrays: boolean): void {
  if (!(key in parent)) {
    parent[key] = collapseArrays ? val : [val];
  } else {
    const existing = parent[key];
    if (Array.isArray(existing)) {
      (existing as unknown[]).push(val);
    } else {
      parent[key] = [existing, val];
    }
  }
}

function _postProcess(obj: Record<string, unknown>, collapseArrays: boolean): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === '__text') continue;
    if (key === '__attrs') continue;

    if (Array.isArray(val)) {
      const processed = val.map((v) => {
        if (typeof v === 'object' && v !== null) {
          const p = _postProcess(v as Record<string, unknown>, collapseArrays);
          // promote single value
          const keys = Object.keys(p).filter((k) => k !== '__attrs');
          if (keys.length === 0 && p.__attrs) {
            return p;
          }
          return p;
        }
        return v;
      });
      if (collapseArrays && processed.length === 1) {
        result[key] = processed[0];
      } else {
        result[key] = processed;
      }
    } else if (typeof val === 'object' && val !== null) {
      result[key] = _postProcess(val as Record<string, unknown>, collapseArrays);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function objToXml(obj: unknown, rootName: string, pretty: boolean, depth: number): string {
  const indent = (d: number) => (pretty ? '  '.repeat(d) : '');
  const nl = pretty ? '\n' : '';

  if (typeof obj !== 'object' || obj === null) {
    return indent(depth) + `<${rootName}>${escapeXml(String(obj))}</${rootName}>`;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => objToXml(item, rootName, pretty, depth)).join(nl);
  }

  const record = obj as Record<string, unknown>;
  let xml = '';

  // attributes
  const attrs = record.__attrs as Record<string, string> | undefined;
  const attrStr = attrs ? ' ' + Object.entries(attrs).map(([k, v]) => `${k}="${escapeXml(v)}"`).join(' ') : '';

  // text content only
  const keys = Object.keys(record).filter((k) => k !== '__attrs');
  if (keys.length === 1 && keys[0] === '__text') {
    return indent(depth) + `<${rootName}${attrStr}>${escapeXml(String(record.__text))}</${rootName}>`;
  }

  xml += indent(depth) + `<${rootName}${attrStr}>` + nl;
  for (const key of keys) {
    if (key === '__text') {
      xml += indent(depth + 1) + escapeXml(String(record.__text)) + nl;
    } else {
      const val = record[key];
      const children = Array.isArray(val) ? val : [val];
      for (const child of children) {
        xml += objToXml(child, key, pretty, depth + 1) + nl;
      }
    }
  }
  xml += indent(depth) + `</${rootName}>`;
  return xml;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export class XmlFormatParser implements FormatParser {
  readonly name = 'xml';
  readonly format = 'XML' as const;

  async parse<T = unknown>(data: string | Buffer, options?: ParseOptions): Promise<T> {
    const opts = (options ?? {}) as XmlParseOptions;
    const text = typeof data === 'string' ? data : data.toString(opts.encoding ?? 'utf-8');
    const tokens = tokenize(text);
    const collapse = opts.collapseArrays ?? true;
    const tree = buildTree(tokens, collapse);

    // The top-level object will contain the root tag as the only key.
    // We return the content of the root tag.
    const keys = Object.keys(tree);
    if (keys.length === 1) {
      return tree[keys[0]] as T;
    }
    return tree as T;
  }

  async serialize<T = unknown>(data: T, options?: SerializeOptions): Promise<string> {
    const opts = (options ?? {}) as XmlSerializeOptions;
    const rootName = opts.rootName ?? 'root';
    const pretty = opts.pretty ?? false;
    return objToXml(data, rootName, pretty, 0);
  }

  getMimeType(): string {
    return 'application/xml';
  }
}
