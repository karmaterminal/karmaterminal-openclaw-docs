#!/usr/bin/env bash
set -uo pipefail

ROOT="/tmp/silas-comparator-full-4c235d8c-20260719T1930Z"
DOCS="/tmp/silas-proof-matrix-20260719-1206/tools/k6-proofs"
CANDIDATE="4c235d8c1997e8964160117f8d6bf650ad1e8203"
ROWS_FILE="$ROOT/control/remaining-unattended.txt"
LEDGER="$ROOT/control/execution-ledger.jsonl"
LOG_DIR="$ROOT/control/invocation-logs"
OUT_DIR="$ROOT/unattended"
mkdir -p "$LOG_DIR" "$OUT_DIR"

: "${OPENCLAW_SESSION_KEY:?OPENCLAW_SESSION_KEY must be an exact concrete key}"
export OPENCLAW_RUNTIME_BUILD_SHA="$CANDIDATE"
export OPENCLAW_GATEWAY_WS="${OPENCLAW_GATEWAY_WS:-ws://127.0.0.1:18789}"
export OPENCLAW_CREATE_DISPOSABLE_SESSION=true
export OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true
export OPENCLAW_PROOFS_K6_TEMPO_REQUIRED=true
export OPENCLAW_PROOFS_SERVICE_LOG_REQUIRED=true
export OPENCLAW_PROOFS_TEMPO_BASE_URL="${OPENCLAW_PROOFS_TEMPO_BASE_URL:-http://tempo.dandelion.cult}"

append_event() {
  local phase="$1" row="$2" ordinal="$3" rc="${4:-}"
  jq -cn \
    --arg schema "openclaw.k6.silas-comparator-execution-ledger.v1" \
    --arg phase "$phase" \
    --arg row "$row" \
    --argjson ordinal "$ordinal" \
    --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
    --arg candidate "$CANDIDATE" \
    --arg rc "$rc" \
    '{schema:$schema,phase:$phase,row:$row,ordinal:$ordinal,at:$at,candidateSha:$candidate} + (if $rc=="" then {} else {exitCode:($rc|tonumber)} end)' \
    >> "$LEDGER"
}

already_started() {
  local row="$1"
  [[ -f "$LEDGER" ]] && jq -e --arg row "$row" 'select(.phase=="started" and .row==$row)' "$LEDGER" >/dev/null 2>&1
}

ordinal=0
while IFS= read -r row; do
  [[ -n "$row" ]] || continue
  ordinal=$((ordinal + 1))
  if already_started "$row"; then
    append_event "resume-skip-consumed" "$row" "$ordinal"
    continue
  fi

  append_event "started" "$row" "$ordinal"
  log="$LOG_DIR/$(printf '%02d' "$ordinal")-${row}.log"
  set +e
  (
    cd "$DOCS"
    timeout --signal=TERM --kill-after=30s 20m \
      ./scripts/run-proofs.sh --live --out-dir "$OUT_DIR" "$row" "$CANDIDATE"
  ) >"$log" 2>&1
  rc=$?
  set -e
  append_event "finished" "$row" "$ordinal" "$rc"
done < "$ROWS_FILE"

jq -cn \
  --arg schema "openclaw.k6.silas-comparator-unattended-completion.v1" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
  --arg candidate "$CANDIDATE" \
  --arg ledger "$LEDGER" \
  '{schema:$schema,completedAt:$at,candidateSha:$candidate,ledger:$ledger}' \
  > "$ROOT/control/unattended-complete.json"
