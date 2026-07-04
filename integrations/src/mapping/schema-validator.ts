// ============================================================================
// Schema validation for parsed data
// ============================================================================

/**
 * Supported schema field types.
 */
export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object' | 'any';

/**
 * Definition of a field in a schema.
 */
export interface SchemaFieldDef {
  /** Field name */
  name: string;
  /** Expected data type */
  type: SchemaFieldType;
  /** Whether the field is required */
  required?: boolean;
  /** Minimum value (for number/integer) */
  min?: number;
  /** Maximum value (for number/integer) */
  max?: number;
  /** Minimum length (for string) */
  minLength?: number;
  /** Maximum length (for string) */
  maxLength?: number;
  /** Regex pattern (for string) */
  pattern?: string;
  /** Allowed enum values */
  enum?: unknown[];
  /** For nested object fields */
  fields?: SchemaFieldDef[];
  /** For array item type */
  itemType?: SchemaFieldType | SchemaFieldDef;
  /** Custom validator function */
  validate?: (val: unknown, record: Record<string, unknown>) => string | null;
}

/**
 * A complete schema definition.
 */
export interface SchemaDefinition {
  /** Schema name/identifier */
  name: string;
  /** Schema version */
  version?: string;
  /** Field definitions */
  fields: SchemaFieldDef[];
  /** Whether to allow extra fields not defined in the schema */
  allowExtraFields?: boolean;
}

export interface SchemaValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export class SchemaValidator {
  private schemas: Map<string, SchemaDefinition> = new Map();

  /**
   * Register a schema definition.
   */
  register(schema: SchemaDefinition): void {
    this.schemas.set(schema.name, schema);
  }

  /**
   * Register multiple schemas.
   */
  registerAll(schemas: SchemaDefinition[]): void {
    for (const s of schemas) {
      this.register(s);
    }
  }

  /**
   * Unregister a schema.
   */
  unregister(name: string): boolean {
    return this.schemas.delete(name);
  }

  /**
   * Check if a schema is registered.
   */
  hasSchema(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Validate data against a registered schema.
   * Returns an array of validation errors (empty = valid).
   */
  validate(schemaName: string, data: unknown): SchemaValidationError[] {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`No schema registered with name "${schemaName}"`);
    }

    return this._validateObject(schema.fields, data, schema.allowExtraFields ?? true, '');
  }

  /**
   * Validate inline (without registering).
   */
  validateInline(schema: SchemaDefinition, data: unknown): SchemaValidationError[] {
    return this._validateObject(schema.fields, data, schema.allowExtraFields ?? true, '');
  }

  private _validateObject(
    fields: SchemaFieldDef[],
    data: unknown,
    allowExtra: boolean,
    prefix: string,
  ): SchemaValidationError[] {
    const errors: SchemaValidationError[] = [];

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push({ field: prefix || '(root)', message: 'Expected an object', value: data });
      return errors;
    }

    const record = data as Record<string, unknown>;

    // Check extra fields
    if (!allowExtra) {
      for (const key of Object.keys(record)) {
        if (!fields.find((f) => f.name === key)) {
          errors.push({ field: prefix ? `${prefix}.${key}` : key, message: `Unexpected field "${key}"`, value: record[key] });
        }
      }
    }

    for (const field of fields) {
      const fullPath = prefix ? `${prefix}.${field.name}` : field.name;
      const val = record[field.name];

      // Required check
      if (field.required && (val === undefined || val === null)) {
        errors.push({ field: fullPath, message: `Required field "${field.name}" is missing` });
        continue;
      }

      // Skip if undefined and not required
      if (val === undefined || val === null) continue;

      // Type check
      const typeErr = this._checkType(field.name, field.type, val);
      if (typeErr) {
        errors.push({ field: fullPath, message: typeErr, value: val });
        continue;
      }

      // Value constraints
      if (field.type === 'number' || field.type === 'integer') {
        const num = Number(val);
        if (field.min !== undefined && num < field.min) {
          errors.push({ field: fullPath, message: `Value ${num} is less than minimum ${field.min}`, value: val });
        }
        if (field.max !== undefined && num > field.max) {
          errors.push({ field: fullPath, message: `Value ${num} is greater than maximum ${field.max}`, value: val });
        }
      }

      // String constraints
      if (field.type === 'string' && typeof val === 'string') {
        if (field.minLength !== undefined && val.length < field.minLength) {
          errors.push({ field: fullPath, message: `String length ${val.length} is less than minimum ${field.minLength}`, value: val });
        }
        if (field.maxLength !== undefined && val.length > field.maxLength) {
          errors.push({ field: fullPath, message: `String length ${val.length} exceeds maximum ${field.maxLength}`, value: val });
        }
        if (field.pattern && !new RegExp(field.pattern).test(val)) {
          errors.push({ field: fullPath, message: `String does not match pattern "${field.pattern}"`, value: val });
        }
      }

      // Enum
      if (field.enum !== undefined && !field.enum.includes(val)) {
        errors.push({ field: fullPath, message: `Value "${val}" is not in allowed enum [${field.enum.join(', ')}]`, value: val });
      }

      // Nested object
      if (field.type === 'object' && field.fields) {
        errors.push(...this._validateObject(field.fields, val, allowExtra, fullPath));
      }

      // Array
      if (field.type === 'array') {
        if (!Array.isArray(val)) {
          errors.push({ field: fullPath, message: 'Expected an array', value: val });
        } else if (field.itemType) {
          for (let i = 0; i < val.length; i++) {
            const itemPath = `${fullPath}[${i}]`;
            if (typeof field.itemType === 'string') {
              const itemErr = this._checkType(`${itemPath}`, field.itemType, val[i]);
              if (itemErr) errors.push({ field: itemPath, message: itemErr, value: val[i] });
            } else {
              errors.push(...this._validateObject([field.itemType], val[i], allowExtra, itemPath));
            }
          }
        }
      }

      // Custom validator
      if (field.validate) {
        const customErr = field.validate(val, record);
        if (customErr) {
          errors.push({ field: fullPath, message: customErr, value: val });
        }
      }
    }

    return errors;
  }

  private _checkType(fieldName: string, type: SchemaFieldType, val: unknown): string | null {
    switch (type) {
      case 'any':
        return null;
      case 'string':
        return typeof val === 'string' ? null : `Field "${fieldName}" must be a string, got ${typeof val}`;
      case 'number':
        return typeof val === 'number' ? null : `Field "${fieldName}" must be a number, got ${typeof val}`;
      case 'integer':
        return Number.isInteger(val) ? null : `Field "${fieldName}" must be an integer, got ${typeof val}`;
      case 'boolean':
        return typeof val === 'boolean' ? null : `Field "${fieldName}" must be a boolean, got ${typeof val}`;
      case 'array':
        return Array.isArray(val) ? null : `Field "${fieldName}" must be an array, got ${typeof val}`;
      case 'object':
        return (typeof val === 'object' && val !== null && !Array.isArray(val)) ? null : `Field "${fieldName}" must be a plain object, got ${typeof val}`;
      default:
        return null;
    }
  }
}
