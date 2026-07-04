// ============================================================================
// Measurement unit conversion
// ============================================================================

/** Supported unit categories */
export type UnitCategory = 'weight' | 'volume' | 'length' | 'area' | 'temperature' | 'count';

/**
 * A conversion factor relative to the base unit for the category.
 * Base units:
 *   weight → gram (g)
 *   volume → liter (L)
 *   length → meter (m)
 *   area   → square meter (m²)
 *   temperature → celsius (°C) — uses formula, not factor
 *   count  → piece (pc)
 */
export interface UnitDefinition {
  /** Unit code / symbol */
  code: string;
  /** Category this unit belongs to */
  category: UnitCategory;
  /** Conversion factor to base unit: base = factor * value  */
  factor?: number;
  /** For temperature: optional offset (celsius = factor * value + offset) */
  offset?: number;
  /** Human-readable label */
  label?: string;
}

const BUILTIN_UNITS: UnitDefinition[] = [
  // ---- Weight (base: gram) ----
  { code: 'g', category: 'weight', factor: 1, label: 'Gram' },
  { code: 'kg', category: 'weight', factor: 0.001, label: 'Kilogram' },
  { code: 'lb', category: 'weight', factor: 0.00220462, label: 'Pound' },
  { code: 'oz', category: 'weight', factor: 0.035274, label: 'Ounce' },
  { code: 't', category: 'weight', factor: 0.000001, label: 'Metric Ton' },
  { code: 'mg', category: 'weight', factor: 1000, label: 'Milligram' },

  // ---- Volume (base: liter) ----
  { code: 'L', category: 'volume', factor: 1, label: 'Liter' },
  { code: 'mL', category: 'volume', factor: 1000, label: 'Milliliter' },
  { code: 'gal', category: 'volume', factor: 0.264172, label: 'US Gallon' },
  { code: 'qt', category: 'volume', factor: 1.05669, label: 'US Quart' },
  { code: 'floz', category: 'volume', factor: 33.814, label: 'US Fluid Ounce' },
  { code: 'm³', category: 'volume', factor: 0.001, label: 'Cubic Meter' },

  // ---- Length (base: meter) ----
  { code: 'm', category: 'length', factor: 1, label: 'Meter' },
  { code: 'cm', category: 'length', factor: 100, label: 'Centimeter' },
  { code: 'mm', category: 'length', factor: 1000, label: 'Millimeter' },
  { code: 'km', category: 'length', factor: 0.001, label: 'Kilometer' },
  { code: 'in', category: 'length', factor: 39.3701, label: 'Inch' },
  { code: 'ft', category: 'length', factor: 3.28084, label: 'Foot' },
  { code: 'yd', category: 'length', factor: 1.09361, label: 'Yard' },

  // ---- Area (base: m²) ----
  { code: 'm²', category: 'area', factor: 1, label: 'Square Meter' },
  { code: 'cm²', category: 'area', factor: 10000, label: 'Square Centimeter' },
  { code: 'ft²', category: 'area', factor: 10.7639, label: 'Square Foot' },
  { code: 'ha', category: 'area', factor: 0.0001, label: 'Hectare' },

  // ---- Temperature (base: °C) ----
  { code: '°C', category: 'temperature', factor: 1, offset: 0, label: 'Celsius' },
  { code: '°F', category: 'temperature', factor: 5 / 9, offset: -32, label: 'Fahrenheit' },
  { code: 'K', category: 'temperature', factor: 1, offset: -273.15, label: 'Kelvin' },

  // ---- Count (base: piece) ----
  { code: 'pc', category: 'count', factor: 1, label: 'Piece' },
  { code: 'doz', category: 'count', factor: 1 / 12, label: 'Dozen' },
  { code: 'box', category: 'count', factor: 1, label: 'Box' },
  { code: 'pair', category: 'count', factor: 0.5, label: 'Pair' },
];

export class UnitConverter {
  private units: Map<string, UnitDefinition> = new Map();
  private categories: Map<UnitCategory, string> = new Map();

  constructor() {
    for (const u of BUILTIN_UNITS) {
      this.units.set(u.code, u);
      if (!this.categories.has(u.category)) {
        this.categories.set(u.category, u.code);
      }
    }
  }

  /**
   * Register a custom unit definition.
   */
  register(unit: UnitDefinition): void {
    this.units.set(unit.code, unit);
  }

  /**
   * Register multiple custom units.
   */
  registerAll(units: UnitDefinition[]): void {
    for (const u of units) {
      this.register(u);
    }
  }

  /**
   * Get the base unit code for a category.
   */
  getBaseUnit(category: UnitCategory): string | undefined {
    return this.categories.get(category);
  }

  /**
   * Check if a unit code is registered.
   */
  hasUnit(code: string): boolean {
    return this.units.has(code);
  }

  /**
   * Convert a value from one unit to another.
   * Both units must belong to the same category.
   */
  convert(value: number, fromUnit: string, toUnit: string): number {
    const from = this.units.get(fromUnit);
    const to = this.units.get(toUnit);

    if (!from) throw new Error(`Unknown unit: "${fromUnit}"`);
    if (!to) throw new Error(`Unknown unit: "${toUnit}"`);
    if (from.category !== to.category) {
      throw new Error(`Cannot convert between "${from.category}" and "${to.category}"`);
    }

    // For temperature, formula: celsius = (value + offset) * factor
    // E.g., °F → °C: C = (F + (-32)) * 5/9
    // E.g., K → °C: C = (K + (-273.15)) * 1
    if (from.category === 'temperature') {
      // Convert to Celsius first
      const celsius = (value + (from.offset ?? 0)) * from.factor!;
      // Then from Celsius to target
      const result = celsius / to.factor! - (to.offset ?? 0);
      return Math.round(result * 1e6) / 1e6; // round to 6 decimal places
    }

    // For other categories: toBase = value / factor
    const baseValue = value / from.factor!;
    // fromBase: result = baseValue * to.factor
    const result = baseValue * to.factor!;
    return Math.round(result * 1e6) / 1e6;
  }

  /**
   * List all registered unit codes.
   */
  listUnits(): string[] {
    return Array.from(this.units.keys());
  }

  /**
   * List units for a specific category.
   */
  listUnitsByCategory(category: UnitCategory): string[] {
    return Array.from(this.units.values())
      .filter((u) => u.category === category)
      .map((u) => u.code);
  }
}
