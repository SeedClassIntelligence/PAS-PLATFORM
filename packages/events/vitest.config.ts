import { defineConfig } from 'vitest/config';
import { pasAliases } from '../../vitest.shared.js';

export default defineConfig({
  resolve: { alias: pasAliases },
  test: {
    // Tests run against pas_test, never the development database.
    env: { PAS_DATABASE_URL: 'postgresql://pas:pas@127.0.0.1:5432/pas_test' },
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Tests talk to a real PostgreSQL. Shared tables would race.
    fileParallelism: false,
  },
});
