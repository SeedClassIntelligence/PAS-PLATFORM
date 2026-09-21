# Local PostgreSQL

PAS-0101's tests run against a **real** PostgreSQL. A mocked driver proves the code calls the
functions it calls — not that a transaction rolls back, that a savepoint isolates a nested
failure, or that `statement_timeout` is actually in force on the connection. Those are the
only claims worth making about a connection layer.

## What the tests expect

| | |
|---|---|
| host / port | `127.0.0.1:5432` |
| role | `pas` / `pas` (superuser, for `create extension` later) |
| databases | `pas_development`, `pas_test` |
| connection string | `postgresql://pas:pas@127.0.0.1:5432/pas_test` |

This matches the development default in `packages/config`, so nothing needs configuring for
the default case.

## Option A — Docker (preferred where a daemon is available)

```bash
docker run -d --name pas-postgres \
  -e POSTGRES_USER=pas -e POSTGRES_PASSWORD=pas -e POSTGRES_DB=pas_development \
  -p 5432:5432 postgres:16-alpine

docker exec pas-postgres createdb -U pas pas_test
```

This is what CI uses (`.github/workflows/ci.yml`, `services.postgres`).

## Option B — native install

For environments with no container daemon — including this development container, where the
Docker *client* is installed but no daemon socket exists, so `docker info` misleadingly
exits 0 while printing only the client section.

```bash
apt-get install -y postgresql-16

PGBIN=/usr/lib/postgresql/16/bin
PGDATA=/var/lib/postgresql/pas-dev
mkdir -p "$PGDATA" /var/run/postgresql
chown -R postgres:postgres "$PGDATA" /var/run/postgresql

su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth-local=trust --auth-host=scram-sha-256"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5432 -c listen_addresses=127.0.0.1' -l $PGDATA/server.log -w start"

su postgres -c "$PGBIN/psql -p 5432 -Atc \"create role pas login password 'pas' superuser;\""
su postgres -c "$PGBIN/createdb -p 5432 -O pas pas_development"
su postgres -c "$PGBIN/createdb -p 5432 -O pas pas_test"
```

Verify:

```bash
PGPASSWORD=pas psql -h 127.0.0.1 -U pas -d pas_test -Atc "select version();"
```

The cluster is not persisted across container rebuilds — re-run the block above.

## Running the tests

```bash
npm run test -w @pas/database   # against pas_test
npm run ci                      # the full gate, includes the above
```

`packages/database/vitest.config.ts` pins `PAS_DATABASE_URL` to `pas_test`, so a test run can
never truncate the development database.
