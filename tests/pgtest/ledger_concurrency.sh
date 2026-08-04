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

# Practice corrections have no one-active-session-per-game slot to contend for,
# because that index keys on game_id and practice rows are NULL there. Migration
# 30 therefore permits divergent forks and leans entirely on the table-wide
# one-void-per-event unique index to keep two of them from voiding the same
# original. That is a real two-connection claim, so it is proven with two
# connections rather than asserted.
AUTH_SQL="select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-0000-0000-000000000001\",\"role\":\"authenticated\",\"aal\":\"aal2\"}',false); set role authenticated;"
PRACTICE_BASE="$(${PSQL[@]} -c "select value->>'session_id' from cvf_test.ledger_runtime_state where key='practice-flag'")"
TARGET_EVENT="$(${PSQL[@]} -c "select value->>'event_id' from cvf_test.ledger_runtime_state where key='practice-td-home'")"

fork_lease() { # $1 = idempotency-distinct label; echoes "session_id|lease_token|lease_version"
  # The set_config statements emit their own rows, so select the JSON line
  # before extracting or the first row wins the read.
  "${PSQL[@]}" -c "$AUTH_SQL select public.start_practice_correction('$PRACTICE_BASE','Fork race $1')::text" \
    | grep '"session_id"' \
    | sed -E "s/.*\"session_id\": \"([^\"]+)\".*\"lease_token\": \"([^\"]+)\".*\"lease_version\": ([0-9]+).*/\1|\2|\3/"
}
IFS='|' read -r FORK_A_ID FORK_A_TOKEN FORK_A_VERSION <<<"$(fork_lease A)"
IFS='|' read -r FORK_B_ID FORK_B_TOKEN FORK_B_VERSION <<<"$(fork_lease B)"
if [[ -z "$FORK_A_ID" || -z "$FORK_B_ID" || "$FORK_A_ID" == "$FORK_B_ID" ]]; then
  echo "practice fork race failed: expected two distinct correction forks, got '$FORK_A_ID' and '$FORK_B_ID'" >&2
  exit 1
fi

void_sql() { # $1 session, $2 token, $3 version, $4 idempotency key
  printf "%s select public.append_practice_event('%s','%s',%s,'%s','void','void',null,null,null,0,'%s',null,'{}'::jsonb,'[]'::jsonb,null)::text;" \
    "$AUTH_SQL" "$1" "$2" "$3" "$4" "$TARGET_EVENT"
}
# Distinct idempotency keys, so a single winner proves the void guard held and
# not merely that idempotent replay collapsed the two calls.
"${PSQL[@]}" -c "$(void_sql "$FORK_A_ID" "$FORK_A_TOKEN" "$FORK_A_VERSION" 'fork-race-a')" \
  >"${TMPDIR:-/tmp}/cvf-fork-a-$$.out" 2>&1 &
PID_FA=$!
"${PSQL[@]}" -c "$(void_sql "$FORK_B_ID" "$FORK_B_TOKEN" "$FORK_B_VERSION" 'fork-race-b')" \
  >"${TMPDIR:-/tmp}/cvf-fork-b-$$.out" 2>&1 &
PID_FB=$!
FORK_A_RC=0; FORK_B_RC=0
wait "$PID_FA" || FORK_A_RC=$?
wait "$PID_FB" || FORK_B_RC=$?

VOID_COUNT="$(${PSQL[@]} -c "select count(*) from public.scorekeeping_events where voids_event_id='$TARGET_EVENT'")"
if [[ "$VOID_COUNT" != "1" ]]; then
  echo "practice fork race failed: expected exactly one void of the base event, found $VOID_COUNT" >&2
  cat "${TMPDIR:-/tmp}/cvf-fork-a-$$.out" "${TMPDIR:-/tmp}/cvf-fork-b-$$.out" >&2
  exit 1
fi
if [[ "$FORK_A_RC" -eq 0 && "$FORK_B_RC" -eq 0 ]]; then
  echo "practice fork race failed: both forks reported success against one void row" >&2
  exit 1
fi
if [[ "$FORK_A_RC" -ne 0 && "$FORK_B_RC" -ne 0 ]]; then
  echo "practice fork race failed: neither fork completed its void" >&2
  cat "${TMPDIR:-/tmp}/cvf-fork-a-$$.out" "${TMPDIR:-/tmp}/cvf-fork-b-$$.out" >&2
  exit 1
fi
# One winner is not enough on its own: a loser that failed on a lease or an
# authorization slip would look identical here while proving nothing about void
# integrity. Require the rejection to name a void-integrity guard.
LOSER_OUT="${TMPDIR:-/tmp}/cvf-fork-a-$$.out"
if [[ "$FORK_A_RC" -eq 0 ]]; then LOSER_OUT="${TMPDIR:-/tmp}/cvf-fork-b-$$.out"; fi
LOSER_REASON="$(grep -m1 -oiE 'duplicate key value violates unique constraint "[a-z_]+"|A void must reference[^"]*' "$LOSER_OUT" || true)"
if [[ -z "$LOSER_REASON" ]]; then
  echo "practice fork race failed: the losing fork was rejected for an unexpected reason:" >&2
  cat "$LOSER_OUT" >&2
  exit 1
fi
rm -f "${TMPDIR:-/tmp}/cvf-fork-a-$$.out" "${TMPDIR:-/tmp}/cvf-fork-b-$$.out"
echo "practice fork race: PASS (two connections, two divergent forks, one void of the base event)"
echo "practice fork race: loser rejected by -> $LOSER_REASON"
