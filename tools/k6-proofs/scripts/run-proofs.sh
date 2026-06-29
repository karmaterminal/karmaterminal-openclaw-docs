#!/usr/bin/env bash
#
# Seat-aware row-list runner for Project 81 / k6-proofs
# References: #178 / #106 / #119
#
# Usage:
#   cd tools/k6-proofs
#   ./scripts/run-proofs.sh [--dry-run] [R-CD-2,R-CD-4] [candidate_sha]

set -euo pipefail

DRY_RUN=true
ROWS=""
CANDIDATE_SHA=""
SESSION_SELECTOR="discord-channel:1466192485440164011"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --live) DRY_RUN=false; shift ;;
    --session) SESSION_SELECTOR="$2"; shift 2 ;;
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

if [[ -z "$CANDIDATE_SHA" ]]; then
  CANDIDATE_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
fi

export OPENCLAW_CANDIDATE_SHA="${CANDIDATE_SHA}"
export OPENCLAW_SEAT_NAME="$(hostname)"

# Local Gateway Auth extraction (never logged/committed)
if [[ -f ~/.openclaw/openclaw.json ]]; then
  export OPENCLAW_GATEWAY_TOKEN="$(jq -r '.auth.operatorToken // empty' ~/.openclaw/openclaw.json)"
fi
if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  echo "Warning: OPENCLAW_GATEWAY_TOKEN not found in local config."
  if [[ "$DRY_RUN" == "false" ]]; then
    exit 1
  fi
fi

# Resolve Session Key
if [[ -z "${OPENCLAW_SESSION_KEY:-}" ]]; then
  echo "Resolving session key for selector: $SESSION_SELECTOR"
  export OPENCLAW_SESSION_KEY="main" # Fallback/stub. In a full implementation this shells out to `openclaw sessions --json`
fi

echo "=========================================================="
echo "Project 81: Seat-Aware k6 Proof Runner"
echo "Seat: $OPENCLAW_SEAT_NAME"
echo "Target SHA: $OPENCLAW_CANDIDATE_SHA"
echo "Session: $OPENCLAW_SESSION_KEY"
echo "Rows: $ROWS"
echo "Dry Run: $DRY_RUN"
echo "=========================================================="

IFS=',' read -ra ROW_ARRAY <<< "$ROWS"

for ROW_ID in "${ROW_ARRAY[@]}"; do
  # Normalize row ID
  ROW_ID="$(echo "$ROW_ID" | tr '[:lower:]' '[:upper:]')"
  
  # Find manifest
  MANIFEST_FILE=""
  for f in manifests/*.json; do
    if grep -q "\"rowId\": \"$ROW_ID\"" "$f"; then
      MANIFEST_FILE="$(pwd)/$f" # Absolute path
      break
    fi
  done

  if [[ -z "$MANIFEST_FILE" ]]; then
    echo "[$ROW_ID] SKIPPED: Manifest not found."
    continue
  fi

  SCENARIO_FILE=$(jq -r '.scenario.file' "$MANIFEST_FILE")
  SCENARIO_STATUS=$(jq -r '.scenario.status' "$MANIFEST_FILE")
  LIVE_SAFETY=$(jq -r '.liveRunSafety.classification // "unknown"' "$MANIFEST_FILE")

  echo ""
  echo "----------------------------------------"
  echo "Row: $ROW_ID"
  echo "Manifest: $MANIFEST_FILE"
  echo "Scenario: scenarios/$SCENARIO_FILE"
  echo "Status: $SCENARIO_STATUS"
  echo "Live Safety: $LIVE_SAFETY"

  if [[ "$SCENARIO_STATUS" != "runnable" ]]; then
    echo "[$ROW_ID] SKIPPED: Scenario status is $SCENARIO_STATUS (not runnable)."
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
    
    # Actually run k6
    k6 run "scenarios/$SCENARIO_FILE"
    
    echo "[$ROW_ID] COMPLETED."
    
    # Observability hints
    echo "Observability check: query Grafana for run/nonce or review Tempo traces if trace ID was emitted."
  fi
done

echo ""
echo "=========================================================="
echo "Runner execution finished."