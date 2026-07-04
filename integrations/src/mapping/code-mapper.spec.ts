import { describe, it, expect, beforeEach } from 'vitest';
import { CodeMapper, type CodeMappingDict } from './code-mapper.js';

describe('CodeMapper', () => {
  let mapper: CodeMapper;

  const statusMapping: CodeMappingDict = {
    sourceSystem: 'ERP_SAP',
    fieldName: 'status',
    strict: true,
    entries: [
      { externalCode: 'A', canonicalCode: 'ACTIVE' },
      { externalCode: 'E', canonicalCode: 'EXPIRED' },
      { externalCode: 'Q', canonicalCode: 'QUARANTINED' },
      { externalCode: 'R', canonicalCode: 'RECALLED' },
    ],
  };

  const movementMapping: CodeMappingDict = {
    sourceSystem: 'ERP_SAP',
    fieldName: 'movementType',
    strict: false,
    defaultCanonical: 'ADJUSTMENT_PLUS',
    entries: [
      { externalCode: '101', canonicalCode: 'RECEIPT' },
      { externalCode: '201', canonicalCode: 'SHIPMENT' },
      { externalCode: '301', canonicalCode: 'TRANSFER' },
    ],
  };

  beforeEach(() => {
    mapper = new CodeMapper();
  });

  it('should register a code mapping', () => {
    mapper.register(statusMapping);
    expect(mapper.hasMapping('ERP_SAP', 'status')).toBe(true);
  });

  it('should convert external code to canonical code', () => {
    mapper.register(statusMapping);
    expect(mapper.toCanonical('ERP_SAP', 'status', 'A')).toBe('ACTIVE');
    expect(mapper.toCanonical('ERP_SAP', 'status', 'E')).toBe('EXPIRED');
    expect(mapper.toCanonical('ERP_SAP', 'status', 'Q')).toBe('QUARANTINED');
    expect(mapper.toCanonical('ERP_SAP', 'status', 'R')).toBe('RECALLED');
  });

  it('should throw on unmapped code in strict mode', () => {
    mapper.register(statusMapping);
    expect(() => mapper.toCanonical('ERP_SAP', 'status', 'X')).toThrow('No mapping for external code');
  });

  it('should return default canonical for unmapped code in non-strict mode', () => {
    mapper.register(movementMapping);
    expect(mapper.toCanonical('ERP_SAP', 'movementType', '999')).toBe('ADJUSTMENT_PLUS');
  });

  it('should pass through unmapped code in non-strict mode when no default', () => {
    const looseMapping: CodeMappingDict = {
      sourceSystem: 'SYS',
      fieldName: 'color',
      strict: false,
      entries: [{ externalCode: 'R', canonicalCode: 'RED' }],
    };
    mapper.register(looseMapping);
    expect(mapper.toCanonical('SYS', 'color', 'B')).toBe('B'); // pass-through
  });

  it('should do reverse mapping (canonical to external)', () => {
    mapper.register(statusMapping);
    expect(mapper.toExternal('ERP_SAP', 'status', 'ACTIVE')).toBe('A');
    expect(mapper.toExternal('ERP_SAP', 'status', 'EXPIRED')).toBe('E');
  });

  it('should throw on reverse unmapped code in strict mode', () => {
    mapper.register(statusMapping);
    expect(() => mapper.toExternal('ERP_SAP', 'status', 'UNKNOWN')).toThrow('No reverse mapping');
  });

  it('should throw when no mapping registered', () => {
    expect(() => mapper.toCanonical('NONE', 'field', 'X')).toThrow('No code mapping found');
  });

  it('should get canonical codes', () => {
    mapper.register(statusMapping);
    const codes = mapper.getCanonicalCodes('ERP_SAP', 'status');
    expect(codes).toEqual(['ACTIVE', 'EXPIRED', 'QUARANTINED', 'RECALLED']);
  });

  it('should load multiple dicts', () => {
    mapper.loadAll([statusMapping, movementMapping]);
    expect(mapper.hasMapping('ERP_SAP', 'status')).toBe(true);
    expect(mapper.hasMapping('ERP_SAP', 'movementType')).toBe(true);
  });

  it('should unregister a mapping', () => {
    mapper.register(statusMapping);
    expect(mapper.unregister('ERP_SAP', 'status')).toBe(true);
    expect(mapper.hasMapping('ERP_SAP', 'status')).toBe(false);
  });
});
