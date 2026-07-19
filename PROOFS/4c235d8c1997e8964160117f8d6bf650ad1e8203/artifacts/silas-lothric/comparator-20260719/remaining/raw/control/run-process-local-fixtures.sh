#!/usr/bin/env bash
set -uo pipefail
ROOT="/tmp/silas-comparator-full-4c235d8c-20260719T1930Z"
DOCS="/tmp/silas-proof-matrix-20260719-1206"
SOURCE="/tmp/silas-runtime-fixtures-4c235d8c"
CANDIDATE="4c235d8c1997e8964160117f8d6bf650ad1e8203"
LEDGER="$ROOT/control/fixture-execution-ledger.jsonl"
mkdir -p "$ROOT/fixtures" "$ROOT/control/fixture-logs"
[[ "$(git -C "$SOURCE" rev-parse HEAD)" == "$CANDIDATE" ]] || { echo "source candidate mismatch" >&2; exit 91; }
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]] || { echo "source worktree is dirty" >&2; exit 92; }
[[ -d "$SOURCE/node_modules" ]] || { echo "candidate-local dependencies missing" >&2; exit 93; }

append_event() {
  local phase="$1" row="$2" ordinal="$3" rc="${4:-}"
  jq -cn --arg schema "openclaw.k6.silas-comparator-fixture-ledger.v1" --arg phase "$phase" --arg row "$row" --argjson ordinal "$ordinal" --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" --arg candidate "$CANDIDATE" --arg rc "$rc" '{schema:$schema,phase:$phase,row:$row,ordinal:$ordinal,at:$at,candidateSha:$candidate} + (if $rc=="" then {} else {exitCode:($rc|tonumber)} end)' >> "$LEDGER"
}
started() {
  local row="$1"
  [[ -f "$LEDGER" ]] && jq -e --arg row "$row" 'select(.phase=="started" and .row==$row)' "$LEDGER" >/dev/null 2>&1
}
run_fixture() {
  local row="$1" ordinal="$2" script="$3" extra_a="$4" extra_b="$5"
  if started "$row"; then append_event "resume-skip-consumed" "$row" "$ordinal"; return; fi
  local artifact="$ROOT/fixtures/$row"
  if [[ -e "$artifact" ]]; then
    echo "refusing non-empty/pre-existing artifact dir: $artifact" >&2
    exit 90
  fi
  mkdir "$artifact"
  append_event "started" "$row" "$ordinal"
  set +e
  timeout --signal=TERM --kill-after=30s 30m node "$DOCS/tools/k6-proofs/scripts/$script" \
    --source-dir "$SOURCE" \
    --candidate-sha "$CANDIDATE" \
    --artifact-dir "$artifact" \
    "$extra_a" "$extra_b" \
    --json > "$ROOT/control/fixture-logs/$row.stdout.json" 2> "$ROOT/control/fixture-logs/$row.stderr.log"
  local rc=$?
  set -e
  append_event "finished" "$row" "$ordinal" "$rc"
}

run_fixture "R-CW-5" 1 "run-cost-cap-fixture.mjs" "--cap" "100"
run_fixture "R-CW-6" 2 "run-max-chain-fixture.mjs" "--max-chain-length" "3"
jq -cn --arg schema "openclaw.k6.silas-comparator-fixture-completion.v1" --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" --arg candidate "$CANDIDATE" '{schema:$schema,completedAt:$at,candidateSha:$candidate}' > "$ROOT/control/fixtures-complete.json"
