import { defineConfig } from 'vitest/config';
import { pasAliases } from '../../vitest.shared.js';

/**
 * The security suite resolves `@pas/*` to source, like the unit suites.
 *
 * Unlike `tests/integration`, there is no built artifact under test here:
 * these exercise library behaviour and a harness that composes it. What
 * matters is that the authorization decisions are made by the real service
 * against a real database, not that they arrive through a spawned process.
 */
export default defineConfig({
  resolve: { alias: pasAliases },
  test: {
    // Pinned, like every other database-backed suite.
    env: { PAS_DATABASE_URL: 'postgresql://pas:pas@127.0.0.1:5432/pas_test' },
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Real sockets and a real database. Parallel files would race.
    fileParallelism: false,
  },
});
