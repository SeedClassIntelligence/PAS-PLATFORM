# `@pas/ingestion`

Source acquisition, parsers, observation extraction and the ingestion workflow (PAS-1701..1708).

**Status:** scaffold (PAS-0001). No implementation. Populated by its designated build ticket.

## Allowed dependencies

`@pas/domain`, `@pas/workflows`, `@pas/agent-gateway`

Declared per PAS-0001's required architectural dependency direction. Packages whose
dependencies PAS-0001 does not declare carry none at scaffold time — they are added by the
ticket that needs them, never inferred.

> **`apps/web` SHALL NOT become a dependency of this or any domain package** (PAS-0001).
