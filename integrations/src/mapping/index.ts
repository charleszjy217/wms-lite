// ============================================================================
// Mapping & Format Layer — barrel exports
// ============================================================================

// ---- Format parsers ----
export { JsonFormatParser } from './format/json-parser.js';
export { XmlFormatParser } from './format/xml-parser.js';
export { CsvFormatParser } from './format/csv-parser.js';
export { FixedWidthFormatParser } from './format/fixed-width-parser.js';

export type {
  FixedWidthColumnDef,
  FixedWidthParseOptions,
  FixedWidthSerializeOptions,
  CsvParseOptions,
  CsvSerializeOptions,
  XmlParseOptions,
  XmlSerializeOptions,
  JsonParseOptions,
  JsonSerializeOptions,
} from './format/types.js';

// ---- Field mapper ----
export { FieldMapper } from './field-mapper.js';
export type {
  FieldMappingRule,
  FieldMappingConfig,
  FieldTransform,
} from './field-mapper.js';

// ---- Code mapper ----
export { CodeMapper } from './code-mapper.js';
export type {
  CodeMappingEntry,
  CodeMappingDict,
} from './code-mapper.js';

// ---- Unit converter ----
export { UnitConverter } from './unit-converter.js';
export type {
  UnitCategory,
  UnitDefinition,
} from './unit-converter.js';

// ---- Date converter ----
export { DateConverter } from './date-converter.js';
export type {
  DatePrecision,
  DateConversionRule,
} from './date-converter.js';

// ---- Schema validator ----
export { SchemaValidator } from './schema-validator.js';
export type {
  SchemaFieldType,
  SchemaFieldDef,
  SchemaDefinition,
  SchemaValidationError,
} from './schema-validator.js';

// ---- Mapping config loader ----
export {
  loadConfigFile,
  loadConfigDirectory,
  loadMappingConfigs,
} from './mapping-config.js';
export type { MappingConfigBundle } from './mapping-config.js';
