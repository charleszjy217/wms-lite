import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator, type SchemaDefinition } from './schema-validator.js';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  const productSchema: SchemaDefinition = {
    name: 'canonical-product',
    version: '1.0.0',
    allowExtraFields: true,
    fields: [
      { name: 'sku', type: 'string', required: true, minLength: 1, maxLength: 64 },
      { name: 'name', type: 'string', required: true, maxLength: 256 },
      { name: 'active', type: 'boolean', required: true },
      { name: 'price', type: 'number', min: 0, max: 999999 },
      { name: 'quantity', type: 'integer', min: 0 },
      { name: 'category', type: 'string', enum: ['A', 'B', 'C'] },
    ],
  };

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('should register a schema', () => {
    validator.register(productSchema);
    expect(validator.hasSchema('canonical-product')).toBe(true);
  });

  it('should validate valid data', () => {
    validator.register(productSchema);
    const data = {
      sku: 'ABC-123',
      name: 'Test Product',
      active: true,
      price: 10.5,
      quantity: 100,
    };
    const errors = validator.validate('canonical-product', data);
    expect(errors).toEqual([]);
  });

  it('should detect missing required fields', () => {
    validator.register(productSchema);
    const data = { name: 'Test' }; // missing sku and active
    const errors = validator.validate('canonical-product', data);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.field === 'sku')).toBe(true);
    expect(errors.some((e) => e.field === 'active')).toBe(true);
  });

  it('should detect type mismatches', () => {
    validator.register(productSchema);
    const data = { sku: 'A1', name: 'Test', active: 'yes' }; // active should be boolean
    const errors = validator.validate('canonical-product', data);
    expect(errors.some((e) => e.field === 'active' && e.message.includes('boolean'))).toBe(true);
  });

  it('should detect enum violations', () => {
    validator.register(productSchema);
    const data = { sku: 'A1', name: 'Test', active: true, category: 'Z' };
    const errors = validator.validate('canonical-product', data);
    expect(errors.some((e) => e.field === 'category' && e.message.includes('enum'))).toBe(true);
  });

  it('should detect range violations (min/max)', () => {
    validator.register(productSchema);
    const data = { sku: 'A1', name: 'Test', active: true, price: -10 };
    const errors = validator.validate('canonical-product', data);
    expect(errors.some((e) => e.field === 'price' && e.message.includes('less than minimum'))).toBe(true);
  });

  it('should detect string length violations', () => {
    validator.register(productSchema);
    const data = { sku: '', name: 'Test', active: true }; // sku too short
    const errors = validator.validate('canonical-product', data);
    expect(errors.some((e) => e.field === 'sku' && e.message.includes('length'))).toBe(true);
  });

  it('should detect string pattern violations', () => {
    const schema: SchemaDefinition = {
      name: 'test',
      fields: [
        { name: 'code', type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' },
      ],
    };
    validator.register(schema);
    expect(validator.validate('test', { code: 'abc-123' }).length).toBeGreaterThan(0);
    expect(validator.validate('test', { code: 'ABC-1234' }).length).toBe(0);
  });

  it('should handle nested object fields', () => {
    const schema: SchemaDefinition = {
      name: 'order',
      fields: [
        { name: 'id', type: 'string', required: true },
        {
          name: 'customer',
          type: 'object',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'string' },
          ],
        },
      ],
    };
    validator.register(schema);
    const errors = validator.validate('order', { id: '1', customer: { name: 'John' } });
    expect(errors).toEqual([]);

    const errors2 = validator.validate('order', { id: '1', customer: {} });
    expect(errors2.some((e) => e.field === 'customer.name')).toBe(true);
  });

  it('should detect extra fields in strict mode', () => {
    const schema: SchemaDefinition = {
      name: 'strict',
      allowExtraFields: false,
      fields: [
        { name: 'id', type: 'string' },
      ],
    };
    validator.register(schema);
    const errors = validator.validate('strict', { id: '1', extraField: 'bad' });
    expect(errors.some((e) => e.message.includes('Unexpected field'))).toBe(true);
  });

  it('should throw when schema not found', () => {
    expect(() => validator.validate('nonexistent', {})).toThrow('No schema registered');
  });

  it('should validate inline without registering', () => {
    const errors = validator.validateInline(productSchema, {
      sku: 'A1',
      name: 'Test',
      active: true,
    });
    expect(errors).toEqual([]);
  });

  it('should support custom validator function', () => {
    const schema: SchemaDefinition = {
      name: 'custom',
      fields: [
        {
          name: 'value',
          type: 'number',
          validate: (val) => (val as number) > 100 ? 'Value must be at most 100' : null,
        },
      ],
    };
    validator.register(schema);
    expect(validator.validate('custom', { value: 50 }).length).toBe(0);
    expect(validator.validate('custom', { value: 200 }).length).toBe(1);
  });

  it('should unregister a schema', () => {
    validator.register(productSchema);
    expect(validator.unregister('canonical-product')).toBe(true);
    expect(validator.hasSchema('canonical-product')).toBe(false);
  });
});
