// ============================================================================
// Configurable field mapping: externalField → canonicalField
// ============================================================================

/**
 * A single field mapping rule.
 */
export interface FieldMappingRule {
  /** Name of the field in the external system */
  externalField: string;
  /** Name of the field in the canonical model */
  canonicalField: string;
  /**
   * Optional transformation pipeline.
   * Each step is applied in order.
   */
  transform?: FieldTransform[];
  /** Default value if external value is null / undefined / empty */
  default?: unknown;
  /** If true, the mapping is required – an error is raised when missing */
  required?: boolean;
}

export type FieldTransform =
  | { type: 'trim' }
  | { type: 'upper' }
  | { type: 'lower' }
  | { type: 'replace'; pattern: string; replacement: string }
  | { type: 'prefix'; value: string }
  | { type: 'suffix'; value: string }
  | { type: 'split'; delimiter: string; index: number }
  | { type: 'template'; template: string }  // uses {{fieldName}} placeholders
  | { type: 'custom'; fn: ((val: unknown, record: Record<string, unknown>) => unknown) | string };

/**
 * A mapping config for a source system.
 */
export interface FieldMappingConfig {
  /** Source system identifier, e.g. "ERP_SAP" */
  sourceSystem: string;
  /** Target entity type, e.g. "Product", "Batch" */
  entityType: string;
  /** List of field mapping rules */
  rules: FieldMappingRule[];
}

/**
 * Applies a single transform value.
 */
function applyTransform(val: unknown, transform: FieldTransform, record: Record<string, unknown>): unknown {
  switch (transform.type) {
    case 'trim': {
      if (typeof val === 'string') return val.trim();
      return val;
    }
    case 'upper': {
      if (typeof val === 'string') return val.toUpperCase();
      return val;
    }
    case 'lower': {
      if (typeof val === 'string') return val.toLowerCase();
      return val;
    }
    case 'replace': {
      if (typeof val === 'string') {
        return val.replace(new RegExp(transform.pattern, 'g'), transform.replacement);
      }
      return val;
    }
    case 'prefix': {
      return transform.value + String(val ?? '');
    }
    case 'suffix': {
      return String(val ?? '') + transform.value;
    }
    case 'split': {
      if (typeof val === 'string') {
        const parts = val.split(transform.delimiter);
        return parts[transform.index] ?? '';
      }
      return val;
    }
    case 'template': {
      // Replace {{fieldName}} with record[fieldName]
      let result = transform.template;
      const placeholderRe = /\{\{(\w+)\}\}/g;
      result = result.replace(placeholderRe, (_, field) => {
        const fieldVal = record[field];
        return fieldVal !== undefined ? String(fieldVal) : '';
      });
      return result;
    }
    case 'custom': {
      if (typeof transform.fn === 'function') {
        return transform.fn(val, record);
      }
      // String-based custom function (from JSON config) — evaluate as arrow function body
      try {
        const fn = new Function('val', 'record', `"use strict"; return (${transform.fn})(val, record)`);
        return fn(val, record);
      } catch {
        return val;
      }
    }
    default:
      return val;
  }
}

export class FieldMapper {
  private configs: Map<string, FieldMappingConfig> = new Map();

  /**
   * Register a field mapping configuration for a given source system + entity type.
   */
  register(config: FieldMappingConfig): void {
    const key = `${config.sourceSystem}:${config.entityType}`;
    this.configs.set(key, config);
  }

  /**
   * Load multiple configs at once.
   */
  loadAll(configs: FieldMappingConfig[]): void {
    for (const cfg of configs) {
      this.register(cfg);
    }
  }

  /**
   * Remove a registered mapping.
   */
  unregister(sourceSystem: string, entityType: string): boolean {
    return this.configs.delete(`${sourceSystem}:${entityType}`);
  }

  /**
   * Check if a mapping exists.
   */
  hasMapping(sourceSystem: string, entityType: string): boolean {
    return this.configs.has(`${sourceSystem}:${entityType}`);
  }

  /**
   * Map an external record to a canonical record.
   */
  map<T extends Record<string, unknown> = Record<string, unknown>>(
    sourceSystem: string,
    entityType: string,
    externalRecord: Record<string, unknown>,
  ): T {
    const key = `${sourceSystem}:${entityType}`;
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`No field mapping found for "${key}"`);
    }

    const result: Record<string, unknown> = {};

    for (const rule of config.rules) {
      let val = externalRecord[rule.externalField];

      // If value is missing / null / undefined
      if (val === undefined || val === null || val === '') {
        if (rule.required) {
          throw new Error(`Required field "${rule.externalField}" is missing in record for "${key}"`);
        }
        if (rule.default !== undefined) {
          result[rule.canonicalField] = rule.default;
        } else {
          result[rule.canonicalField] = undefined;
        }
        continue;
      }

      // Apply transform pipeline
      if (rule.transform) {
        for (const t of rule.transform) {
          val = applyTransform(val, t, externalRecord);
        }
      }

      result[rule.canonicalField] = val;
    }

    return result as T;
  }
}
