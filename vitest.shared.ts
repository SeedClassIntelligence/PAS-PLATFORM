/**
 * Tests resolve `@pas/*` to source, never to `dist/`.
 *
 * Package `main` points at built output so `node` can run the API, but a test
 * run must never depend on a prior build — a stale `dist/` silently testing
 * yesterday's code is the failure mode this avoids.
 */
import { fileURLToPath } from 'node:url';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export const pasAliases = {
  '@pas/contracts': at('./packages/contracts/src/index.ts'),
  '@pas/config': at('./packages/config/src/index.ts'),
  '@pas/observability': at('./packages/observability/src/index.ts'),
  '@pas/database': at('./packages/database/src/index.ts'),
  '@pas/domain': at('./packages/domain/src/index.ts'),
  '@pas/auth': at('./packages/auth/src/index.ts'),
};
