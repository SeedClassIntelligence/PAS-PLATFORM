/**
 * PAS-0003 — "Never expose stack traces or secrets through production APIs."
 *
 * Details are structured data assembled at a throw site, often from whatever
 * context was to hand. Even a family whose details are client-safe can pick up
 * a credential by accident — a request body echoed back, a connection string in
 * a driver error, an `Authorization` header copied into a log object.
 *
 * `scrubDetails` is the last line before serialisation. It is deliberately
 * conservative: it redacts on key name, redacts values that *look* like
 * credentials regardless of key, and bounds size and depth so an error response
 * can never become an exfiltration channel or a denial-of-service payload.
 */

export const REDACTED = '[REDACTED]' as const;

/** Key names whose values are never emitted, matched case-insensitively. */
const SENSITIVE_KEY_PATTERN =
  /(pass(word|wd)?|secret|token|api[_-]?key|apikey|credential|authorization|auth|cookie|session|private[_-]?key|encryption[_-]?key|access[_-]?key|client[_-]?secret|signature|salt|otp|pin|ssn|jwt|bearer)/i;

/**
 * Values that look like credentials wherever they appear. Conservative on
 * purpose — a false positive costs a debugging detail, a false negative leaks
 * a key.
 */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i, // scheme://user:password@host
  /\b(sk|pk|rk|ak)[-_][A-Za-z0-9]{16,}\b/, // common provider key prefixes
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/i, // bearer tokens
  /\beyJ[A-Za-z0-9._-]{20,}\b/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private key
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
];

export interface ScrubOptions {
  /** Maximum nesting depth retained. Deeper values become "[DEPTH LIMIT]". */
  maxDepth?: number;
  /** Maximum entries retained per object or array. */
  maxEntries?: number;
  /** Maximum retained length of any single string. */
  maxStringLength?: number;
}

const DEFAULTS: Required<ScrubOptions> = {
  maxDepth: 6,
  maxEntries: 50,
  maxStringLength: 1_000,
};

function looksSensitive(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function scrubString(value: string, maxStringLength: number): string {
  if (looksSensitive(value)) return REDACTED;
  if (value.length > maxStringLength) {
    return `${value.slice(0, maxStringLength)}… [TRUNCATED ${value.length - maxStringLength} chars]`;
  }
  return value;
}

/**
 * Returns a deep copy safe to serialise into an API response or a log.
 * Never mutates the input.
 */
export function scrubDetails(value: unknown, options: ScrubOptions = {}): unknown {
  const opts = { ...DEFAULTS, ...options };
  return walk(value, 0, opts, new WeakSet());
}

function walk(
  value: unknown,
  depth: number,
  opts: Required<ScrubOptions>,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return scrubString(value, opts.maxStringLength);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;

  if (value instanceof Date) return value.toISOString();

  /**
   * An Error inside details would carry a stack. PAS-0003 forbids emitting
   * stacks, so only name and (scrubbed) message survive.
   */
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message, opts.maxStringLength),
    };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    if (depth >= opts.maxDepth) return '[DEPTH LIMIT]';
    seen.add(value);

    try {
      if (Array.isArray(value)) {
        const kept = value.slice(0, opts.maxEntries).map((item) => walk(item, depth + 1, opts, seen));
        if (value.length > opts.maxEntries) {
          kept.push(`[${value.length - opts.maxEntries} MORE ITEMS]`);
        }
        return kept;
      }

      const out: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>);
      for (const [key, child] of entries.slice(0, opts.maxEntries)) {
        out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : walk(child, depth + 1, opts, seen);
      }
      if (entries.length > opts.maxEntries) {
        out['…'] = `[${entries.length - opts.maxEntries} MORE KEYS]`;
      }
      return out;
    } finally {
      seen.delete(value);
    }
  }

  return undefined;
}
