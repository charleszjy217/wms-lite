// ============================================================================
// Mapping config loader — loads mapping rules from external JSON config files
// ============================================================================

import { readFile, readdir } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import type { FieldMappingConfig } from './field-mapper.js';
import type { CodeMappingDict } from './code-mapper.js';
import type { SchemaDefinition } from './schema-validator.js';

/**
 * All mapping config file types.
 */
export interface MappingConfigBundle {
  fieldMappings: FieldMappingConfig[];
  codeMappings: CodeMappingDict[];
  schemas: SchemaDefinition[];
}

/**
 * Load a single JSON config file.
 */
export async function loadConfigFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load all JSON files from a directory.
 */
export async function loadConfigDirectory<T>(dirPath: string): Promise<T[]> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return [];
  }

  const results: T[] = [];
  for (const entry of entries) {
    if (extname(entry).toLowerCase() === '.json') {
      const fullPath = resolve(dirPath, entry);
      const config = await loadConfigFile<T>(fullPath);
      results.push(config);
    }
  }
  return results;
}

/**
 * Load all mapping configs from the standard config directory.
 * Base path can be overridden for testing.
 */
export async function loadMappingConfigs(basePath?: string): Promise<MappingConfigBundle> {
  const root = basePath ?? resolve(import.meta.dirname ?? __dirname, 'config');

  const [fieldMappings, codeMappings, schemas] = await Promise.all([
    loadConfigDirectory<FieldMappingConfig>(resolve(root, 'field-maps')),
    loadConfigDirectory<CodeMappingDict>(resolve(root, 'code-maps')),
    loadConfigDirectory<SchemaDefinition>(resolve(root, 'schemas')),
  ]);

  return { fieldMappings, codeMappings, schemas };
}
