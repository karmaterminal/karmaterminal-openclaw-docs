#!/usr/bin/env bash
set -u -o pipefail
cd /home/figs/source/karmaterminal-openclaw-docs/tools/k6-proofs
CANDIDATE=e08f696618da57e7267a2148578fa4ab0d8b0d01
WORK="/tmp/p81-ronan-live-e08f696-20260709T032347Z"
OUT="$WORK/artifacts"
ROWS="R-CD-1,R-CD-2,R-CD-3,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-COLLECTION-ON-COLLAPSE,R-CD-MODEL-CHAINED-ALT,R-CD-MODEL-DEFAULT,R-CD-MODEL-TOKEN,R-CD-MODEL-TOOL,R-CD-RETURN-OVERLAP,R-CD-SILENT,R-CD-TOKEN,R-CONFIG-defaults,R-CONFIG-INTERSESSION,R-CW-1,R-CW-2,R-CW-3,R-CW-4,R-CW-5,R-CW-6,R-CW-7,R-CW-DELEGATE-CHILD-LIVE,R-CW-DELEGATE-SELF-CONTINUATION,R-CW-DELEGATE-TOKEN,R-CW-MULTI-COLLAPSE,R-CW-MULTI,R-CW-TOKEN,R-OBS-1,R-OBS-2,R-OBS-status,R-RC-1,R-RC-2,R-REGRESSION-TRAP-TESTS,R-TRACE-REDACTION-1121"
export OPENCLAW_GATEWAY_WS="ws://127.0.0.1:18789"
export OPENCLAW_RUNTIME_BUILD_SHA="$CANDIDATE"
export OPENCLAW_CREATE_DISPOSABLE_SESSION=true
export OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true
export OPENCLAW_PROOFS_K6_TEMPO_REQUIRED=false
export OPENCLAW_PROOFS_K6_METRICS_REQUIRED=false
export OPENCLAW_PROOFS_K6_REPORT_REQUIRED=false
printf 'started=%s\nwork=%s\ncandidate=%s\nrows=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$WORK" "$CANDIDATE" "$ROWS" > "$WORK/status.txt"
IFS=',' read -ra ROW_ARRAY <<< "$ROWS"
: > "$WORK/results.tsv"
for row in "${ROW_ARRAY[@]}"; do
  start=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "[$start] START $row" | tee -a "$WORK/status.txt"
  set +e
  ./scripts/run-proofs.sh --live --out-dir "$OUT" "$row" "$CANDIDATE" > "$WORK/logs/${row}.log" 2>&1
  rc=$?
  set -e
  end=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '%s\t%s\t%s\t%s\n' "$row" "$rc" "$start" "$end" >> "$WORK/results.tsv"
  echo "[$end] END $row rc=$rc" | tee -a "$WORK/status.txt"
  # continue past blockers; issues will be filed/reconciled after artifact review, not during the loop
  sync || true
done
node scripts/render-run-report.mjs --root "$OUT" --out "$WORK/report.html" > "$WORK/report-receipt.json" 2> "$WORK/report-error.log" || true
printf 'finished=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$WORK/status.txt"
