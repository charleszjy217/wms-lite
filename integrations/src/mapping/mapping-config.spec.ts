import { describe, it, expect } from 'vitest';
import { loadConfigFile, loadConfigDirectory, loadMappingConfigs } from './mapping-config.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configRoot = resolve(__dirname, 'config');

describe('mapping-config', () => {
  it('should load a field map JSON file', async () => {
    const config = await loadConfigFile(resolve(configRoot, 'field-maps', 'erp-sap-product.json'));
    expect(config).toBeDefined();
    expect(config.sourceSystem).toBe('ERP_SAP');
    expect(config.entityType).toBe('Product');
    expect(config.rules.length).toBeGreaterThan(0);
  });

  it('should load a code map JSON file', async () => {
    const config = await loadConfigFile(resolve(configRoot, 'code-maps', 'erp-sap-status.json'));
    expect(config).toBeDefined();
    expect(config.sourceSystem).toBe('ERP_SAP');
    expect(config.fieldName).toBe('status');
    expect(config.entries.length).toBe(4);
  });

  it('should load a schema JSON file', async () => {
    const config = await loadConfigFile(resolve(configRoot, 'schemas', 'product-schema.json'));
    expect(config).toBeDefined();
    expect(config.name).toBe('canonical-product');
    expect(config.version).toBe('1.0.0');
    expect(config.fields.length).toBeGreaterThan(0);
  });

  it('should load all config files from a directory', async () => {
    const configs = await loadConfigDirectory(resolve(configRoot, 'field-maps'));
    expect(configs.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty array for non-existent directory', async () => {
    const configs = await loadConfigDirectory(resolve(configRoot, 'nonexistent'));
    expect(configs).toEqual([]);
  });

  it('should load the full mapping config bundle', async () => {
    const bundle = await loadMappingConfigs(configRoot);
    expect(bundle.fieldMappings.length).toBeGreaterThanOrEqual(1);
    expect(bundle.codeMappings.length).toBeGreaterThanOrEqual(1);
    expect(bundle.schemas.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle base config path without error', async () => {
    const bundle = await loadMappingConfigs('/tmp/nonexistent');
    expect(bundle.fieldMappings).toEqual([]);
    expect(bundle.codeMappings).toEqual([]);
    expect(bundle.schemas).toEqual([]);
  });
});
