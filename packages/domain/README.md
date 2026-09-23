# `@pas/domain`

Canonical PAS domain objects, contracts and services.

**Status:** identity landed (PAS-0103). The entities themselves arrive at Build 04.

## Allowed dependencies

`@pas/contracts`

Declared per PAS-0001's required architectural dependency direction. Packages whose
dependencies PAS-0001 does not declare carry none at scaffold time — they are added by the
ticket that needs them, never inferred.

> **`apps/web` SHALL NOT become a dependency of this or any domain package** (PAS-0001).

---

## Identity — PAS-0103

```ts
import { generateId, parseId, assertId, isId, type Id } from '@pas/domain';

const id = generateId();                    // '2ff378ee-beeb-49dc-a5d1-94bf85051711'
const fromRequest = parseId(req.params.id); // normalises, or throws ValidationError
const internal = assertId(row.id);          // states an invariant; normalises nothing
```

§XLI: *"IDs must be durable and non-semantic. Do not encode `M01`, `d01` or presentation
assumptions into authority identity. Authority survives redesign. Representation IDs and
authority IDs remain separate."*

### `generateId()` takes no arguments

That is the guarantee, and it is structural rather than a convention anyone has to uphold.
The function cannot encode the entity type, the module, the dossier, the page or the owner,
because it is never told any of them. A generator that accepted a prefix would be one
deadline away from `generateId('auth')`, and the first time an identifier carries meaning is
the last time it is free to change.

### Why UUIDv4, and specifically not v7 or ULID

v7 and ULID are the current default advice: a time-ordered identifier gives a B-tree good
insert locality where a random one fragments it.

Both are disqualified by the same clause. A v7 or ULID **is** a timestamp with random
padding. Sorting them recovers creation order, and creation order is the "sequence meaning"
the ticket forbids. It also leaks to anyone holding two identifiers when each record was
created — information about the subject of a PAS, not about the row.

The index-locality cost is real and accepted. If it is ever measured to matter, the answer is
a separate insert-ordered column the schema owns — never meaning smuggled back into identity.

A test fails if someone swaps in a time-ordered generator: it sorts a batch and asserts the
sorted order is *not* the generation order, and pins the version and variant nibbles.

### Scopes separate identity at compile time only

```ts
type AuthorityEntityId = Id<'AuthorityEntity'>;
type RepresentationId  = Id<'Representation'>;
```

The compiler then refuses to pass one where the other belongs, while both remain
indistinguishable on the wire and in the database. §XLI requires the separation; the moment
it lives in the string, the identifier has become semantic.

**No scopes are declared here.** The entities do not exist yet (Build 04), and naming them
now would be implementation deciding architecture.

### Two entry points, deliberately

| | Input | Normalises | Use |
|---|---|---|---|
| `parseId` | untrusted — a request path, a query parameter, an import | trims, lowercases | the boundary |
| `assertId` | produced inside PAS | nothing | stating an invariant |

`assertId` refuses to normalise on purpose: a value that needed it did not come from where
the caller thought it did, and quietly fixing that hides the real defect.

Neither echoes the rejected value. It is caller-supplied and reaches logs and error bodies.

### An identifier is not a capability

These are unguessable, and that must never be mistaken for a security property. Knowing an
identifier authorizes nothing — authorization is PAS-0203/PAS-0204's capability registry,
checked on every access. An identifier in a URL is a name, not a key.

### Storage

PostgreSQL `uuid` — 16 bytes, natively indexed, and returned as the canonical lowercase form
`isId` requires. Not `text`.

### Not correlation IDs

`@pas/observability` generates correlation and operation IDs, which identify an *operation in
flight*: telemetry, no lifecycle, nothing holds a foreign key to one. These identify governed
records and live in the database forever. See the header of
`packages/observability/src/correlation/ids.ts`.

## Running the tests

```bash
npm run test -w @pas/domain
```

No database required.
