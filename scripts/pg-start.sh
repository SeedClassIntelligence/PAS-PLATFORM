#!/usr/bin/env bash
# Starts the local development PostgreSQL if it is not already accepting
# connections.
#
# This container has no init system and reaps the daemon on idle, so a session
# that was working five minutes ago can find the cluster gone. The data
# directory survives; only the process does not. Idempotent — safe to run
# before anything that needs the database.
#
# Full setup, including creating the cluster the first time:
# docs/operations/local-database.md
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/pas-dev}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"

if pg_isready -q 2>/dev/null; then
  echo "postgres: already accepting connections"
  exit 0
fi

if [ ! -d "$PGDATA" ]; then
  echo "postgres: no cluster at $PGDATA — see docs/operations/local-database.md" >&2
  exit 1
fi

su postgres -c "$PGBIN/pg_ctl -D $PGDATA \
  -o '-p 5432 -c listen_addresses=127.0.0.1' \
  -l $PGDATA/server.log -w start"

pg_isready
