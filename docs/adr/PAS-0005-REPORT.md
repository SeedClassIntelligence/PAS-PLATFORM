# PAS-0005 — Health and Readiness

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0005 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 00 — Engineering Foundation |
| **Depends on** | PAS-0001 ✅, PAS-0002 ✅, PAS-0003 ✅, PAS-0004 ✅ |

---

## Purpose

`GET /health` (process health) and `GET /ready` (validates required dependencies), without
exposing sensitive infrastructure details publicly.

---

## Files Created

| Path | Purpose |
|---|---|
| `apps/api/src/health/checks.ts` | self-registering check registry, timeout, concurrent runner |
| `apps/api/src/health/handlers.ts` | the two handlers; deployed-vs-local disclosure rule |
| `apps/api/src/health/config-check.ts` | the one check that exists today (PAS-0002) |
| `apps/api/src/server.ts` | `node:http` server, correlation, graceful shutdown |
| `apps/api/src/main.ts`, `src/index.ts` | entry point and public API |
| `apps/api/tests/health.test.ts` | 30 tests |
| `apps/api/README.md` | endpoint contract and rationale |
| `vitest.shared.ts` | `@pas/*` → source aliases for tests |
| `tsconfig.build.json` × 4 | emitting configs for the Node packages |

## Files Modified

| File | Change |
|---|---|
| `tsconfig.node.json` | `NodeNext` module/resolution; emit-capable (see Known Issues) |
| `packages/{contracts,config,observability}/package.json`, `apps/api/package.json` | `main` → `dist`, `build` script |
| `packages/{contracts,config,observability}/vitest.config.ts` | source aliases |
| root `package.json` | `build` orchestrates Node packages in dependency order, then web |

**`apps/web` source untouched.**

## Database Migrations

None. PAS-0101 registers the database readiness check; this ticket provides the registry.

## Domain Contracts Added/Changed

None. `@pas/api` exports `createApiServer`, `startApi`, the check registry and the handlers.

## API Contracts Added/Changed

Two endpoints, plus a typed 404 using the PAS-0003 envelope. Every response carries
`x-correlation-id` and `cache-control: no-store` — a cached health response reports the state
of a past moment, which is the one thing a probe must never act on.

## Events / Workflow / Governance / Authorization Changes

None. Probes are unauthenticated by necessity: an orchestrator has no credentials. That is
precisely why the deployed response body is minimal.

## Tests Added

**30 tests.**

| Group | Covers |
|---|---|
| the two required endpoints | both routes, typed 404, no-store |
| **liveness must not check dependencies** | stays 200 while a critical dependency fails; runs no check at all |
| readiness validates dependencies | critical vs non-critical, timeout, default timeout bound, concurrency |
| checks self-register | PAS-0101/PAS-0604 extensibility; ready with zero checks |
| **do not expose sensitive details** | 6 adversarial tests against a real server |
| correlation (PAS-0004) | body + header, upstream chain, hostile header, concurrent isolation |
| graceful shutdown | liveness up / readiness down; checks skipped while draining |
| pure handlers | testable without a socket |
| configuration check | registers critical, passes, idempotent |

## Tests Passed

```
 ✓ @pas/api            30/30
 ✓ @pas/observability  37/37
 ✓ @pas/contracts      31/31
 ✓ @pas/config         33/33
 ✓ @pas/web             3/3
   Test Files  5 passed (5)
        Tests 134 passed (134)
```

## Typecheck Result

✅ **PASS** — five workspaces, zero errors.

## Build Result

✅ **PASS**. Frontend artifacts **still byte-identical** to `f23d11a`:
`63a17f150ca2f875c2ced46dd0b97be2`.

### Verified against the running process, not only unit tests

```
GET /health   200   x-correlation-id: f67c1b79-…   cache-control: no-store
GET /ready    200   {"status":"ready","checks":[{"name":"configuration","status":"pass"}]}
GET /admin    404   {"error":{"code":"resource.not_found","family":"NOT_FOUND",…}}
```

Production mode, with real-looking secrets in the environment:

```
GET /ready → {"status":"ready","correlationId":"b22f40ae-…"}

leak scan: hunter2 ✓absent  db.internal ✓absent  5432 ✓absent
           configuration ✓absent  checks ✓absent  postgresql ✓absent
           storage.internal ✓absent
```

Startup with incomplete production configuration **refuses to bind the port** and exits with
`ConfigValidationError` listing 11 problems — PAS-0002's fail-fast requirement now
demonstrated at the process level rather than only in unit tests.

## Security / Privacy Impact

**Positive.** This endpoint class is a standard reconnaissance surface and is treated as one.

1. **Deployed responses carry status and correlation id, nothing else.** Not the failure
   detail, and **not the check names** — the set of names is itself a map of PAS's
   dependencies. Verified against the wire bytes of a running production-mode process.

2. **Staging is covered.** `isDeployedEnvironment` includes staging, per PAS-0002's ADR.

3. **Operator detail is scrubbed even locally.** Every check failure passes through
   `scrubDetails`, because development output still reaches terminals, CI logs and screenshots.
   A driver error's message is a prime carrier of connection strings — tested.

4. **Non-`Error` throws are contained.** A check throwing `{secretAccessKey, host}` leaks
   neither — tested.

5. **No stack traces**, in either environment — tested.

6. **Liveness cannot be weaponised into a restart storm.** `/health` performs no I/O.

7. **Every check is time-bounded.** A hanging probe is worse than a failing one: the
   orchestrator assumes the worst and kills a possibly-healthy process.

## Backward Dependency Check

✅ No circular dependencies — DFS over all 20 workspaces.
✅ `@pas/web` remains a dependency of nothing.

`@pas/api → @pas/config, @pas/observability` added beyond PAS-0001's declared
`api → domain/contracts/auth`. **Not discretionary:** PAS-0005 requires `/ready` to validate
dependencies (config is the only one that exists) and PAS-0004 requires every request to carry
a correlation id. The ticket cannot be built without both. Flagged here; revert on request,
at the cost of failing those two requirements.

## Forward Dependencies Unlocked

PAS-0006 (CI) · PAS-0101 (registers the database check) · PAS-0405 (first domain API;
**owns the HTTP framework decision**) · PAS-0604 (registers object storage).

## Known Issues

None outstanding. One defect found and fixed during the ticket, and one decision deferred.

### Defect found — the API process could not start

The endpoints passed 27 tests while the process **did not run**:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/home/user/PAS-PLATFORM/apps/api/src/server.js' imported from .../src/main.ts
```

**Root cause, deeper than the symptom:** `tsconfig.node.json` inherited
`moduleResolution: "bundler"`, `allowImportingTsExtensions: true` and `noEmit: true` from
`tsconfig.base.json`. That is correct for `apps/web` (Vite bundles it) and wrong for a Node
server that must emit and run. **No Node package had a build step at all.** Tests passed
because vitest transforms source; `node` cannot.

Discovered only because the process was smoke-tested rather than trusted to the unit tests —
which is the gap a health endpoint exists to close.

Three independent paths were considered:

| Path | Root cause addressed | Verdict |
|---|---|---|
| **A** — emit real Node output (`tsc` → `dist`), run the artifact | no compiled output exists | **taken** |
| **B** — run TS directly via a loader (`tsx`/`ts-node`) | Node's resolver cannot map `.js`→`.ts` | rejected — ships a transpiler into production, produces no distributable |
| **C** — use `.ts` import specifiers with `--experimental-strip-types` | the specifier itself; `allowImportingTsExtensions` is already on | rejected — experimental flag, no build artifact, and would split the import convention across Node packages |

B and C both leave PAS with nothing deployable, which PAS-3605 (backup/recovery) and
PAS-3608 (performance budgets) assume exists. A is the only path that yields a running
production process.

The `.js` import specifiers already written are **correct for emitted ESM**, so no source
change was needed — only the build. Tests resolve `@pas/*` to source via `vitest.shared.ts`,
so a stale `dist/` can never silently test yesterday's code.

### Deferred — the HTTP framework

`node:http`, zero runtime dependencies. Choosing Fastify, Express or Hono to serve two GET
endpoints would settle the framework for every later endpoint ticket on the basis of a
requirement exercising none of what a framework provides.

**The decision belongs to PAS-0405.** Recommendation recorded there, not acted on here:
Fastify — first-class TypeScript, JSON-schema validation composing with the zod contracts
already in `@pas/contracts`, and a plugin model matching §XLIII's modular monolith.

---

## Acceptance Criteria

| PAS-0005 requirement | Evidence |
|---|---|
| `GET /health` exists | ✅ 200, verified on the running process |
| `GET /ready` exists | ✅ 200/503, verified on the running process |
| `/health` indicates **process** health | ✅ no I/O; stays 200 while a critical dependency fails |
| `/ready` validates required dependencies | ✅ self-registering registry; `configuration` check live |
| …such as database connectivity | ✅ registry is the extension point PAS-0101 uses; tested with a `database` check |
| **Do not expose sensitive infrastructure details publicly** | ✅ 6 adversarial tests + leak scan against a running production process |

Root gate `npm run verify`: **exit 0**.

**STATUS: COMPLETE.**
