#!/usr/bin/env bash
# Applies supabase/migrations/0001_init.sql to a throwaway local Postgres 16 and runs supabase/tests/functions.sql.
# PostGIS, pg_cron and Supabase's auth schema are replaced by the stubs in supabase/tests/shim.sql.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
D="$(mktemp -d /var/tmp/bpop-pg.XXXX)"
RUN=(); [ "$(id -u)" = 0 ] && { chown postgres "$D"; RUN=(su postgres -c); }
run() { if [ ${#RUN[@]} -gt 0 ]; then "${RUN[@]}" "$*"; else bash -c "$*"; fi; }
grep -v '^create extension' "$ROOT/supabase/migrations/0001_init.sql" | sed 's/using gist (location)/(location)/; s/geography(point)/geography/' > "$D/mig.sql"
cp "$ROOT/supabase/tests/shim.sql" "$ROOT/supabase/tests/functions.sql" "$D/"; chmod 644 "$D"/*.sql
run "$PGBIN/initdb -D $D/data -A trust >/dev/null && $PGBIN/pg_ctl -D $D/data -o '-p 55433 -k $D' -l $D/log start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $D/data stop -m fast >/dev/null"; rm -rf "$D"' EXIT
run "psql -h $D -p 55433 -d postgres -v ON_ERROR_STOP=1 -q -f $D/shim.sql -f $D/mig.sql -f $D/functions.sql" 2>&1 | grep -v 'wal_level\|HINT'
