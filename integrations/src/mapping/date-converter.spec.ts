import { describe, it, expect, beforeEach } from 'vitest';
import { DateConverter } from './date-converter.js';

describe('DateConverter', () => {
  let converter: DateConverter;

  beforeEach(() => {
    converter = new DateConverter();
  });

  it('should convert date between formats', () => {
    const result = converter.convert('15/01/2024', 'DD/MM/YYYY', 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });

  it('should convert with different patterns', () => {
    // MM/DD/YYYY → YYYY-MM-DD
    const result = converter.convert('01/15/2024', 'MM/DD/YYYY', 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });

  it('should convert with time components', () => {
    const result = converter.convert('2024-01-15 14:30:00', 'YYYY-MM-DD HH:mm:ss', 'DD/MM/YYYY');
    expect(result).toBe('15/01/2024');
  });

  it('should convert from ISO to custom format', () => {
    const result = converter.fromIso('2024-06-15T10:30:00.000Z', 'DD/MM/YYYY');
    expect(result).toBe('15/06/2024');
  });

  it('should convert to ISO format', () => {
    const result = converter.toIso('15/01/2024', 'DD/MM/YYYY');
    expect(result).toContain('2024-01-15');
    expect(result).toContain('T');
  });

  it('should throw on invalid date input', () => {
    expect(() => converter.convert('not-a-date', 'DD/MM/YYYY', 'YYYY-MM-DD')).toThrow('Unable to parse');
  });

  it('should throw on invalid ISO input', () => {
    expect(() => converter.fromIso('not-iso', 'YYYY-MM-DD')).toThrow('Invalid ISO date');
  });

  it('should auto-convert with registered rules', () => {
    converter.addRule({ fromPattern: 'DD/MM/YYYY', toPattern: 'YYYY-MM-DD' });
    converter.addRule({ fromPattern: 'MM/DD/YYYY', toPattern: 'YYYY-MM-DD' });

    expect(converter.convertAuto('15/01/2024')).toBe('2024-01-15');
    expect(converter.convertAuto('01/15/2024')).toBe('2024-01-15');
  });

  it('should throw when auto-convert finds no rule', () => {
    expect(() => converter.convertAuto('15/01/2024')).toThrow('No matching conversion rule');
  });

  it('should add multiple rules at once', () => {
    converter.addRules([
      { fromPattern: 'YYYY/MM/DD', toPattern: 'DD-MM-YYYY' },
      { fromPattern: 'DD-MM-YYYY', toPattern: 'YYYY/MM/DD' },
    ]);
    expect(converter.convert('2024/01/15', 'YYYY/MM/DD', 'DD-MM-YYYY')).toBe('15-01-2024');
  });

  it('should format current date/time', () => {
    const now = converter.now('YYYY-MM-DD');
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
