# `@pas/api`

Synchronous API requests, authentication, authorization and domain-service invocation.
It does **not** own canonical business rules (Clean-Sheet Part I §1).

**Implemented:** PAS-0005 — health and readiness.

## Endpoints

| Route | Answers | Checks dependencies |
|---|---|---|
| `GET /health` | Is this process alive and able to serve? | **No** |
| `GET /ready` | Should this process receive traffic right now? | Yes |

### Why liveness must not check dependencies

A liveness probe that checks the database restarts every pod the moment the database blips —
converting a brief dependency outage into a fleet-wide restart storm, at exactly the moment
the database can least afford a reconnect stampede.

During graceful shutdown the two deliberately disagree: `/health` stays **200** (do not kill
me, I am finishing in-flight requests) while `/ready` returns **503** (stop routing new
traffic). Collapsing them loses zero-downtime deploys.

## "Do not expose sensitive infrastructure details publicly"

The natural readiness response is a reconnaissance gift:

```json
{"database":{"status":"fail","detail":"ECONNREFUSED 10.0.1.42:5432"}}
```

Internal addressing, ports, topology and driver versions — served unauthenticated to anyone
who can reach the endpoint. Probes cannot authenticate, so the endpoint must be safe by
construction instead.

In a **deployed** environment (production *and* staging) the body is the aggregate status and
a correlation id. Nothing else — not even which check failed, because the set of check names
is itself a map of PAS's dependencies:

```json
{"status":"not_ready","correlationId":"b22f40ae-…"}
```

Outside deployed environments, operators get the full per-check detail. Even there, every
detail passes through `scrubDetails` from `@pas/contracts`, because development output still
reaches terminals, CI logs and screenshots in bug reports.

Operators recover the withheld detail from logs, which carry the same correlation id.

## Readiness checks self-register

```ts
registerReadinessCheck({ name: 'database', critical: true, run: () => pool.query('select 1') });
```

PAS-0101 registers the database check and PAS-0604 registers object storage; neither will
touch the health endpoint. Today the only check is `configuration` (PAS-0002).

- **`critical: false`** is reported but does not fail readiness — an optional dependency being
  down should degrade, not black-hole traffic.
- Every check is raced against a timeout (default 2s). A probe that never answers is worse
  than one that fails: the orchestrator assumes the worst and kills a possibly-healthy
  process.
- Checks run concurrently.

## Running it

```bash
npm run build -w @pas/api     # tsc → dist/
npm run start -w @pas/api     # node dist/main.js
```

Configuration is resolved **before** the port is bound and deliberately not caught: PAS-0002
requires the process to fail startup when deployed configuration is invalid. A server that
binds a port before knowing it is configured is a server that serves errors instead of
refusing to exist.

## HTTP framework — deliberately not chosen yet

This runs on `node:http` with no runtime dependency. Choosing Fastify, Express or Hono to
serve two GET endpoints would settle the framework for every later endpoint ticket on the
basis of a requirement that exercises none of what a framework provides.

**The decision belongs to PAS-0405** (the first domain API), where routing depth, body
parsing, schema validation and middleware composition actually matter.

Recommendation recorded for that ticket, not acted on here: **Fastify** — first-class
TypeScript, JSON-schema validation that composes with the zod contracts already in
`@pas/contracts`, and a plugin model matching the modular monolith of §XLIII.
