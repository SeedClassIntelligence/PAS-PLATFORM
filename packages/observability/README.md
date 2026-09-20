# `@pas/observability`

Logs, metrics, traces and correlation propagation.

**Implemented:** PAS-0004 — Correlation Context.
**Pending:** PAS-0301 audit ledger · PAS-3606 logs/metrics/traces.

## The three-field model

| Field | Meaning |
|---|---|
| `correlationId` | stable across the entire chain. Every log line, event and query for one logical operation carries it. **This is what you search by.** |
| `operationId` | identifies *this* step. Unique per operation. |
| `causationId` | the `operationId` of the step that caused this one. Absent at the root. |

**Two fields would be insufficient.** With only `correlationId` and `causationId` there is
nothing for a child to point *at* — causation would have to name the correlation, which is the
whole chain, and the causal graph flattens into a set. `operationId` is what makes `A → B → C`
distinguishable from `A → B, A → C`. That matters the moment an ingestion workflow fans out
across parsers and the question becomes *which step produced this bad claim*.

## How identity follows an operation

`AsyncLocalStorage` propagates across every `await`, timer and callback in a Node async
context, without being threaded through signatures. The alternative — an explicit context
parameter on every function — is what PAS-0003 already rejected for `correlationId`: a
contract expensive enough to thread gets routed around, and the field silently stops being
populated.

Crossing a **process** boundary is explicit, because it must be:

| Boundary | Mechanism |
|---|---|
| HTTP | `contextFromHeaders` / `correlationHeaders` |
| Events, outbox, audit | `correlationFields()` → envelope fields (PAS-0302, PAS-0304, PAS-0301) |
| Workers | `contextFromRecord(row)` on claim (PAS-0305) |
| Database | `currentCorrelationId()` for query tagging (PAS-0101) |

## Usage

```ts
// API entry point
runInNewOperation(contextFromHeaders(req.headers, { name: 'POST /api/v1/claims' }), async () => {
  await handler();                       // correlationId available anywhere below
});

// Emitting an event / outbox row
await db.insert('outbox_events', { ...payload, ...correlationFields() });

// Worker claiming that row, in another process
runWithContext(contextFromRecord(row, { kind: 'worker' }), () => dispatch(row));

// A boundary that must not emit uncorrelated output
const correlationId = requireCorrelationId();
```

### `correlationFields()` — the subtle one

It sets `causationId` to the **current operation's id**, not to the current context's
`causationId`. The event is caused by the operation emitting it, not by that operation's own
parent. Getting this backwards produces a causal graph that looks plausible and is wrong.

## Inbound identifiers are untrusted

Correlation ids arrive in headers and are written into log lines and database columns. They
are validated before use:

- charset restricted to `[A-Za-z0-9._-]` — **newlines are rejected**, because a correlation id
  that survives into a log line with a `\n` in it is log injection: an attacker can forge
  entries;
- length bounded to 128 characters, so an inbound header cannot flood logs or abuse storage;
- a malformed value is **discarded and replaced**, never rejected. Failing the request would
  let any upstream break PAS by sending a bad header, and the caller gains nothing from the
  failure. The operation stays traceable — it simply is not linked to the caller's chain.

`traceparent` (W3C Trace Context) is read as a fallback so a chain begun by a standards-
speaking upstream is not broken. PAS does not claim to implement distributed tracing here —
PAS-3606 owns that. Reading one header is cheap; pretending to be a tracing system is not.

## These are not domain object ids

PAS-0103's Canonical ID Service governs the identity of *governed records* — an
AuthorityEntity, a Claim, an Evidence record. Those are durable, non-semantic, and live in the
database forever.

A correlation id identifies an *operation in flight*. It is telemetry. It has no lifecycle and
nothing holds a foreign key to it. Conflating the two would make the ID service a startup
dependency of logging — and PAS-0004 precedes PAS-0103 precisely because correlation must work
before any domain object exists.

## Dependencies

`@pas/contracts` only, for `InternalError`. Adding it creates no cycle: `contracts` is the
universal sink.
