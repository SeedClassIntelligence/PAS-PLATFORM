/**
 * PAS-0002 — "Secrets SHALL NOT be committed."
 * PAS-0301 — "Sensitive values must be redacted appropriately."
 * PAS-0003 — "Never expose stack traces or secrets through production APIs."
 *
 * A single declared list of secret-bearing paths. Everything that prints,
 * logs or serialises configuration goes through `redactConfig`, so a new
 * secret is protected everywhere by adding one line here.
 */

export const REDACTED = '[REDACTED]' as const;

/**
 * Dot-paths into PasConfig whose values must never be emitted.
 * A path ending in `.*` redacts every value of that record.
 */
export const SECRET_PATHS: readonly string[] = [
  'database.url', // contains the password
  'objectStorage.accessKeyId',
  'objectStorage.secretAccessKey',
  'session.secret',
  'encryption.key',
  'agentProviders.apiKeys.*',
  'notification.smtpUrl', // may contain credentials
  'notification.apiKey',
];

function matches(path: string, pattern: string): boolean {
  if (pattern === path) return true;
  if (!pattern.endsWith('.*')) return false;
  const prefix = pattern.slice(0, -2);
  return path.startsWith(`${prefix}.`) && !path.slice(prefix.length + 1).includes('.');
}

function isSecretPath(path: string): boolean {
  return SECRET_PATHS.some((pattern) => matches(path, pattern));
}

/**
 * Returns a deep copy with every secret value replaced by `[REDACTED]`.
 * Safe to log, serialise, or return from a diagnostics endpoint.
 */
export function redactConfig<T>(config: T): T {
  return walk(config, '') as T;
}

function walk(value: unknown, path: string): unknown {
  if (path && isSecretPath(path)) {
    return value === undefined ? undefined : REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => walk(item, path ? `${path}.${index}` : String(index)));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = walk(child, path ? `${path}.${key}` : key);
    }
    return out;
  }
  return value;
}
