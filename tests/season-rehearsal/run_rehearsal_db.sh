#!/usr/bin/env bash
# Local-database leg of the Season 1 rehearsal: a throwaway Postgres cluster,
# the pgtest Supabase shim, all repository migrations, then the SQL emitted by
# rehearsal_db.cjs. Nothing touches a hosted project. Mirrors
# tests/pgtest/run_pgtest.sh (needs initdb/pg_ctl/psql on PATH and a non-root
# user, exactly like the harness).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cvf-rehearsal-db-XXXXXX")"
PGPORT="${PGPORT:-55433}"
cleanup() { pg_ctl -D "$WORK/data" -m fast -w stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
initdb -D "$WORK/data" --no-locale --encoding=UTF8 --username=postgres >/dev/null
pg_ctl -D "$WORK/data" -o "-k $WORK -p $PGPORT -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
createdb -h "$WORK" -p "$PGPORT" -U postgres cvf_rehearsal
PSQL=(psql -h "$WORK" -p "$PGPORT" -U postgres -d cvf_rehearsal -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT_DIR/tests/pgtest/supabase_shim.sql" >/dev/null
for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$migration" >/dev/null; done
echo "migrations applied: $(ls "$ROOT_DIR"/supabase/migrations/*.sql | wc -l)"
node "$ROOT_DIR/tests/season-rehearsal/rehearsal_db.cjs" > "$WORK/rehearsal.sql"
"${PSQL[@]}" -f "$WORK/rehearsal.sql" | tee "$WORK/out.txt"
grep -qE '^\s+[0-9]+ \|\s+[0-9]+ \|\s+0$' "$WORK/out.txt"
