/**
 * PAS-0005 — the one readiness check that exists today.
 *
 * PAS-0002 requires configuration to validate at startup and the process to
 * fail startup when deployed configuration is invalid. This check asserts that
 * the validated configuration is still resolvable, so a process that somehow
 * reached the serving loop without it reports not-ready rather than serving.
 *
 * PAS-0101 registers the database check; PAS-0604 registers object storage.
 * Neither will touch this file.
 */

import { getConfig } from '@pas/config';
import { registerReadinessCheck } from './checks.js';

export function registerConfigCheck(): void {
  registerReadinessCheck({
    name: 'configuration',
    critical: true,
    run() {
      // Throws ConfigValidationError if configuration is unresolvable.
      getConfig();
    },
  });
}
