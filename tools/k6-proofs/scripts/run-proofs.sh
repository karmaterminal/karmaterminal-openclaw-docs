#!/usr/bin/env bash
#
# Seat-aware row-list runner for Project 81 / k6-proofs
# References: #178 / #106 / #119 / #179 / #403
#
# Usage:
#   cd tools/k6-proofs
#   ./scripts/run-proofs.sh [--dry-run] [--out-dir /tmp/k6-proof-runs] [R-CD-2,R-CD-4] [candidate_sha]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_EXTRACTOR="$SCRIPT_DIR/extract-k6-evidence.mjs"
CONTINUATION_TRACE_COLLECTOR="$SCRIPT_DIR/collect-continuation-trace.mjs"
R_CD_2_LIFECYCLE_RESOLVER="$SCRIPT_DIR/resolve-r-cd-2-lifecycle-receipt.mjs"
ARTIFACT_SANITIZER="$SCRIPT_DIR/sanitize-k6-artifacts.mjs"
PRIVATE_K6_LOG=""
PRIVATE_EVIDENCE_FILE=""
PRIVATE_GATEWAY_LOG=""
SOURCE_CONTRACT_FILE=""

cleanup_private_artifacts() {
  rm -f \
    "${PRIVATE_K6_LOG:-}" \
    "${PRIVATE_EVIDENCE_FILE:-}" \
    "${PRIVATE_GATEWAY_LOG:-}" \
    "${SOURCE_CONTRACT_FILE:-}"
}
trap cleanup_private_artifacts EXIT

DRY_RUN=true
ROWS=""
CANDIDATE_SHA=""
SESSION_SELECTOR="discord-channel:1466192485440164011"
OUT_ROOT="${K6_PROOF_OUT_DIR:-/tmp/k6-proof-runs}"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --live) DRY_RUN=false; shift ;;
    --session) SESSION_SELECTOR="$2"; shift 2 ;;
    --out-dir) OUT_ROOT="$2"; shift 2 ;;
    *)
      if [[ -z "$ROWS" ]]; then
        ROWS="$1"
      elif [[ -z "$CANDIDATE_SHA" ]]; then
        CANDIDATE_SHA="$1"
      else
        echo "Unknown argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$ROWS" ]]; then
  echo "Error: must specify comma-separated list of rows (e.g. R-CD-2,R-CD-4) or 'all'."
  exit 1
fi

if [[ -z "$CANDIDATE_SHA" && -z "${OPENCLAW_CANDIDATE_SHA:-}" ]]; then
  CANDIDATE_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
fi

if [[ -n "$CANDIDATE_SHA" ]]; then export OPENCLAW_CANDIDATE_SHA="${CANDIDATE_SHA}"; fi
export OPENCLAW_SEAT_NAME="$(hostname)"

# Local Gateway Auth extraction (never logged/committed)
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" && -f ~/.openclaw/openclaw.json ]]; then
  export OPENCLAW_GATEWAY_TOKEN="$(jq -r '.gateway.auth.token // .auth.operatorToken // empty' ~/.openclaw/openclaw.json)"
fi
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  echo "Warning: OPENCLAW_GATEWAY_TOKEN not found in local config."
  if [[ "$DRY_RUN" == "false" ]]; then
    exit 1
  fi
fi

# Fetch deployed runtime build stamp explicitly (do not collapse into CANDIDATE_SHA).
# Operators may provide OPENCLAW_RUNTIME_BUILD_SHA when they have an external deploy
# receipt for the exact SHA. Otherwise prefer a structured CLI receipt when available
# and fall back to the human version string (for example, "OpenClaw ... (1cc8f4e)").
DEPLOYED_BUILD_STAMP="${OPENCLAW_RUNTIME_BUILD_SHA:-unknown}"
if [[ "$DEPLOYED_BUILD_STAMP" == "unknown" && -f ~/.openclaw/openclaw.json ]]; then
  if openclaw version --json >/dev/null 2>&1; then
    DEPLOYED_BUILD_STAMP="$(openclaw version --json | jq -r '.build.sha // empty')"
  elif openclaw --version >/dev/null 2>&1; then
    DEPLOYED_BUILD_STAMP="$(openclaw --version | head -n 1)"
  fi
fi
export OPENCLAW_RUNTIME_BUILD_SHA="$DEPLOYED_BUILD_STAMP"

# Portable observability endpoints. Defaults preserve the dandelion fleet, but
# reviewers can override without editing scripts or docs-local config.
export OPENCLAW_PROOFS_TEMPO_BASE_URL="${OPENCLAW_PROOFS_TEMPO_BASE_URL:-${TEMPO_BASE_URL:-http://tempo.dandelion.cult}}"
export OPENCLAW_PROOFS_LOKI_BASE_URL="${OPENCLAW_PROOFS_LOKI_BASE_URL:-${LOKI_BASE_URL:-http://loki.dandelion.cult}}"
export OPENCLAW_PROOFS_PROMETHEUS_BASE_URL="${OPENCLAW_PROOFS_PROMETHEUS_BASE_URL:-${PROMETHEUS_BASE_URL:-http://prometheus.dandelion.cult}}"

# Resolve Session Key
if [[ -z "${OPENCLAW_SESSION_KEY:-}" ]]; then
  echo "Resolving session key for selector: $SESSION_SELECTOR"
  case "$SESSION_SELECTOR" in
    main|agent:*)
      export OPENCLAW_SESSION_KEY="$SESSION_SELECTOR"
      ;;
    *)
      export OPENCLAW_SESSION_KEY="main" # Fallback/stub. In a full implementation this shells out to `openclaw sessions --json`
      ;;
  esac
fi

echo "=========================================================="
echo "Project 81: Seat-Aware k6 Proof Runner"
echo "Seat: $OPENCLAW_SEAT_NAME"
echo "Target Candidate SHA: $OPENCLAW_CANDIDATE_SHA"
echo "Deployed Runtime SHA: $OPENCLAW_RUNTIME_BUILD_SHA"
echo "Session configured: true"
echo "Artifact root: $OUT_ROOT"
if [[ "$ROWS" == "all" ]]; then
  ROWS="$(for f in manifests/*.json; do jq -r 'select(.scenario.status == "runnable") | .rowId' "$f"; done | paste -sd, -)"
fi

if [[ -z "$ROWS" ]]; then
  echo "No runnable rows found."
  exit 1
fi

echo "Rows: $ROWS"
echo "Dry Run: $DRY_RUN"
echo "=========================================================="

# Check for Live Bridge alignment (candidate vs deployed runtime)
if [[ "$DRY_RUN" == "false" && "$OPENCLAW_CANDIDATE_SHA" != "$OPENCLAW_RUNTIME_BUILD_SHA" && "$OPENCLAW_RUNTIME_BUILD_SHA" != *"(${OPENCLAW_CANDIDATE_SHA:0:7})"* ]]; then
  echo "WARNING: Candidate SHA ($OPENCLAW_CANDIDATE_SHA) does not match Deployed Runtime SHA ($OPENCLAW_RUNTIME_BUILD_SHA)."
  echo "Unless this is a known stale-stamp or you have proven a rebuild bridge, live proofs will be marked HONEST-LIMIT / negative-partial."
fi

mkdir -p "$OUT_ROOT"
SEAT_READINESS_JSON="$OUT_ROOT/seat-readiness.json"
if [[ "$DRY_RUN" == "false" ]]; then
  echo "Running seat-readiness preflight (k6/tooling/gateway/continuation config)..."
  if ! node scripts/seat-readiness-preflight.mjs --json > "$SEAT_READINESS_JSON"; then
    echo "SEAT READINESS FAILED: $SEAT_READINESS_JSON" >&2
    jq -r '.outcome as $out | "outcome=\($out) continuation=\(.continuation.enabled) defaults=\(.continuation.defaultsPresent) notes=\(.notes|join("; "))"' "$SEAT_READINESS_JSON" >&2 || true
    exit 1
  fi
  echo "SEAT READINESS: $SEAT_READINESS_JSON"
fi

IFS=',' read -ra ROW_ARRAY <<< "$ROWS"

for ROW_ID in "${ROW_ARRAY[@]}"; do
  # Normalize row ID
  ROW_ID="$(echo "$ROW_ID" | tr '[:lower:]' '[:upper:]')"

  # Find manifest (case-insensitive so lowercase preflight still works)
  MANIFEST_FILE=""
  for f in manifests/*.json; do
    if jq -e --arg row "$ROW_ID" '(.rowId | ascii_upcase) == $row' "$f" >/dev/null; then
      MANIFEST_FILE="$(pwd)/$f" # Absolute path
      break
    fi
  done

  if [[ -z "$MANIFEST_FILE" ]]; then
    echo "[$ROW_ID] SKIPPED: Manifest not found."
    continue
  fi

  SCENARIO_FILE=$(jq -r '.scenario.file // .scenario.name // empty' "$MANIFEST_FILE")
  SCENARIO_STATUS=$(jq -r '.scenario.status' "$MANIFEST_FILE")
  LIVE_SAFETY=$(jq -r '.liveRunSafety.classification // "unknown"' "$MANIFEST_FILE")

  echo ""
  echo "----------------------------------------"
  echo "Row: $ROW_ID"
  echo "Manifest: $MANIFEST_FILE"
  echo "Scenario: ${SCENARIO_FILE:+scenarios/$SCENARIO_FILE}"
  echo "Status: $SCENARIO_STATUS"
  echo "Live Safety: $LIVE_SAFETY"

  if [[ "$SCENARIO_STATUS" != "runnable" ]]; then
    echo "[$ROW_ID] SKIPPED: Scenario status is $SCENARIO_STATUS (not runnable)."
    continue
  fi

  if [[ -z "$SCENARIO_FILE" || ! -f "scenarios/$SCENARIO_FILE" ]]; then
    echo "[$ROW_ID] SKIPPED: runnable scenario file missing: scenarios/$SCENARIO_FILE"
    continue
  fi

  if [[ "$DRY_RUN" == "false" && "$LIVE_SAFETY" != "k6-runnable" ]]; then
    echo "[$ROW_ID] SKIPPED: liveRunSafety classification ($LIVE_SAFETY) rejects unattended live fire."
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[$ROW_ID] DRY RUN: Would execute k6 run scenarios/$SCENARIO_FILE"
  else
    echo "[$ROW_ID] RUNNING..."
    export OPENCLAW_ROW_MANIFEST="$MANIFEST_FILE"

    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$ROW_ID" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
    RUN_DIR="$OUT_ROOT/$OPENCLAW_CANDIDATE_SHA/$ROW_ID/$OPENCLAW_SEAT_NAME/$RUN_ID"
    mkdir -p "$RUN_DIR"
    touch "$RUN_DIR/.started"
    cp "$MANIFEST_FILE" "$RUN_DIR/row-manifest.json"
    RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    if [[ -f "$SEAT_READINESS_JSON" ]]; then
      cp "$SEAT_READINESS_JSON" "$RUN_DIR/seat-readiness.json"
    fi
    jq -n \
      --arg row "$ROW_ID" \
      --arg scenario "$SCENARIO_FILE" \
      --arg candidate "$OPENCLAW_CANDIDATE_SHA" \
      --arg runtime "$OPENCLAW_RUNTIME_BUILD_SHA" \
      --arg seat "$OPENCLAW_SEAT_NAME" \
      --arg started "$RUN_STARTED_AT" \
      '{row:$row, scenario:$scenario, candidateSha:$candidate, runtimeBuildSha:$runtime, seat:$seat, sessionConfigured:true, startedAt:$started}' \
      > "$RUN_DIR/runner-metadata.json"

    PRIVATE_K6_LOG="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-log.XXXXXX")"
    PRIVATE_EVIDENCE_FILE="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-evidence.XXXXXX")"
    PRIVATE_GATEWAY_LOG="$(mktemp "${TMPDIR:-/tmp}/openclaw-gateway-journal.XXXXXX")"
    GATEWAY_UNIT="${OPENCLAW_PROOFS_GATEWAY_UNIT:-openclaw-gateway}"
    GATEWAY_JOURNAL_CURSOR=""
    GATEWAY_JOURNAL_METHOD="unavailable"
    GATEWAY_JOURNAL_RC=1
    if command -v journalctl >/dev/null 2>&1; then
      GATEWAY_JOURNAL_CURSOR="$(
        journalctl --user -u "$GATEWAY_UNIT" --show-cursor -n 0 --no-pager 2>/dev/null \
          | sed -n 's/^-- cursor: //p' \
          | tail -n 1
      )"
    fi
    SOURCE_CONTRACT_FILE=""
    SOURCE_CONTRACT_TRANSPORT="$(jq -r '.transport // empty' "$MANIFEST_FILE")"
    if [[ "$SOURCE_CONTRACT_TRANSPORT" == "github-source-contract" ]]; then
      SOURCE_CONTRACT_REPOSITORY="$(jq -r '.sourceContract.repository // empty' "$MANIFEST_FILE")"
      SOURCE_CONTRACT_PATH="$(jq -r '.sourceContract.path // empty' "$MANIFEST_FILE")"
      if [[ ! "$SOURCE_CONTRACT_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ||
            ! "$SOURCE_CONTRACT_PATH" =~ ^[A-Za-z0-9_./-]+$ ||
            "$SOURCE_CONTRACT_PATH" == *".."* ]]; then
        echo "[$ROW_ID] SOURCE CONTRACT CONFIG INVALID; running k6 as BAD_PROOF." >&2
        SOURCE_CONTRACT_FILE="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-source.XXXXXX")"
        : > "$SOURCE_CONTRACT_FILE"
      else
        SOURCE_CONTRACT_FILE="$(mktemp "${TMPDIR:-/tmp}/openclaw-k6-source.XXXXXX")"
        SOURCE_CONTRACT_URL="https://raw.githubusercontent.com/${SOURCE_CONTRACT_REPOSITORY}/${OPENCLAW_CANDIDATE_SHA}/${SOURCE_CONTRACT_PATH}"
        if ! curl --fail --silent --show-error --location --max-time 20 "$SOURCE_CONTRACT_URL" > "$SOURCE_CONTRACT_FILE"; then
          echo "[$ROW_ID] EXACT CANDIDATE SOURCE PREFETCH FAILED; running k6 as BAD_PROOF." >&2
          : > "$SOURCE_CONTRACT_FILE"
        fi
      fi
      export OPENCLAW_STATUS_SOURCE_PATH="$SOURCE_CONTRACT_FILE"
    else
      unset OPENCLAW_STATUS_SOURCE_PATH
    fi
    POSTPROCESS_RC=0
    set +e
    k6 run "scenarios/$SCENARIO_FILE" > "$PRIVATE_K6_LOG" 2>&1
    k6_rc=$?
    set -e
    RUN_ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    set +e
    if [[ -n "$GATEWAY_JOURNAL_CURSOR" ]]; then
      journalctl \
        --user \
        -u "$GATEWAY_UNIT" \
        --after-cursor="$GATEWAY_JOURNAL_CURSOR" \
        --output=short-iso-precise \
        --no-pager \
        > "$PRIVATE_GATEWAY_LOG" 2>&1
      GATEWAY_JOURNAL_RC="$?"
      GATEWAY_JOURNAL_METHOD="cursor"
    fi
    if [[ "$GATEWAY_JOURNAL_RC" -ne 0 ]] && command -v journalctl >/dev/null 2>&1; then
      journalctl \
        --user \
        -u "$GATEWAY_UNIT" \
        --since "$RUN_STARTED_AT" \
        --until "$RUN_ENDED_AT" \
        --output=short-iso-precise \
        --no-pager \
        > "$PRIVATE_GATEWAY_LOG" 2>&1
      GATEWAY_JOURNAL_RC="$?"
      GATEWAY_JOURNAL_METHOD="utc-window-fallback"
    fi
    set -e
    GATEWAY_JOURNAL_STATUS="captured"
    if [[ "$GATEWAY_JOURNAL_RC" -ne 0 ]]; then
      GATEWAY_JOURNAL_STATUS="unavailable"
    fi
    jq -n \
      --arg unit "$GATEWAY_UNIT" \
      --arg method "$GATEWAY_JOURNAL_METHOD" \
      --arg status "$GATEWAY_JOURNAL_STATUS" \
      --arg startedAt "$RUN_STARTED_AT" \
      --arg endedAt "$RUN_ENDED_AT" \
      --argjson exitCode "$GATEWAY_JOURNAL_RC" \
      --argjson rawLines "$(wc -l < "$PRIVATE_GATEWAY_LOG")" \
      '{
        schema: "openclaw.k6.gateway-journal-capture.v1",
        unit: $unit,
        method: $method,
        status: $status,
        startedAt: $startedAt,
        endedAt: $endedAt,
        exitCode: $exitCode,
        rawLines: $rawLines
      }' > "$RUN_DIR/gateway-journal-capture.json"

    find . -maxdepth 1 -type f -name '*summary.json' -newer "$RUN_DIR/.started" -print -exec mv {} "$RUN_DIR" \;
    if ! node "$EVIDENCE_EXTRACTOR" \
      --input "$PRIVATE_K6_LOG" \
      --out "$PRIVATE_EVIDENCE_FILE" \
      > "$RUN_DIR/evidence-extraction.json" 2> "$RUN_DIR/evidence-extraction.error.log"; then
      echo "[$ROW_ID] EVIDENCE EXTRACTION FAILED; see $RUN_DIR/evidence-extraction.error.log" >&2
      : > "$PRIVATE_EVIDENCE_FILE"
      POSTPROCESS_RC=1
    else
      rm -f "$RUN_DIR/evidence-extraction.error.log"
    fi
    SUMMARY_VERDICT="unknown"
    SUMMARY_VERDICT_SOURCE="none"
    SUMMARY_FILE_VERDICT="unknown"
    VU_LOG_VERDICT="$(
      grep -oE 'VERDICT: (PASS|PARTIAL|HONEST-LIMIT|FAIL)-candidate' "$PRIVATE_K6_LOG" \
        | tail -n 1 \
        | sed 's/^VERDICT: //' \
        || true
    )"
    SUMMARY_FILES_JSON="[]"
    if find "$RUN_DIR" -maxdepth 1 -type f -name '*summary.json' | grep -q .; then
      SUMMARY_FILES_JSON="$(find "$RUN_DIR" -maxdepth 1 -type f -name '*summary.json' -print0 | xargs -0 -r -n1 basename | jq -R . | jq -s .)"
      SUMMARY_FILE_VERDICT="$(find "$RUN_DIR" -maxdepth 1 -type f -name '*summary.json' -print0 | xargs -0 -r jq -r 'select(.verdict != null) | .verdict' | head -n 1)"
      if [[ -z "$SUMMARY_FILE_VERDICT" ]]; then SUMMARY_FILE_VERDICT="unknown"; fi
    fi
    if [[ -n "$VU_LOG_VERDICT" ]]; then
      SUMMARY_VERDICT="$VU_LOG_VERDICT"
      SUMMARY_VERDICT_SOURCE="vu-log"
    elif [[ "$SUMMARY_FILE_VERDICT" != "unknown" ]]; then
      SUMMARY_VERDICT="$SUMMARY_FILE_VERDICT"
      SUMMARY_VERDICT_SOURCE="summary-file"
    fi
    if [[ -n "$VU_LOG_VERDICT" &&
          "$SUMMARY_FILE_VERDICT" != "unknown" &&
          "$VU_LOG_VERDICT" != "$SUMMARY_FILE_VERDICT" ]]; then
      jq -n \
        --arg schema "openclaw.k6.verdict-reconciliation.v1" \
        --arg selected "$SUMMARY_VERDICT" \
        --arg selectedSource "$SUMMARY_VERDICT_SOURCE" \
        --arg vuLog "$VU_LOG_VERDICT" \
        --arg summaryFile "$SUMMARY_FILE_VERDICT" \
        '{
          schema: $schema,
          selectedVerdict: $selected,
          selectedSource: $selectedSource,
          vuLogVerdict: $vuLog,
          summaryFileVerdict: $summaryFile,
          reason: "k6 handleSummary executes outside VU state; the VU-emitted verdict owns live evidence classification"
        }' > "$RUN_DIR/verdict-reconciliation.json"
    fi
    TRACE_STATUS="unknown"
    TRACE_ID=""
    TEMPO_TRACE_PATH=""
    TEMPO_TRACE_JSON=""
    CORRELATION_RECEIPT_PATH=""
    CORRELATION_RECEIPT=""
    REVIEW_PENDING_RECEIPTS='[]'
    if [[ "$GATEWAY_JOURNAL_STATUS" != "captured" ]]; then
      REVIEW_PENDING_RECEIPTS='["gateway-journal"]'
    fi
    TRACE_REQUIRED="$(jq -r '((.liveRunSafety.requiredReceipts // []) | map(ascii_downcase) | any(. == "trace-id" or . == "tempo-trace-json"))' "$MANIFEST_FILE")"
    MANIFEST_TOOL="$(jq -r '.invocation.tool // empty' "$MANIFEST_FILE")"
    if [[ -s "$PRIVATE_EVIDENCE_FILE" ]]; then
      if jq -e 'select(has("trace_id"))' "$PRIVATE_EVIDENCE_FILE" >/dev/null; then
        TRACE_ID="$(jq -r 'select((.trace_id // "") != "") | .trace_id' "$PRIVATE_EVIDENCE_FILE" | head -n 1)"
      fi
    fi
    if [[ "$TRACE_REQUIRED" == "true" && -n "$MANIFEST_TOOL" ]]; then
      COLLECTOR_RESULT="$RUN_DIR/continuation-trace-collector.json"
      COLLECTOR_ERROR="$RUN_DIR/continuation-trace-collector.error.log"
      if node "$CONTINUATION_TRACE_COLLECTOR" \
        --run-dir "$RUN_DIR" \
        --manifest "$MANIFEST_FILE" \
        --seat "$OPENCLAW_SEAT_NAME" \
        --evidence "$PRIVATE_EVIDENCE_FILE" \
        --tempo-url "$OPENCLAW_PROOFS_TEMPO_BASE_URL" \
        > "$COLLECTOR_RESULT" 2> "$COLLECTOR_ERROR"; then
        TRACE_ID="$(jq -r '.traceId' "$COLLECTOR_RESULT")"
        TEMPO_TRACE_JSON="$(jq -r '.traceFile' "$COLLECTOR_RESULT")"
        TEMPO_TRACE_PATH="$RUN_DIR/$TEMPO_TRACE_JSON"
        CORRELATION_RECEIPT="$(jq -r '.receiptFile' "$COLLECTOR_RESULT")"
        CORRELATION_RECEIPT_PATH="$RUN_DIR/$CORRELATION_RECEIPT"
        TRACE_STATUS="present"
        rm -f "$COLLECTOR_ERROR"
        echo "[$ROW_ID] CONTINUATION TRACE: $TEMPO_TRACE_PATH"
        echo "[$ROW_ID] CORRELATION RECEIPT: $CORRELATION_RECEIPT_PATH"
      else
        TRACE_STATUS="missing"
        TRACE_ID=""
        if [[ "$MANIFEST_TOOL" == "continue_delegate" || "$MANIFEST_TOOL" == "continue_work" ]]; then
          REVIEW_PENDING_RECEIPTS="$(
            jq -cn \
              --argjson current "$REVIEW_PENDING_RECEIPTS" \
              '$current + ["tempo-trace-json","continuation-trace-correlation"] | unique'
          )"
        else
          REVIEW_PENDING_RECEIPTS="$(
            jq -cn \
              --argjson current "$REVIEW_PENDING_RECEIPTS" \
              '$current + ["tempo-trace-json","tool-trace-correlation"] | unique'
          )"
        fi
        echo "[$ROW_ID] TRACE CORRELATION FAILED; see $COLLECTOR_ERROR" >&2
        if [[ "${OPENCLAW_PROOFS_K6_TEMPO_REQUIRED:-false}" == "true" ]]; then
          POSTPROCESS_RC=1
        fi
      fi
    elif [[ -n "$TRACE_ID" ]]; then
      TEMPO_TRACE_JSON="tempo-trace-${TRACE_ID:0:12}.json"
      TEMPO_TRACE_PATH="$RUN_DIR/$TEMPO_TRACE_JSON"
      if node scripts/fetch-tempo-trace.mjs --trace-id "$TRACE_ID" --tempo-url "$OPENCLAW_PROOFS_TEMPO_BASE_URL" --out "$TEMPO_TRACE_PATH" > "$RUN_DIR/tempo-trace-receipt.json" 2> "$RUN_DIR/tempo-trace-error.log"; then
        TRACE_STATUS="present"
        echo "[$ROW_ID] TEMPO TRACE: $TEMPO_TRACE_PATH"
      else
        TRACE_STATUS="missing"
        if [[ "$TRACE_REQUIRED" == "true" ]]; then
          REVIEW_PENDING_RECEIPTS="$(
            jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" \
              '$current + ["tempo-trace-json"] | unique'
          )"
        fi
        echo "[$ROW_ID] TEMPO TRACE FETCH FAILED; see $RUN_DIR/tempo-trace-error.log" >&2
        if [[ "${OPENCLAW_PROOFS_K6_TEMPO_REQUIRED:-false}" == "true" ]]; then
          POSTPROCESS_RC=1
        fi
      fi
    elif [[ "$TRACE_REQUIRED" == "true" ]]; then
      TRACE_STATUS="missing"
      REVIEW_PENDING_RECEIPTS="$(
        jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" \
          '$current + ["tempo-trace-json"] | unique'
      )"
    fi

    # R-CD-2 has one authority: a resolver joins private local evidence with
    # the private strict correlation product, then emits only a safe receipt.
    # Raw Tempo/correlation files are acquisition inputs and never public rows.
    R_CD_2_LIFECYCLE_RECEIPT=""
    if [[ "$ROW_ID" == "R-CD-2" ]]; then
      R_CD_2_LIFECYCLE_RECEIPT="r-cd-2-lifecycle-receipt.json"
      if ! node "$R_CD_2_LIFECYCLE_RESOLVER" \
        --run-dir "$RUN_DIR" \
        --evidence "$PRIVATE_EVIDENCE_FILE" \
        --correlation "$CORRELATION_RECEIPT_PATH" \
        > "$RUN_DIR/r-cd-2-lifecycle-resolver.json"; then
        echo "[$ROW_ID] lifecycle resolver failed" >&2
        POSTPROCESS_RC=1
      fi
      if [[ -f "$RUN_DIR/$R_CD_2_LIFECYCLE_RECEIPT" ]]; then
        SUMMARY_VERDICT="$(jq -r '.verdict // "PARTIAL-candidate"' "$RUN_DIR/$R_CD_2_LIFECYCLE_RECEIPT")"
        SUMMARY_VERDICT_SOURCE="r-cd-2-lifecycle-receipt"
        SUMMARY_FILE_VERDICT="$SUMMARY_VERDICT"
        VU_LOG_VERDICT=""
      else
        SUMMARY_VERDICT="PARTIAL-candidate"
        SUMMARY_VERDICT_SOURCE="r-cd-2-lifecycle-receipt-missing"
        POSTPROCESS_RC=1
      fi
      rm -f "$TEMPO_TRACE_PATH" "$CORRELATION_RECEIPT_PATH" "$COLLECTOR_RESULT" "$COLLECTOR_ERROR" \
        "$RUN_DIR/continuation-trace-collector.json" "$RUN_DIR/continuation-trace-collector.error.log"
      TRACE_ID=""
      TEMPO_TRACE_JSON=""
      CORRELATION_RECEIPT=""
      TRACE_STATUS="private-correlation-resolved"
    fi

    if ! node "$ARTIFACT_SANITIZER" \
      --input "$PRIVATE_EVIDENCE_FILE" \
      --out "$RUN_DIR/evidence.jsonl" \
      --lines-out "$RUN_DIR/evidence-lines.log" \
      --receipt-out "$RUN_DIR/evidence-redaction.json" \
      --log-input "$PRIVATE_K6_LOG" \
      --log-out "$RUN_DIR/k6.log" \
      --service-log-input "$PRIVATE_GATEWAY_LOG" \
      --service-log-out "$RUN_DIR/gateway-journal.log" \
      --service-log-receipt-out "$RUN_DIR/gateway-journal-redaction.json" \
      > "$RUN_DIR/evidence-redaction.stdout.json" 2> "$RUN_DIR/evidence-redaction.error.log"; then
      echo "[$ROW_ID] PUBLIC ARTIFACT REDACTION FAILED; see $RUN_DIR/evidence-redaction.error.log" >&2
      REVIEW_PENDING_RECEIPTS="$(jq -cn --argjson current "$REVIEW_PENDING_RECEIPTS" '$current + ["public-safe-evidence"] | unique')"
      POSTPROCESS_RC=1
      if [[ ! -f "$RUN_DIR/k6.log" ]]; then
        printf '%s\n' 'Public k6 log unavailable: redaction failed; private log withheld.' > "$RUN_DIR/k6.log"
      fi
      if [[ ! -f "$RUN_DIR/gateway-journal.log" ]]; then
        printf '%s\n' 'Public gateway journal unavailable: redaction failed; private log withheld.' > "$RUN_DIR/gateway-journal.log"
      fi
      [[ -f "$RUN_DIR/evidence.jsonl" ]] || : > "$RUN_DIR/evidence.jsonl"
      [[ -f "$RUN_DIR/evidence-lines.log" ]] || : > "$RUN_DIR/evidence-lines.log"
    else
      rm -f "$RUN_DIR/evidence-redaction.error.log"
    fi
    if [[ "$ROW_ID" == "R-CD-2" ]]; then
      # The lifecycle receipt is the R-CD-2 public evidence projection.  Keep
      # generic WS/journal acquisition material private even after sanitizing:
      # a provider/RPC error may contain details outside a stable allowlist.
      R_CD_2_PUBLIC_EVIDENCE="$(jq -cn \
        --arg receipt "$R_CD_2_LIFECYCLE_RECEIPT" \
        --arg verdict "$SUMMARY_VERDICT" \
        '{row:"R-CD-2", verdict:$verdict, lifecycleReceipt:$receipt, acquisition:"private"}')"
      printf '%s\n' "$R_CD_2_PUBLIC_EVIDENCE" > "$RUN_DIR/evidence.jsonl"
      : > "$RUN_DIR/evidence-lines.log"
      printf '%s\n' 'R-CD-2 private k6 acquisition withheld; see public lifecycle receipt.' > "$RUN_DIR/k6.log"
      printf '%s\n' 'R-CD-2 private gateway acquisition withheld; see public lifecycle receipt.' > "$RUN_DIR/gateway-journal.log"
    fi
    cat "$RUN_DIR/k6.log"
    rm -f "$PRIVATE_K6_LOG" "$PRIVATE_EVIDENCE_FILE" "$PRIVATE_GATEWAY_LOG"
    PRIVATE_K6_LOG=""
    PRIVATE_EVIDENCE_FILE=""
    PRIVATE_GATEWAY_LOG=""

    if [[ "$GATEWAY_JOURNAL_RC" -ne 0 && "${OPENCLAW_PROOFS_SERVICE_LOG_REQUIRED:-true}" == "true" ]]; then
      POSTPROCESS_RC=1
    fi

    EVIDENCE_JSON="null"
    if [[ -s "$RUN_DIR/evidence.jsonl" ]]; then
      EVIDENCE_JSON="$(head -n 1 "$RUN_DIR/evidence.jsonl")"
      if [[ -z "$EVIDENCE_JSON" ]]; then EVIDENCE_JSON="null"; fi
    fi
    EFFECTIVE_RC="$k6_rc"
    if [[ "$EFFECTIVE_RC" -eq 0 && "$POSTPROCESS_RC" -ne 0 ]]; then
      EFFECTIVE_RC="$POSTPROCESS_RC"
    fi
    jq -n \
      --argjson rc "$k6_rc" \
      --argjson postprocessRc "$POSTPROCESS_RC" \
      --argjson effectiveRc "$EFFECTIVE_RC" \
      --arg ended "$RUN_ENDED_AT" \
      --arg traceStatus "$TRACE_STATUS" \
      --arg traceId "$TRACE_ID" \
      --arg tempoTraceJson "$TEMPO_TRACE_JSON" \
      --arg correlationReceipt "$CORRELATION_RECEIPT" \
      --arg lifecycleReceipt "$R_CD_2_LIFECYCLE_RECEIPT" \
      --arg serviceLogStatus "$GATEWAY_JOURNAL_STATUS" \
      --arg verdict "$SUMMARY_VERDICT" \
      --arg verdictSource "$SUMMARY_VERDICT_SOURCE" \
      --arg summaryFileVerdict "$SUMMARY_FILE_VERDICT" \
      --arg vuLogVerdict "$VU_LOG_VERDICT" \
      --argjson summaryFiles "$SUMMARY_FILES_JSON" \
      --argjson evidence "$EVIDENCE_JSON" \
      --argjson reviewPendingReceipts "$REVIEW_PENDING_RECEIPTS" \
      '{k6ExitCode:$rc, postprocessExitCode:$postprocessRc, effectiveExitCode:$effectiveRc, endedAt:$ended, verdict:(if $verdict == "unknown" then null else $verdict end), verdictSource:$verdictSource, summaryFileVerdict:(if $summaryFileVerdict == "unknown" then null else $summaryFileVerdict end), vuLogVerdict:(if $vuLogVerdict == "" then null else $vuLogVerdict end), summaryFiles:$summaryFiles, evidence:$evidence, candidateOnly:true, foldRequiresReview:true, observability:{traceStatus:$traceStatus, lifecycleReceipt:(if $lifecycleReceipt == "" then null else $lifecycleReceipt end), serviceLogStatus:$serviceLogStatus, serviceLog:"gateway-journal.log", serviceLogCapture:"gateway-journal-capture.json", serviceLogRedaction:"gateway-journal-redaction.json"}, review:{status:(if ($reviewPendingReceipts|length)>0 then "review-pending" else "ready-for-human-review" end), pendingReceipts:$reviewPendingReceipts}}' \
      > "$RUN_DIR/run-result.json"
    METRICS_ARGS=(--run-dir "$RUN_DIR" --prometheus-out "$RUN_DIR/openclaw-proofs-k6.prom" --otlp-out "$RUN_DIR/openclaw-proofs-k6.otlp.json")
    if [[ -n "${OPENCLAW_PROOFS_K6_OTLP_ENDPOINT:-}" ]]; then
      METRICS_ARGS+=(--push-otlp "$OPENCLAW_PROOFS_K6_OTLP_ENDPOINT")
    fi
    if node scripts/export-row-metrics.mjs "${METRICS_ARGS[@]}" > "$RUN_DIR/metrics-export.json"; then
      echo "[$ROW_ID] METRICS: $RUN_DIR/openclaw-proofs-k6.prom"
    else
      echo "[$ROW_ID] METRICS EXPORT FAILED; see $RUN_DIR/metrics-export.json" >&2
      if [[ "${OPENCLAW_PROOFS_K6_METRICS_REQUIRED:-false}" == "true" ]]; then
        exit 1
      fi
    fi
    rm -f "$RUN_DIR/.started"

    echo "[$ROW_ID] ARTIFACTS: $RUN_DIR"
    if [[ "$EFFECTIVE_RC" -ne 0 ]]; then
      echo "[$ROW_ID] FAILED with effective exit code $EFFECTIVE_RC. Public-safe artifacts preserved."
      exit "$EFFECTIVE_RC"
    fi

    echo "[$ROW_ID] COMPLETED."

    # Observability hints
    echo "Observability check: query Grafana for run/nonce or review Tempo traces if trace ID was emitted."
  fi
done

REPORT_PATH="$OUT_ROOT/report.html"
if node scripts/render-run-report.mjs --root "$OUT_ROOT" --out "$REPORT_PATH" > "$OUT_ROOT/report-receipt.json" 2> "$OUT_ROOT/report-error.log"; then
  echo "REPORT: $REPORT_PATH"
else
  echo "REPORT GENERATION FAILED; see $OUT_ROOT/report-error.log" >&2
  if [[ "${OPENCLAW_PROOFS_K6_REPORT_REQUIRED:-false}" == "true" ]]; then
    exit 1
  fi
fi

echo ""
echo "=========================================================="
echo "Runner execution finished."
