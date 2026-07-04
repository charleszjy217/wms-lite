import { describe, it, expect } from 'vitest';
import { FixedWidthFormatParser } from './fixed-width-parser.js';
import type { FixedWidthColumnDef } from './types.js';

describe('FixedWidthFormatParser', () => {
  const parser = new FixedWidthFormatParser();

  // "ABC-123   Item One             10.50   Y"  length=40
  const columns: FixedWidthColumnDef[] = [
    { name: 'sku', start: 0, width: 10, trim: 'right', type: 'string' },
    { name: 'name', start: 10, width: 20, trim: 'right', type: 'string' },
    { name: 'price', start: 30, width: 9, trim: 'both', type: 'number' },
    { name: 'active', start: 39, width: 1, trim: 'both', type: 'boolean' },
  ];

  it('should parse fixed-width data', async () => {
    const data = 'ABC-123   Item One             10.50   Y\nXYZ-789   Item Two             20.00   N';
    const result = await parser.parse<Record<string, unknown>[]>(data, { columns });
    expect(result.length).toBe(2);
    expect(result[0].sku).toBe('ABC-123');
    expect(result[0].name).toBe('Item One');
    expect(result[0].price).toBe(10.5);
    expect(result[0].active).toBe(true);
  });

  it('should skip header line when configured', async () => {
    const data = 'SKU       Name                  Price   A\nABC-123   Item One             10.50   Y';
    const result = await parser.parse<Record<string, unknown>[]>(data, { columns, skipHeader: true });
    expect(result.length).toBe(1);
    expect(result[0].sku).toBe('ABC-123');
  });

  it('should serialize records to fixed-width', async () => {
    const records = [
      { sku: 'ABC', name: 'Test', price: '10.5', active: 'Y' },
    ];
    const result = await parser.serialize(records, { columns });
    expect(result.length).toBeGreaterThan(0);
    // Each line should be at least 39 chars (last column ends at 39)
    const lines = result.split('\n');
    expect(lines[0].length).toBeGreaterThanOrEqual(39);
  });

  it('should get correct MIME type', () => {
    expect(parser.getMimeType()).toBe('text/plain');
  });

  it('should throw when serializing non-array', async () => {
    await expect(parser.serialize({}, { columns })).rejects.toThrow();
  });

  it('should handle Buffer input', async () => {
    const buf = Buffer.from('ABC       Item', 'utf-8');
    const result = await parser.parse<Record<string, unknown>[]>(buf, {
      columns: [{ name: 'sku', start: 0, width: 10, trim: 'right' }],
    });
    expect(result[0].sku).toBe('ABC');
  });

  it('should support column definitions with "end" instead of "width"', async () => {
    const cols: FixedWidthColumnDef[] = [
      { name: 'code', start: 0, end: 5, trim: 'both' },
    ];
    const data = 'ABCDE';
    const result = await parser.parse<Record<string, unknown>[]>(data, { columns: cols });
    expect(result[0].code).toBe('ABCDE');
  });
});
