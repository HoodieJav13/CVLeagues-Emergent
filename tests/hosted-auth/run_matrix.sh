#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${CVF_HOSTED_AUTH_PORT:-55882}"
REPORT_PATH="${1:-$ROOT_DIR/supabase/evidence/hosted-auth-matrix-$(date +%F).md}"
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
  --report "$REPORT_PATH" &
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
echo "Enter both test-account credentials in the browser; they remain in browser memory only."

if [[ "${CVF_HOSTED_AUTH_NO_OPEN:-0}" != "1" ]]; then
  open "$URL" >/dev/null 2>&1 || true
fi

wait "$SERVER_PID"
SERVER_PID=""
trap - EXIT INT TERM
