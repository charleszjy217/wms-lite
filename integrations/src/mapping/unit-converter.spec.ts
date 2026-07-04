import { describe, it, expect, beforeEach } from 'vitest';
import { UnitConverter } from './unit-converter.js';

describe('UnitConverter', () => {
  let converter: UnitConverter;

  beforeEach(() => {
    converter = new UnitConverter();
  });

  it('should convert between units of the same category', () => {
    expect(converter.convert(1, 'kg', 'g')).toBe(1000);
    expect(converter.convert(1000, 'g', 'kg')).toBe(1);
    expect(converter.convert(1, 'L', 'mL')).toBe(1000);
    expect(converter.convert(1, 'm', 'cm')).toBe(100);
  });

  it('should convert weight units', () => {
    expect(converter.convert(2.5, 'kg', 'lb')).toBeCloseTo(5.51156, 4);
    expect(converter.convert(16, 'oz', 'lb')).toBeCloseTo(1, 4);
    expect(converter.convert(1, 't', 'kg')).toBe(1000);
  });

  it('should convert volume units', () => {
    expect(converter.convert(1, 'gal', 'L')).toBeCloseTo(3.78541, 4);
  });

  it('should convert temperature units', () => {
    // 0°C = 32°F
    expect(converter.convert(0, '°C', '°F')).toBeCloseTo(32, 4);
    // 100°C = 212°F
    expect(converter.convert(100, '°C', '°F')).toBeCloseTo(212, 4);
    // 32°F = 0°C
    expect(converter.convert(32, '°F', '°C')).toBeCloseTo(0, 4);
    // 0°C = 273.15K
    expect(converter.convert(0, '°C', 'K')).toBeCloseTo(273.15, 4);
  });

  it('should throw when converting between different categories', () => {
    expect(() => converter.convert(1, 'kg', 'L')).toThrow('Cannot convert between');
  });

  it('should throw for unknown units', () => {
    expect(() => converter.convert(1, 'unknown', 'g')).toThrow('Unknown unit');
    expect(() => converter.convert(1, 'g', 'unknown')).toThrow('Unknown unit');
  });

  it('should register custom units', () => {
    // 20 custom_boxes = 1 pc → factor=20 (because base=value/factor)
    converter.register({ code: 'custom_box', category: 'count', factor: 20, label: 'Custom Box' });
    expect(converter.hasUnit('custom_box')).toBe(true);
    expect(converter.convert(20, 'custom_box', 'pc')).toBe(1);
  });

  it('should get base unit for a category', () => {
    expect(converter.getBaseUnit('weight')).toBe('g');
    expect(converter.getBaseUnit('volume')).toBe('L');
    expect(converter.getBaseUnit('length')).toBe('m');
  });

  it('should list all units', () => {
    const units = converter.listUnits();
    expect(units).toContain('kg');
    expect(units).toContain('L');
    expect(units).toContain('m');
    expect(units).toContain('°C');
  });

  it('should list units by category', () => {
    const weightUnits = converter.listUnitsByCategory('weight');
    expect(weightUnits).toContain('kg');
    expect(weightUnits).toContain('g');
    expect(weightUnits).toContain('lb');
  });

  it('should convert count units', () => {
    expect(converter.convert(12, 'pc', 'doz')).toBe(1);
    expect(converter.convert(1, 'doz', 'pc')).toBe(12);
    expect(converter.convert(2, 'pair', 'pc')).toBe(4);
  });
});
