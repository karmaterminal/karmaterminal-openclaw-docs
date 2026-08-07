#!/usr/bin/env bash
set -uo pipefail
DOCS='/tmp/silas-proof-matrix-20260719-1206'
BASE='/tmp/silas-comparator-full-4c235d8c-20260719T1930Z/unattended/4c235d8c1997e8964160117f8d6bf650ad1e8203'
LEDGER='/tmp/silas-comparator-full-4c235d8c-20260719T1930Z/control/postrun-trace-recovery-ledger.jsonl'
find "$BASE" -type f -name 'continuation-trace-collector.error.log' -printf '%h\n' | sort | while IFS= read -r run; do
  row=$(jq -r '.rowId // .row // "unknown"' "$run/row-manifest.json")
  jq -cn --arg row "$row" --arg runDir "$run" --arg phase start --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" '{phase:$phase,row:$row,runDir:$runDir,at:$at}' >> "$LEDGER"
  set +e
  node "$DOCS/tools/k6-proofs/scripts/collect-continuation-trace.mjs" \
    --run-dir "$run" \
    --manifest "$run/row-manifest.json" \
    --seat silas \
    --tempo-url http://tempo.dandelion.cult \
    --timeout-ms 10000 \
    --poll-ms 2000 \
    > "$run/postrun-trace-recovery.json" \
    2> "$run/postrun-trace-recovery.error.log"
  rc=$?
  set -e
  jq -cn --arg row "$row" --arg runDir "$run" --arg phase finished --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" --argjson exitCode "$rc" '{phase:$phase,row:$row,runDir:$runDir,at:$at,exitCode:$exitCode}' >> "$LEDGER"
done
