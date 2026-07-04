// ============================================================================
// CSV Format Parser — 单元测试
// ============================================================================

import { describe, it, expect } from 'vitest';
import { CsvFormatParser } from './csv.js';

describe('CsvFormatParser', () => {
  const parser = new CsvFormatParser();

  describe('name / format / mime', () => {
    it('should have correct name', () => {
      expect(parser.name).toBe('csv');
    });

    it('should have correct format', () => {
      expect(parser.format).toBe('CSV');
    });

    it('should return correct mime type', () => {
      expect(parser.getMimeType()).toBe('text/csv');
    });
  });

  describe('parse', () => {
    it('should parse CSV string with header', async () => {
      const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
      const result = await parser.parse(csv);
      expect(result).toEqual([
        { name: 'Alice', age: '30', city: 'NYC' },
        { name: 'Bob', age: '25', city: 'LA' },
      ]);
    });

    it('should parse CSV string without header', async () => {
      const csv = 'Alice,30,NYC\nBob,25,LA';
      const result = await parser.parse(csv, { hasHeader: false });
      expect(result).toEqual([
        { field_0: 'Alice', field_1: '30', field_2: 'NYC' },
        { field_0: 'Bob', field_1: '25', field_2: 'LA' },
      ]);
    });

    it('should handle quoted fields', async () => {
      const csv = 'name,desc\nAlice,"Hello, World"\nBob,"She said ""hi"""';
      const result = await parser.parse(csv);
      expect(result).toEqual([
        { name: 'Alice', desc: 'Hello, World' },
        { name: 'Bob', desc: 'She said "hi"' },
      ]);
    });

    it('should handle custom delimiter', async () => {
      const csv = 'name;age\nAlice;30';
      const result = await parser.parse(csv, { delimiter: ';' });
      expect(result).toEqual([{ name: 'Alice', age: '30' }]);
    });

    it('should return empty array for empty input', async () => {
      const result = await parser.parse('');
      expect(result).toEqual([]);
    });

    it('should parse Buffer input', async () => {
      const buf = Buffer.from('x,y\n1,2', 'utf-8');
      const result = await parser.parse(buf);
      expect(result).toEqual([{ x: '1', y: '2' }]);
    });
  });

  describe('serialize', () => {
    it('should serialize records to CSV', async () => {
      const data = [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ];
      const result = await parser.serialize(data);
      expect(result).toBe('name,age\nAlice,30\nBob,25\n');
    });

    it('should omit header when includeHeader=false', async () => {
      const data = [{ name: 'Alice', age: '30' }];
      const result = await parser.serialize(data, { includeHeader: false });
      expect(result).toBe('Alice,30\n');
    });

    it('should escape fields with delimiters', async () => {
      const data = [{ name: 'Alice', desc: 'Hello, World' }];
      const result = await parser.serialize(data);
      expect(result).toBe('name,desc\nAlice,"Hello, World"\n');
    });

    it('should return empty string for empty data', async () => {
      const result = await parser.serialize([]);
      expect(result).toBe('');
    });
  });

  describe('validate', () => {
    it('should return true for valid record array', () => {
      expect(parser.validate?.([{ a: 1 }])).toBe(true);
    });

    it('should return false for non-array', () => {
      expect(parser.validate?.('string')).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(parser.validate?.([])).toBe(false);
    });
  });
});
