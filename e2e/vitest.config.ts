import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    root: '.',
  },
  resolve: {
    conditions: ['node', 'import'],
  },
});
