#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGDATA_DIR="${TMPDIR:-/tmp}/cvf-pgtest-data-$$"
PGSOCKET_DIR="${TMPDIR:-/tmp}/cvf-pgtest-socket-$$"
PGPORT="${PGPORT:-55432}"
DB_NAME="cvf_pgtest"
LOG_FILE="${TMPDIR:-/tmp}/cvf-pgtest-postgres-$$.log"

cleanup() {
  if [[ -d "$PGDATA_DIR" ]]; then
    pg_ctl -D "$PGDATA_DIR" -m fast -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$PGDATA_DIR" "$PGSOCKET_DIR" "$LOG_FILE"
}
trap cleanup EXIT

mkdir -p "$PGSOCKET_DIR"

initdb -D "$PGDATA_DIR" --no-locale --encoding=UTF8 \
  -c shared_memory_type=mmap \
  -c dynamic_shared_memory_type=mmap >/dev/null
pg_ctl -D "$PGDATA_DIR" \
  -o "-k $PGSOCKET_DIR -p $PGPORT -c listen_addresses='' -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap" \
  -l "$LOG_FILE" -w start >/dev/null

createdb -h "$PGSOCKET_DIR" -p "$PGPORT" "$DB_NAME"

psql -h "$PGSOCKET_DIR" -p "$PGPORT" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/tests/pgtest/supabase_shim.sql"

for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do
  psql -h "$PGSOCKET_DIR" -p "$PGPORT" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -f "$migration"
done

psql -h "$PGSOCKET_DIR" -p "$PGPORT" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/tests/pgtest/assertions.sql"
