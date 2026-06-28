#!/usr/bin/env bash
# k6 PROOFS runner — fires a proof scenario with full stack integration
# Usage: ./run-proof.sh <scenario-basename> [extra k6 args]
#
# <scenario-basename> is the filename under tools/k6-proofs/scenarios/
# without a path or .js suffix. This matches the GitHub Actions
# workflow_dispatch scenario choices in .github/workflows/k6-proof.yml.
#
# Examples:
#   ./run-proof.sh preflight
#   ./run-proof.sh r-cd-2-silent-wake --env GATEWAY_HOST=10.0.0.246
#
# Outputs:
#   - Metrics → Prometheus (prometheus.dandelion.cult) → Grafana
#   - Logs → stdout + Loki (via journal)
#   - Summary → ./<scenario>-summary.json + report.html (if handleSummary defined)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="${SCRIPT_DIR}/scenarios"

SCENARIO="${1:?Usage: ./run-proof.sh <scenario-basename> [k6 args]}"
shift || true

if [[ "$SCENARIO" == */* || "$SCENARIO" == *.js ]]; then
  echo "ERROR: Scenario must be a basename without path or .js suffix: ${SCENARIO}"
  exit 1
fi

# Resolve scenario file
SCENARIO_FILE="${SCENARIOS_DIR}/${SCENARIO}.js"
if [[ ! -f "$SCENARIO_FILE" ]]; then
  echo "ERROR: Scenario file not found: ${SCENARIO_FILE}"
  echo "Available scenarios:"
  ls "${SCENARIOS_DIR}"/*.js 2>/dev/null | xargs -I{} basename {} .js
  exit 1
fi

# Auto-detect seat and SHA. Prefer OPENCLAW_* names used by manifests/workflow,
# but keep legacy PROOF_* as compatibility aliases.
SEAT="${OPENCLAW_SEAT_NAME:-${PROOF_SEAT:-$(hostname)}}"
SHA="${OPENCLAW_CANDIDATE_SHA:-${PROOF_SHA:-$(openclaw --version 2>/dev/null | awk '{print $3}' | tr -d '()' || echo 'unknown')}}"

# Prometheus Remote Write target
PROM_URL="${K6_PROMETHEUS_RW_SERVER_URL:-http://prometheus.dandelion.cult/api/v1/write}"

echo "═══════════════════════════════════════════════════════"
echo " k6 PROOFS: ${SCENARIO}"
echo " Seat: ${SEAT} | SHA: ${SHA}"
echo " Prometheus: ${PROM_URL}"
echo "═══════════════════════════════════════════════════════"

exec k6 run "${SCENARIO_FILE}" \
  --out "experimental-prometheus-rw" \
  --env "PROOF_SHA=${SHA}" \
  --env "PROOF_SEAT=${SEAT}" \
  --env "OPENCLAW_CANDIDATE_SHA=${SHA}" \
  --env "OPENCLAW_SEAT_NAME=${SEAT}" \
  --env "K6_PROMETHEUS_RW_SERVER_URL=${PROM_URL}" \
  "$@"
