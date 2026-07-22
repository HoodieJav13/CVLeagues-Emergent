#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -h "$1" -p "$2" -U postgres -d "$3" -v ON_ERROR_STOP=1 -At)
SESSION_JSON="$(${PSQL[@]} -c "select value::text from cvf_test.ledger_runtime_state where key='concurrency'")"
SESSION_ID="$(printf '%s' "$SESSION_JSON" | sed -E 's/.*"session_id": "([^"]+)".*/\1/')"
LEASE_TOKEN="$(printf '%s' "$SESSION_JSON" | sed -E 's/.*"lease_token": "([^"]+)".*/\1/')"
LEASE_VERSION="$(printf '%s' "$SESSION_JSON" | sed -E 's/.*"lease_version": ([0-9]+).*/\1/')"
PARTICIPANT_ID="$(${PSQL[@]} -c "select id from public.scorekeeping_participants where session_id='$SESSION_ID' and team_id='30000000-0000-0000-0000-000000000001' limit 1")"

CALL_SQL="select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-0000-0000-000000000001\",\"role\":\"authenticated\",\"aal\":\"aal2\"}',false); set role authenticated; select public.append_scorekeeping_event('$SESSION_ID','$LEASE_TOKEN',$LEASE_VERSION,'race-same-key','record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}'::jsonb,'[{\"participant_id\":\"$PARTICIPANT_ID\",\"role\":\"scorer\",\"stat_key\":\"runs\",\"stat_delta\":1}]'::jsonb)::text;"

"${PSQL[@]}" -c "$CALL_SQL" >"${TMPDIR:-/tmp}/cvf-ledger-race-a-$$.out" &
PID_A=$!
"${PSQL[@]}" -c "$CALL_SQL" >"${TMPDIR:-/tmp}/cvf-ledger-race-b-$$.out" &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

COUNT="$(${PSQL[@]} -c "select count(*) from public.scorekeeping_events where game_id='50000000-0000-0000-0000-000000000952' and idempotency_key='race-same-key'")"
if [[ "$COUNT" != "1" ]]; then
  echo "ledger concurrency failed: expected one event, found $COUNT" >&2
  exit 1
fi
if ! grep -q '"replayed": true' "${TMPDIR:-/tmp}/cvf-ledger-race-a-$$.out" "${TMPDIR:-/tmp}/cvf-ledger-race-b-$$.out"; then
  echo "ledger concurrency failed: neither caller observed an idempotent replay" >&2
  exit 1
fi
rm -f "${TMPDIR:-/tmp}/cvf-ledger-race-a-$$.out" "${TMPDIR:-/tmp}/cvf-ledger-race-b-$$.out"
echo "ledger concurrency: PASS (two connections, one durable event, one replay)"
