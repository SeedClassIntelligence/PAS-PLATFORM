/**
 * PAS-0002 — Environment Configuration
 *
 * The four environments PAS-0002 requires, and the deployment classification
 * that drives fail-fast behaviour.
 */

export const PAS_ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;

export type PasEnvironment = (typeof PAS_ENVIRONMENTS)[number];

export function isPasEnvironment(value: unknown): value is PasEnvironment {
  return typeof value === 'string' && (PAS_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Environments that run on real infrastructure and therefore MUST supply every
 * required value explicitly.
 *
 * PAS-0002 says "fail startup when required *production* configuration is
 * invalid". Staging is included deliberately: a deployed staging environment
 * running on a development default session secret or encryption key is a real
 * vulnerability, not a convenience. Narrowing this to `production` alone would
 * leave staging silently insecure.
 */
export function isDeployedEnvironment(environment: PasEnvironment): boolean {
  return environment === 'production' || environment === 'staging';
}

/**
 * Environments permitted to fall back to built-in development defaults so the
 * application can start with no configuration at all.
 */
export function allowsDefaults(environment: PasEnvironment): boolean {
  return !isDeployedEnvironment(environment);
}
