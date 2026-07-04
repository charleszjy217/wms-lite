import { describe, it, expect } from 'vitest';
import { XmlFormatParser } from './xml-parser.js';

describe('XmlFormatParser', () => {
  const parser = new XmlFormatParser();

  it('should parse a simple XML element', async () => {
    const xml = '<root><name>Test</name><value>123</value></root>';
    const result = await parser.parse<Record<string, unknown>>(xml);
    expect(result).toBeDefined();
    // The parser wraps the root content
    expect(result.name).toBe('Test');
    expect(result.value).toBe('123');
  });

  it('should parse attributes', async () => {
    const xml = '<root><item id="1" active="true">Hello</item></root>';
    const result = await parser.parse<Record<string, unknown>>(xml);
    expect(result.item).toBeDefined();
  });

  it('should parse nested elements', async () => {
    const xml = '<root><product><sku>A1</sku><name>Item</name></product></root>';
    const result = await parser.parse<Record<string, unknown>>(xml);
    expect(result.product).toBeDefined();
    const product = result.product as Record<string, unknown>;
    expect(product.sku).toBe('A1');
    expect(product.name).toBe('Item');
  });

  it('should parse XML with multiple children', async () => {
    const xml = '<root><item>a</item><item>b</item><item>c</item></root>';
    const result = await parser.parse<Record<string, unknown>>(xml);
    // collapseArrays:true should keep arrays when >1
    expect(result.item).toBeDefined();
    expect(Array.isArray(result.item)).toBe(true);
    expect((result.item as string[]).length).toBe(3);
  });

  it('should serialize simple object to XML', async () => {
    const result = await parser.serialize({ name: 'Test', value: '123' }, { rootName: 'root' });
    expect(result).toContain('<root>');
    expect(result).toContain('<name>Test</name>');
    expect(result).toContain('<value>123</value>');
    expect(result).toContain('</root>');
  });

  it('should serialize arrays', async () => {
    const data = { items: ['a', 'b', 'c'] };
    const result = await parser.serialize(data, { rootName: 'root' });
    expect(result).toContain('<items>a</items>');
    expect(result).toContain('<items>b</items>');
    expect(result).toContain('<items>c</items>');
  });

  it('should get correct MIME type', () => {
    expect(parser.getMimeType()).toBe('application/xml');
  });

  it('should parse self-closing element', async () => {
    const xml = '<root><empty/><item v="1"/></root>';
    const result = await parser.parse<Record<string, unknown>>(xml);
    expect(result).toBeDefined();
  });

  it('should handle empty content', async () => {
    const xml = '<root></root>';
    const result = await parser.parse<Record<string, unknown>>(xml);
    expect(result).toBeDefined();
  });

  it('should parse Buffer input', async () => {
    const buf = Buffer.from('<r><x>y</x></r>', 'utf-8');
    const result = await parser.parse<Record<string, unknown>>(buf);
    expect(result.x).toBe('y');
  });

  it('should pretty-print XML', async () => {
    const result = await parser.serialize({ a: '1' }, { rootName: 'r', pretty: true });
    expect(result).toContain('\n');
  });
});
