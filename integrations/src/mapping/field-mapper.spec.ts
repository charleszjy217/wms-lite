import { describe, it, expect, beforeEach } from 'vitest';
import { FieldMapper, type FieldMappingConfig } from './field-mapper.js';

describe('FieldMapper', () => {
  let mapper: FieldMapper;

  const productMapping: FieldMappingConfig = {
    sourceSystem: 'ERP_SAP',
    entityType: 'Product',
    rules: [
      { externalField: 'MATNR', canonicalField: 'sku', required: true, transform: [{ type: 'trim' }] },
      { externalField: 'MAKTX', canonicalField: 'name', required: true, transform: [{ type: 'trim' }] },
      { externalField: 'MEINS', canonicalField: 'unit', default: 'pc' },
      { externalField: 'LVORM', canonicalField: 'active', transform: [{ type: 'custom', fn: (v: unknown) => v === 'X' ? false : true }], default: true },
      { externalField: 'EAN11', canonicalField: 'barcode' },
      { externalField: 'BRAND', canonicalField: 'brand' },
    ],
  };

  beforeEach(() => {
    mapper = new FieldMapper();
  });

  it('should register a mapping config', () => {
    mapper.register(productMapping);
    expect(mapper.hasMapping('ERP_SAP', 'Product')).toBe(true);
  });

  it('should throw when mapping without a registered config', () => {
    expect(() => mapper.map('UNKNOWN', 'Product', {})).toThrow('No field mapping found');
  });

  it('should map simple fields', () => {
    mapper.register(productMapping);
    const result = mapper.map('ERP_SAP', 'Product', {
      MATNR: ' ABC-123 ',
      MAKTX: '  Test Product  ',
      MEINS: 'kg',
    });
    expect(result.sku).toBe('ABC-123');
    expect(result.name).toBe('Test Product');
    expect(result.unit).toBe('kg');
  });

  it('should apply default values', () => {
    mapper.register(productMapping);
    const result = mapper.map('ERP_SAP', 'Product', {
      MATNR: 'A1',
      MAKTX: 'Item',
      // MEINS is missing - should use default
    });
    expect(result.unit).toBe('pc');
  });

  it('should throw on missing required field', () => {
    mapper.register(productMapping);
    expect(() => mapper.map('ERP_SAP', 'Product', {
      MAKTX: 'Item',
      // MATNR is missing and required
    })).toThrow('Required field');
  });

  it('should apply custom transform function', () => {
    mapper.register(productMapping);
    const result = mapper.map('ERP_SAP', 'Product', {
      MATNR: 'A1',
      MAKTX: 'Item',
      LVORM: 'X',
    });
    expect(result.active).toBe(false);
  });

  it('should apply string-based custom transform (from JSON)', () => {
    const jsonMapping: FieldMappingConfig = {
      sourceSystem: 'JSON',
      entityType: 'Test',
      rules: [
        { externalField: 'val', canonicalField: 'result', transform: [{ type: 'custom', fn: "v => Number(v) * 2" }] },
      ],
    };
    mapper.register(jsonMapping);
    const result = mapper.map('JSON', 'Test', { val: '21' });
    expect(result.result).toBe(42);
  });

  it('should apply template transform', () => {
    const tmplMapping: FieldMappingConfig = {
      sourceSystem: 'SYS',
      entityType: 'Doc',
      rules: [
        { externalField: 'PREFIX', canonicalField: 'fullCode', transform: [{ type: 'template', template: '{{PREFIX}}-{{NUMBER}}' }] },
      ],
    };
    mapper.register(tmplMapping);
    const result = mapper.map('SYS', 'Doc', { PREFIX: 'PO', NUMBER: '12345' });
    expect(result.fullCode).toBe('PO-12345');
  });

  it('should apply split transform', () => {
    const splitMapping: FieldMappingConfig = {
      sourceSystem: 'SYS',
      entityType: 'Cat',
      rules: [
        { externalField: 'path', canonicalField: 'category', transform: [{ type: 'split', delimiter: '/', index: 0 }] },
      ],
    };
    mapper.register(splitMapping);
    const result = mapper.map('SYS', 'Cat', { path: 'Food/Canned/Beans' });
    expect(result.category).toBe('Food');
  });

  it('should apply chained transforms', () => {
    const chained: FieldMappingConfig = {
      sourceSystem: 'SYS',
      entityType: 'Item',
      rules: [
        {
          externalField: 'code',
          canonicalField: 'sku',
          transform: [
            { type: 'trim' },
            { type: 'upper' },
            { type: 'prefix', value: 'SKU-' },
          ],
        },
      ],
    };
    mapper.register(chained);
    const result = mapper.map('SYS', 'Item', { code: '  abc-123  ' });
    expect(result.sku).toBe('SKU-ABC-123');
  });

  it('should load multiple configs at once', () => {
    const batchMapping: FieldMappingConfig = {
      sourceSystem: 'ERP_SAP',
      entityType: 'Batch',
      rules: [
        { externalField: 'CHARG', canonicalField: 'batchNo', required: true },
      ],
    };
    mapper.loadAll([productMapping, batchMapping]);
    expect(mapper.hasMapping('ERP_SAP', 'Product')).toBe(true);
    expect(mapper.hasMapping('ERP_SAP', 'Batch')).toBe(true);
  });

  it('should unregister a mapping', () => {
    mapper.register(productMapping);
    expect(mapper.unregister('ERP_SAP', 'Product')).toBe(true);
    expect(mapper.hasMapping('ERP_SAP', 'Product')).toBe(false);
  });
});
