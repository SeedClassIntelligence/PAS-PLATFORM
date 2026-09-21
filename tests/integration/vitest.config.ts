import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against BUILT artifacts, not source. They therefore
 * carry no `@pas/*` source aliases — the whole point is to exercise what ships.
 *
 * Longer timeout: each test spawns a real process and waits for a socket.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Spawned servers bind real ports; parallel files would race.
    fileParallelism: false,
  },
});
