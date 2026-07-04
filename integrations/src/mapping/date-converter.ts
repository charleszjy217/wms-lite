// ============================================================================
// Date/time format conversion
// ============================================================================

export type DatePrecision = 'date' | 'datetime' | 'time' | 'datetime-millis';

/**
 * Format tokens used for pattern-based parsing/formatting.
 *
 *   YYYY  → 4-digit year
 *   YY    → 2-digit year
 *   MM    → 2-digit month (01-12)
 *   DD    → 2-digit day (01-31)
 *   HH    → 2-digit hours (00-23)
 *   mm    → 2-digit minutes (00-59)
 *   ss    → 2-digit seconds (00-59)
 *   SSS   → milliseconds
 *   TZD   → timezone designator (Z or ±HH:mm)
 */
type FormatToken = 'YYYY' | 'YY' | 'MM' | 'DD' | 'HH' | 'mm' | 'ss' | 'SSS' | 'TZD';

export interface DateConversionRule {
  /** Source pattern, e.g. "DD/MM/YYYY" */
  fromPattern: string;
  /** Target pattern, e.g. "YYYY-MM-DD" */
  toPattern: string;
  /** Optional: source timezone offset in minutes (e.g. 480 for UTC+8) */
  sourceTimezoneOffset?: number;
  /** Optional: target timezone offset in minutes */
  targetTimezoneOffset?: number;
}

const TOKEN_REGEX: Record<FormatToken, RegExp> = {
  YYYY: /YYYY/,
  YY: /YY(?!YY)/,
  MM: /MM/,
  DD: /DD/,
  HH: /HH/,
  mm: /mm/,
  ss: /ss/,
  SSS: /SSS/,
  TZD: /TZD/,
};

function extractValue(dateStr: string, pattern: string, token: FormatToken): string | null {
  const idx = pattern.indexOf(token);
  if (idx === -1) return null;
  return dateStr.substring(idx, idx + token.length);
}

function buildFromPattern(date: Date, pattern: string): string {
  const y = date.getFullYear();
  const M = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const ms = date.getMilliseconds();

  const pad = (n: number, len: number) => String(n).padStart(len, '0');

  let result = pattern;
  result = result.replace('YYYY', String(y));
  result = result.replace('YY', String(y).slice(-2));
  result = result.replace('MM', pad(M, 2));
  result = result.replace('DD', pad(d, 2));
  result = result.replace('HH', pad(h, 2));
  result = result.replace('mm', pad(m, 2));
  result = result.replace('ss', pad(s, 2));
  result = result.replace('SSS', pad(ms, 3));

  // timezone
  const tzOffset = -date.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60), 2);
  const tzMins = pad(Math.abs(tzOffset) % 60, 2);
  result = result.replace('TZD', `${tzSign}${tzHours}:${tzMins}`);

  return result;
}

function parseUsingPattern(dateStr: string, pattern: string): Date | null {
  // Extract values directly from the string by matching token positions in the pattern
  const tokens: { token: FormatToken; start: number }[] = [];
  const sortedTokens: FormatToken[] = ['YYYY', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss', 'SSS', 'TZD'];

  let i = 0;
  while (i < pattern.length) {
    let matched = false;
    for (const token of sortedTokens) {
      if (pattern.startsWith(token, i)) {
        tokens.push({ token, start: i });
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      i++; // skip literal character
    }
  }

  if (tokens.length === 0) return null;

  const vals: Record<string, string> = {};
  for (const { token, start } of tokens) {
    // The value starts at the same position in the date string
    // and spans the token length
    const end = start + token.length;
    vals[token] = dateStr.slice(start, end);
  }

  const year = vals['YYYY'] ? parseInt(vals['YYYY'], 10) : vals['YY'] ? 2000 + parseInt(vals['YY'], 10) : 1970;
  const rawMonth = vals['MM'] ? parseInt(vals['MM'], 10) : -1;
  const day = vals['DD'] ? parseInt(vals['DD'], 10) : 1;
  const hours = vals['HH'] ? parseInt(vals['HH'], 10) : 0;
  const minutes = vals['mm'] ? parseInt(vals['mm'], 10) : 0;
  const seconds = vals['ss'] ? parseInt(vals['ss'], 10) : 0;
  const millis = vals['SSS'] ? parseInt(vals['SSS'], 10) : 0;

  // Validate extracted values
  if (Number.isNaN(year) || Number.isNaN(day) || Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }
  if (rawMonth !== -1 && (Number.isNaN(rawMonth) || rawMonth < 1 || rawMonth > 12)) {
    return null;
  }

  const month = rawMonth === -1 ? 0 : rawMonth - 1;

  // Build using UTC to avoid timezone shifts when converting to ISO
  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds, millis));
  // Verify the date is valid (e.g., day 32 in Jan would roll over)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export class DateConverter {
  private rules: DateConversionRule[] = [];

  /**
   * Register a date conversion rule.
   */
  addRule(rule: DateConversionRule): void {
    this.rules.push(rule);
  }

  /**
   * Register multiple rules.
   */
  addRules(rules: DateConversionRule[]): void {
    this.rules.push(...rules);
  }

  /**
   * Convert a date string from one format to another using a registered rule.
   * If a rule matches the fromPattern and toPattern, it applies.
   */
  convert(dateStr: string, fromPattern: string, toPattern: string): string {
    const parsed = parseUsingPattern(dateStr, fromPattern);
    if (!parsed) {
      throw new Error(`Unable to parse date string "${dateStr}" with pattern "${fromPattern}"`);
    }
    return buildFromPattern(parsed, toPattern);
  }

  /**
   * Auto-detect the best matching rule and convert.
   * Tries all registered rules where fromPattern matches.
   */
  convertAuto(dateStr: string): string {
    for (const rule of this.rules) {
      try {
        const parsed = parseUsingPattern(dateStr, rule.fromPattern);
        if (parsed) {
          return buildFromPattern(parsed, rule.toPattern);
        }
      } catch {
        continue;
      }
    }
    throw new Error(`No matching conversion rule for date string "${dateStr}"`);
  }

  /**
   * Convert an ISO 8601 string to a target pattern.
   */
  fromIso(isoStr: string, toPattern: string): string {
    const parsed = new Date(isoStr);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid ISO date string: "${isoStr}"`);
    }
    return buildFromPattern(parsed, toPattern);
  }

  /**
   * Convert a date string to ISO 8601.
   */
  toIso(dateStr: string, fromPattern: string): string {
    const parsed = parseUsingPattern(dateStr, fromPattern);
    if (!parsed) {
      throw new Error(`Unable to parse date string "${dateStr}" with pattern "${fromPattern}"`);
    }
    return parsed.toISOString();
  }

  /**
   * Get the current date/time formatted with a given pattern.
   */
  now(pattern: string): string {
    return buildFromPattern(new Date(), pattern);
  }
}

export { parseUsingPattern as internalParseDate, buildFromPattern as internalFormatDate };
