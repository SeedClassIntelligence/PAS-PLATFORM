import { defineConfig } from 'vitest/config';
import { pasAliases } from '../../vitest.shared.js';

export default defineConfig({
  resolve: { alias: pasAliases },
  test: { environment: 'node', globals: true, include: ['tests/**/*.test.ts'] },
});
