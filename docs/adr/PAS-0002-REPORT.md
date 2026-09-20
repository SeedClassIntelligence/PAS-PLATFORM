# PAS-0002 — Environment Configuration

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0002 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 00 — Engineering Foundation |
| **Depends on** | PAS-0001 (monorepo topology) ✅ |
| **Authority** | Clean-Sheet Build Specification PAS-0002 |

---

## Purpose

Centralized, validated configuration under `packages/config/`, supporting the four PAS
environments, validating on application startup, and failing startup when required deployed
configuration is invalid.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/config/src/environment.ts` | four environments; deployment classification |
| `packages/config/src/schema.ts` | the twelve required categories as validated schemas |
| `packages/config/src/load.ts` | load, validate, deployment safety rules, fail-fast |
| `packages/config/src/redact.ts` | declared secret paths; `redactConfig()` |
| `packages/config/src/index.ts` | public API |
| `packages/config/tsconfig.json` | extends `tsconfig.node.json` |
| `packages/config/vitest.config.ts` | node environment |
| `packages/config/tests/config.test.ts` | 30 tests |
| `tsconfig.node.json` | shared Node-side TS config (no DOM, no JSX) |
| `.env.example` | placeholders only — no secrets |

## Files Modified

| File | Change |
|---|---|
| `packages/config/package.json` | entry point, scripts, `zod` dependency |
| `packages/config/README.md` | scaffold README replaced with the implemented contract |

**No application source outside `packages/config/` was modified.** `apps/web` untouched.

## Database Migrations

None. First migrations are PAS-0102.

## Domain Contracts Added/Changed

None. `@pas/config` is a leaf package with no workspace dependencies, per PAS-0001's declared
direction. It exports `PasConfig`, `PasEnvironment`, `ConfigProblem`, `EnvSource`.

## API Contracts Added/Changed

None.

## Events Added/Changed

None.

## Workflow Changes

None.

## Governance Changes

None.

## Authorization Changes

None. PAS-0204 is the first authorization work. Configuration is process-level and read before
any request exists.

## Tests Added

`packages/config/tests/config.test.ts` — **30 tests** across seven groups:

| Group | Covers |
|---|---|
| environments | the four environments; deployed classification; `PAS_ENV` precedence; unknown-name rejection |
| development | starts with zero configuration; all twelve categories present; coercion; frozen result |
| production fail-fast | 9 tests — the load-bearing requirement |
| environment boolean parsing | 4 regression tests (see Known Issues → defects found) |
| operational defaults | 2 regression tests |
| secret redaction | 3 tests, including "no secret value appears anywhere in serialised output" |
| getConfig caching | validate-once semantics |

## Tests Passed

```
 ✓ packages/config  30/30
 ✓ apps/web          3/3   (unchanged)
   Test Files  2 passed (2)
        Tests  33 passed (33)
```

## Typecheck Result

✅ **PASS** — both workspaces, zero errors.

## Build Result

✅ **PASS**. Frontend artifacts **still byte-identical** to the `f23d11a` baseline:

```
a629bfc911408e9d34241d85d27d4aa4  css
63a17f150ca2f875c2ced46dd0b97be2  js
91c7fda9b10c7513541943f4beb3433a  html
```

## Security / Privacy Impact

**Positive — three protections introduced.**

1. **Secrets are never committed.** `.env` is gitignored; `.env.example` carries placeholders
   only. A staged-diff scan for credential-shaped strings returns nothing.

2. **Development placeholders cannot reach a deployed environment.** Every built-in
   development secret embeds the marker `not-for-deployment`. A staging or production
   environment supplying a value containing that marker is rejected at startup — copying
   `.env.example` into a deployed environment fails fast by design.

3. **Secret redaction is centralized.** `SECRET_PATHS` is declared once; `redactConfig()`
   deep-copies with `[REDACTED]` substituted. A test asserts that no secret value — database
   password, storage keys, session secret, encryption key, agent API keys, SMTP URL — appears
   anywhere in the serialised output. This serves PAS-0301 ("sensitive values must be
   redacted appropriately") and PAS-0003 ("never expose secrets through production APIs")
   ahead of those tickets.

**Deployment safety rules** beyond field validation — a deployed environment is rejected when
`session.cookieSecure` is explicitly false, `notification.provider` is `console`,
`rateLimiting.enabled` is explicitly false (PAS-3603), a notification provider lacks its
credential, or `agentProviders.enabled` is true with no provider credential (PAS-1601).

**`staging` is classified as deployed.** PAS-0002 says "required *production* configuration",
but a deployed staging environment running on a development session secret or encryption key
is a real vulnerability, not a convenience. Narrowing the rule to `production` alone would
leave staging silently insecure. Flagged here as a deliberate widening of the ticket.

## Backward Dependency Check

✅ `@pas/config` declares **no workspace dependencies** — unchanged from PAS-0001, still a leaf.
✅ No circular dependencies.
✅ External dependency added: `zod@^3.25` (runtime), `vitest`, `@types/node` (dev).

## Forward Dependencies Unlocked

PAS-0003 (error contract — will reconcile `ConfigValidationError` into the shared families) ·
PAS-0005 (health/readiness) · PAS-0006 (CI) · PAS-0101 (database connection layer consumes
`config.database`) · PAS-0604 (object storage consumes `config.objectStorage`) ·
PAS-1601 (Agent Gateway consumes `config.agentProviders`).

## Known Issues

None outstanding. **Two real defects were found and fixed during implementation** — both by
the tests, both in code I had just written:

### Defect 1 — `z.coerce.boolean()` inverts negative environment variables

`z.coerce.boolean()` applies JavaScript `Boolean()`. The string `"false"` is truthy, so:

```
PAS_RATE_LIMIT_ENABLED=false   →  rateLimiting.enabled === true
PAS_AGENT_ENABLED=false        →  Agent Gateway ENABLED
PAS_SESSION_COOKIE_SECURE=false→  silently ignored
```

Environment variables are always strings, so coercion is simply the wrong tool. Replaced with
an explicit parser accepting `true|1|yes|on` / `false|0|no|off` (trimmed, case-insensitive)
and **rejecting** anything ambiguous rather than guessing. Four regression tests added.

This would have been a live security defect: an operator disabling rate limiting or the agent
gateway would have got the opposite of what they configured, with no error.

### Defect 2 — operational settings required in production

The first schema design made every non-secret field required in deployed environments, so
production refused to start over a missing `session.cookieName`, `observability.serviceName`
or `database.poolMin` — 29 reported problems for a configuration that was substantially fine.

That conflated "has a development default" with "may be defaulted at all". Redesigned into
three distinct helpers — `secret()`, `deployedRequired()`, `always()` — so only secrets and
genuinely environment-specific values (database URL, bucket, public origin) are required.
Two regression tests added.

A startup error listing 29 problems, most of them noise, trains operators to skim
configuration errors. That is how the real one gets missed.

### Disclosure — `tsconfig.node.json` added

`tsconfig.base.json` targets the browser (DOM libs, `jsx: react-jsx`). Node-side packages need
neither. `tsconfig.node.json` extends the base and overrides `lib`/`target`/`types`.
`apps/web/tsconfig.json` is untouched, and the frontend build remains byte-identical.
This is a mechanical consequence of the monorepo containing both a browser app and Node
packages; it introduces no architecture.

---

## Acceptance Criteria

| PAS-0002 requirement | Evidence |
|---|---|
| Configuration centralized under `packages/config/` | ✅ 5 source modules |
| Supports development, test, staging, production | ✅ `PAS_ENVIRONMENTS`; test asserts exactly these four |
| Validates on application startup | ✅ `getConfig()` validates once per process |
| **DATABASE** | ✅ url, pool, ssl, statement timeout |
| **OBJECT_STORAGE** | ✅ endpoint, region, bucket, credentials, signed-URL TTL |
| **SESSION** | ✅ secret, cookie name/TTL/secure/sameSite |
| **AUTHENTICATION** | ✅ password policy, lockout, argon2id params |
| **ENCRYPTION** | ✅ key, key version, algorithm |
| **PUBLIC_URL** | ✅ |
| **API_URL** | ✅ |
| **WORKER** | ✅ concurrency, poll, attempts, backoff, claim timeout |
| **AGENT_PROVIDERS** | ✅ gateway switch, per-provider keys/URLs, no vendor in schema |
| **OBSERVABILITY** | ✅ log level, service name, tracing, OTLP, redaction |
| **EMAIL/NOTIFICATION** | ✅ provider, from address, credentials |
| **RATE_LIMITING** | ✅ enabled, window, limits |
| Secrets SHALL NOT be committed | ✅ `.env` gitignored; `.env.example` placeholders only; staged-diff scan clean |
| Fail startup when required deployed config is invalid | ✅ 9 fail-fast tests |

Root gate `npm run verify`: **exit 0**.

**STATUS: COMPLETE.**
