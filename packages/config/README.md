# `@pas/config`

Centralized, validated environment configuration for every PAS application.

**Ticket:** PAS-0002 · **Build:** 00 — Engineering Foundation
**Status:** implemented

## Contract

- Supports the four PAS environments: `development`, `test`, `staging`, `production`.
- Validates on application startup.
- **Applications fail startup when required deployed configuration is invalid.**
- Secrets are never committed. `.env` is gitignored; `.env.example` carries placeholders only.

## Usage

```ts
import { getConfig, redactConfig } from '@pas/config';

// At startup. Throws ConfigValidationError listing EVERY problem found.
const config = getConfig();

// Safe to log — every declared secret is replaced with [REDACTED].
logger.info({ config: redactConfig(config) }, 'configuration loaded');
```

`loadConfig(env)` accepts an injected environment source for testing;
`getConfig()` validates once per process and caches.

## The twelve categories

| Category | Consumers |
|---|---|
| `database` | PAS-0101 pooling, PAS-0102 migrations |
| `objectStorage` | PAS-0604 adapter, Part I §11 source binaries |
| `session` | PAS-0202 |
| `authentication` | PAS-0202 |
| `encryption` | at-rest encryption, key rotation |
| `publicUrl` | PAS-2803 canonical URLs |
| `apiUrl` | API origin |
| `worker` | PAS-0304 outbox, PAS-0305 dispatcher, PAS-1303 idempotency |
| `agentProviders` | PAS-1601 gateway, PAS-1602 model registry |
| `observability` | PAS-3606, PAS-0004 correlation |
| `notification` | human tasks, publication review |
| `rateLimiting` | PAS-3603 |

Every field traces to a ticket that consumes it. Fields are not added speculatively.

## Three kinds of field

| Helper | Behaviour |
|---|---|
| `secret()` | required explicitly when deployed (min 32 chars); marked placeholder in development |
| `deployedRequired()` | environment-specific and unguessable — a database URL, a bucket, a public origin |
| `always()` | operational setting with a sane universal default; **never** required |

Conflating the last two makes production refuse to start over a cookie name, which trains
operators to ignore configuration errors.

## Deployment safety rules

`staging` is treated as deployed alongside `production`. A deployed staging environment
running on a development session secret is a real vulnerability, not a convenience.

Beyond field validation, a deployed environment is rejected when:

- any secret contains the `not-for-deployment` marker (an example file was copied into a
  deployed environment);
- `session.cookieSecure` is explicitly `false`;
- `notification.provider` is `console` (notifications would be silently dropped);
- `rateLimiting.enabled` is explicitly `false` (PAS-3603);
- `notification.provider` is `smtp`/`http` without its credential;
- `agentProviders.enabled` is true with no provider credential — the Agent Gateway would
  have nothing to route to (PAS-1601).

## Environment-variable booleans

`z.coerce.boolean()` is **not** used. It applies JavaScript `Boolean()`, under which the
string `"false"` is truthy — `PAS_RATE_LIMIT_ENABLED=false` would have meant *enabled*, and
`PAS_AGENT_ENABLED=false` would have switched the Agent Gateway on.

Accepted, case-insensitively and trimmed: `true|1|yes|on` and `false|0|no|off`. Anything else
is rejected rather than guessed. An empty variable counts as absent, so its default applies.

## Secret handling

Secret paths are declared once in `src/redact.ts`. `redactConfig()` deep-copies and replaces
each one with `[REDACTED]`, so a new secret is protected everywhere by adding one line.
A test asserts no secret value appears anywhere in the serialised output.

## Dependencies

`zod` only. No workspace dependencies — `@pas/config` is a leaf under PAS-0001's declared
dependency direction.
