#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${CVF_HOSTED_AUTH_PORT:-55882}"
REPORT_PATH="${1:-$ROOT_DIR/supabase/evidence/hosted-auth-matrix-$(date +%F).md}"
shift || true
# Which hosted surface this run targets. Migrations 28 and 29 publish
# separately, so a run against the intermediate state must say so: the m29
# fixture seeds a venue and a starts_at game, which fails during SETUP against
# a database at Migration 28. Defaults to the current repository surface.
SURFACE="m30"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --surface) SURFACE="${2:?--surface requires a value}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
if [[ "$SURFACE" != "m28" && "$SURFACE" != "m29" && "$SURFACE" != "m30" ]]; then
  echo "Unknown matrix surface \"$SURFACE\". Expected m28, m29, or m30." >&2
  exit 2
fi
SERVER_PID=""

cleanup_runner() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill -TERM "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup_runner EXIT INT TERM

command -v node >/dev/null
command -v supabase >/dev/null
test -f "$ROOT_DIR/frontend/.env.local"
test -f "$ROOT_DIR/frontend/node_modules/@supabase/supabase-js/dist/umd/supabase.js"

node "$ROOT_DIR/tests/hosted-auth/server.mjs" \
  --root "$ROOT_DIR" \
  --port "$PORT" \
  --report "$REPORT_PATH" \
  --surface "$SURFACE" &
SERVER_PID=$!

for _ in $(seq 1 600); do
  if curl --silent --fail "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    wait "$SERVER_PID"
  fi
  sleep 0.1
done

if ! curl --silent --fail "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "Hosted authorization runner did not become ready." >&2
  exit 1
fi

URL="http://127.0.0.1:$PORT/"
echo "Hosted authorization matrix ready: $URL"
echo "Surface under test: $SURFACE"
echo "Enter both test-account credentials in the browser; they remain in browser memory only."

if [[ "${CVF_HOSTED_AUTH_NO_OPEN:-0}" != "1" ]]; then
  open "$URL" >/dev/null 2>&1 || true
fi

wait "$SERVER_PID"
SERVER_PID=""
trap - EXIT INT TERM
