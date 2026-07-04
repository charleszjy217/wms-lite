// ============================================================================
// Code dictionary mapping: external code ↔ internal canonical code
// ============================================================================

/**
 * A single code mapping entry.
 */
export interface CodeMappingEntry {
  /** The code as received from the external system */
  externalCode: string;
  /** The canonical code used internally */
  canonicalCode: string;
}

/**
 * Code mapping dictionary for a specific field.
 */
export interface CodeMappingDict {
  /** Source system, e.g. "ERP_SAP" */
  sourceSystem: string;
  /** The field name these codes apply to, e.g. "status", "movementType" */
  fieldName: string;
  /** Code mapping entries */
  entries: CodeMappingEntry[];
  /** Default canonical code when no match is found */
  defaultCanonical?: string;
  /** Whether to throw on unmapped code */
  strict?: boolean;
}

export class CodeMapper {
  private dicts: Map<string, CodeMappingDict> = new Map();

  /**
   * Register a code mapping dictionary.
   */
  register(dict: CodeMappingDict): void {
    const key = `${dict.sourceSystem}:${dict.fieldName}`;
    // Build a quick lookup map
    this.dicts.set(key, dict);
  }

  /**
   * Load multiple dictionaries.
   */
  loadAll(dicts: CodeMappingDict[]): void {
    for (const d of dicts) {
      this.register(d);
    }
  }

  /**
   * Unregister a code mapping.
   */
  unregister(sourceSystem: string, fieldName: string): boolean {
    return this.dicts.delete(`${sourceSystem}:${fieldName}`);
  }

  /**
   * Check if a code mapping exists for the given system + field.
   */
  hasMapping(sourceSystem: string, fieldName: string): boolean {
    return this.dicts.has(`${sourceSystem}:${fieldName}`);
  }

  /**
   * Convert an external code to a canonical code.
   * If strict and not found, throws.
   * If not strict, returns the external code as-is when not found.
   */
  toCanonical(sourceSystem: string, fieldName: string, externalCode: string): string {
    const key = `${sourceSystem}:${fieldName}`;
    const dict = this.dicts.get(key);
    if (!dict) {
      throw new Error(`No code mapping found for "${key}"`);
    }

    const entry = dict.entries.find((e) => e.externalCode === externalCode);
    if (entry) return entry.canonicalCode;

    if (dict.defaultCanonical !== undefined) return dict.defaultCanonical;
    if (dict.strict) {
      throw new Error(`No mapping for external code "${externalCode}" in "${key}" (strict mode)`);
    }
    return externalCode; // pass-through
  }

  /**
   * Convert a canonical code to an external code (reverse lookup).
   * Returns the external code as-is when not found (non-strict).
   */
  toExternal(sourceSystem: string, fieldName: string, canonicalCode: string): string {
    const key = `${sourceSystem}:${fieldName}`;
    const dict = this.dicts.get(key);
    if (!dict) {
      throw new Error(`No code mapping found for "${key}"`);
    }

    const entry = dict.entries.find((e) => e.canonicalCode === canonicalCode);
    if (entry) return entry.externalCode;

    if (dict.strict) {
      throw new Error(`No reverse mapping for canonical code "${canonicalCode}" in "${key}" (strict mode)`);
    }
    return canonicalCode;
  }

  /**
   * Get all canonical codes for a given source system and field.
   */
  getCanonicalCodes(sourceSystem: string, fieldName: string): string[] {
    const dict = this.dicts.get(`${sourceSystem}:${fieldName}`);
    if (!dict) return [];
    return dict.entries.map((e) => e.canonicalCode);
  }
}
