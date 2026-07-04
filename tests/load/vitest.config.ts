import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    root: '.',
  },
  resolve: {
    conditions: ['node', 'import'],
  },
});
