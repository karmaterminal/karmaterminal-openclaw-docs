#!/usr/bin/env bash
#
# Seat-aware row-list runner for Project 81 / k6-proofs
# References: #178 / #106 / #119 / #179
#
# Usage:
#   cd tools/k6-proofs
#   ./scripts/run-proofs.sh [--dry-run] [--out-dir /tmp/k6-proof-runs] [R-CD-2,R-CD-4] [candidate_sha]

set -euo pipefail

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
      elif [[ -z "$CANDIDATE_SHA" && -z "${OPENCLAW_CANDIDATE_SHA:-}" ]]; then
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

# Fetch deployed runtime build stamp explicitly (do not collapse into CANDIDATE_SHA)
DEPLOYED_BUILD_STAMP="unknown"
if [[ -f ~/.openclaw/openclaw.json ]]; then
  if openclaw version --json >/dev/null 2>&1; then
    DEPLOYED_BUILD_STAMP="$(openclaw version --json | jq -r '.build.sha // empty')"
  fi
fi
export OPENCLAW_RUNTIME_BUILD_SHA="$DEPLOYED_BUILD_STAMP"

# Resolve Session Key
if [[ -z "${OPENCLAW_SESSION_KEY:-}" ]]; then
  echo "Resolving session key for selector: $SESSION_SELECTOR"
  export OPENCLAW_SESSION_KEY="main" # Fallback/stub. In a full implementation this shells out to `openclaw sessions --json`
fi

echo "=========================================================="
echo "Project 81: Seat-Aware k6 Proof Runner"
echo "Seat: $OPENCLAW_SEAT_NAME"
echo "Target Candidate SHA: $OPENCLAW_CANDIDATE_SHA"
echo "Deployed Runtime SHA: $OPENCLAW_RUNTIME_BUILD_SHA"
echo "Session: $OPENCLAW_SESSION_KEY"
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
if [[ "$DRY_RUN" == "false" && "$OPENCLAW_CANDIDATE_SHA" != "$OPENCLAW_RUNTIME_BUILD_SHA" ]]; then
  echo "WARNING: Candidate SHA ($OPENCLAW_CANDIDATE_SHA) does not match Deployed Runtime SHA ($OPENCLAW_RUNTIME_BUILD_SHA)."
  echo "Unless this is a known stale-stamp or you have proven a rebuild bridge, live proofs will be marked HONEST-LIMIT / negative-partial."
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
    jq -n \
      --arg row "$ROW_ID" \
      --arg scenario "$SCENARIO_FILE" \
      --arg candidate "$OPENCLAW_CANDIDATE_SHA" \
      --arg runtime "$OPENCLAW_RUNTIME_BUILD_SHA" \
      --arg seat "$OPENCLAW_SEAT_NAME" \
      --arg session "$OPENCLAW_SESSION_KEY" \
      --arg started "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{row:$row, scenario:$scenario, candidateSha:$candidate, runtimeBuildSha:$runtime, seat:$seat, sessionKey:$session, startedAt:$started}' \
      > "$RUN_DIR/runner-metadata.json"

    set +e
    k6 run "scenarios/$SCENARIO_FILE" 2>&1 | tee "$RUN_DIR/k6.log"
    k6_rc=${PIPESTATUS[0]}
    set -e

    find . -maxdepth 1 -type f -name '*summary.json' -newer "$RUN_DIR/.started" -print -exec mv {} "$RUN_DIR" \;
    grep -E '(_EVIDENCE|=== K6-PROOF-EVIDENCE ===)' "$RUN_DIR/k6.log" > "$RUN_DIR/evidence-lines.log" || true
    python3 - "$RUN_DIR/evidence-lines.log" "$RUN_DIR/evidence.jsonl" <<'PY_EVIDENCE_JSONL'
import json
import re
import sys
from pathlib import Path

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
out = []
if src.exists():
    for line in src.read_text().splitlines():
        match = re.search(r'msg="(?:[A-Z0-9_]+_EVIDENCE )?(\{.*\})"(?: source=|$)', line)
        if not match:
            continue
        raw = match.group(1).replace(r'\"', '"')
        try:
            out.append(json.loads(raw))
        except json.JSONDecodeError:
            pass
dst.write_text(''.join(json.dumps(obj, sort_keys=True) + '\n' for obj in out))
PY_EVIDENCE_JSONL
    jq -n --argjson rc "$k6_rc" --arg ended "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{k6ExitCode:$rc, endedAt:$ended}' > "$RUN_DIR/run-result.json"
    rm -f "$RUN_DIR/.started"

    echo "[$ROW_ID] ARTIFACTS: $RUN_DIR"
    if [[ "$k6_rc" -ne 0 ]]; then
      echo "[$ROW_ID] FAILED with k6 exit code $k6_rc. Artifacts preserved."
      exit "$k6_rc"
    fi

    echo "[$ROW_ID] COMPLETED."

    # Observability hints
    echo "Observability check: query Grafana for run/nonce or review Tempo traces if trace ID was emitted."
  fi
done

echo ""
echo "=========================================================="
echo "Runner execution finished."
