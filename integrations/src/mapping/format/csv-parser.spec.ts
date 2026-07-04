import { describe, it, expect } from 'vitest';
import { CsvFormatParser } from './csv-parser.js';

describe('CsvFormatParser', () => {
  const parser = new CsvFormatParser();

  it('should parse CSV with header', async () => {
    const csv = 'sku,name,price\nA1,Item One,10.5\nA2,Item Two,20.0';
    const result = await parser.parse<Record<string, string>[]>(csv);
    expect(result.length).toBe(2);
    expect(result[0].sku).toBe('A1');
    expect(result[0].name).toBe('Item One');
    expect(result[0].price).toBe('10.5');
  });

  it('should parse CSV without header', async () => {
    const csv = 'A1,Item One,10.5\nA2,Item Two,20.0';
    const result = await parser.parse<Record<string, string>[]>(csv, { hasHeader: false });
    expect(result.length).toBe(2);
    expect(result[0]['0']).toBe('A1');
    expect(result[0]['1']).toBe('Item One');
  });

  it('should handle quoted fields', async () => {
    const csv = 'sku,description\nA1,"Item with, comma"\nA2,"Quoted ""value"" here"';
    const result = await parser.parse<Record<string, string>[]>(csv);
    expect(result[0].description).toBe('Item with, comma');
    expect(result[1].description).toBe('Quoted "value" here');
  });

  it('should handle custom delimiter', async () => {
    const csv = 'sku|name|price\nA1|Item|10';
    const result = await parser.parse<Record<string, string>[]>(csv, { delimiter: '|' });
    expect(result[0].sku).toBe('A1');
    expect(result[0].name).toBe('Item');
  });

  it('should serialize records to CSV', async () => {
    const data = [
      { sku: 'A1', name: 'Item One', price: '10.5' },
      { sku: 'A2', name: 'Item Two', price: '20.0' },
    ];
    const result = await parser.serialize(data);
    const lines = result.split('\n');
    expect(lines[0]).toBe('sku,name,price');
    expect(lines[1]).toBe('A1,Item One,10.5');
    expect(lines[2]).toBe('A2,Item Two,20.0');
  });

  it('should serialize with custom header order', async () => {
    const data = [
      { sku: 'A1', name: 'Item', price: '10' },
    ];
    const result = await parser.serialize(data, { header: ['name', 'sku'] });
    const lines = result.split('\n');
    expect(lines[0]).toBe('name,sku');
    expect(lines[1]).toBe('Item,A1');
  });

  it('should quote fields containing delimiter during serialization', async () => {
    const data = [{ desc: 'hello, world' }];
    const result = await parser.serialize(data);
    expect(result).toContain('"hello, world"');
  });

  it('should get correct MIME type', () => {
    expect(parser.getMimeType()).toBe('text/csv');
  });

  it('should handle empty CSV', async () => {
    const result = await parser.parse('');
    expect(result).toEqual([]);
  });

  it('should throw when serializing non-array', async () => {
    await expect(parser.serialize({})).rejects.toThrow();
  });

  it('should handle Buffer input', async () => {
    const buf = Buffer.from('k,v\na,1\nb,2', 'utf-8');
    const result = await parser.parse<Record<string, string>[]>(buf);
    expect(result.length).toBe(2);
  });
});
