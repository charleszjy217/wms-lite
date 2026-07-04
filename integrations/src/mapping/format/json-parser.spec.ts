import { describe, it, expect } from 'vitest';
import { JsonFormatParser } from './json-parser.js';

describe('JsonFormatParser', () => {
  const parser = new JsonFormatParser();

  it('should parse JSON string', async () => {
    const result = await parser.parse('{"sku":"ABC-123","name":"Test","active":true}');
    expect(result).toEqual({ sku: 'ABC-123', name: 'Test', active: true });
  });

  it('should parse JSON from Buffer', async () => {
    const buf = Buffer.from('{"key":"value"}', 'utf-8');
    const result = await parser.parse(buf);
    expect(result).toEqual({ key: 'value' });
  });

  it('should serialize object to JSON string', async () => {
    const result = await parser.serialize({ sku: 'ABC', name: 'Test' });
    expect(result).toBe('{"sku":"ABC","name":"Test"}');
  });

  it('should pretty-print when option is set', async () => {
    const result = await parser.serialize({ a: 1, b: 2 }, { pretty: true });
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('should support reviver in parse', async () => {
    const result = await parser.parse<{ date: string }>('{"date":"2024-01-15"}', {
      reviver: (key, val) => key === 'date' ? new Date(val as string) : val,
    });
    expect(result.date).toBeInstanceOf(Date);
    expect((result.date as Date).toISOString()).toContain('2024-01-15');
  });

  it('should get correct MIME type', () => {
    expect(parser.getMimeType()).toBe('application/json');
  });

  it('should handle arrays', async () => {
    const result = await parser.parse('[{"id":1},{"id":2}]');
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(2);
  });

  it('should throw on invalid JSON', async () => {
    await expect(parser.parse('not-json')).rejects.toThrow();
  });

  it('should handle null values in serialization', async () => {
    const result = await parser.serialize({ a: null, b: undefined });
    expect(result).toBe('{"a":null}');
  });
});
