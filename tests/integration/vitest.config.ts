import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against BUILT artifacts, not source. They therefore
 * carry no `@pas/*` source aliases — the whole point is to exercise what ships.
 *
 * Longer timeout: each test spawns a real process and waits for a socket.
 */
export default defineConfig({
  test: {
    /**
     * Pinned, matching `packages/database/vitest.config.ts`.
     *
     * PAS-0102's suite runs the real migrator and creates and drops scratch
     * databases. Inheriting an ambient `PAS_DATABASE_URL` would point that at
     * whatever the developer last exported. Spawned children inherit this.
     */
    env: { PAS_DATABASE_URL: 'postgresql://pas:pas@127.0.0.1:5432/pas_test' },
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Spawned servers bind real ports; parallel files would race.
    fileParallelism: false,
  },
});
