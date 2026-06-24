#!/usr/bin/env bash
# k6 PROOFS runner — fires a proof scenario with full stack integration
# Usage: ./run-proof.sh <scenario> [extra k6 args]
# Example: ./run-proof.sh preflight
#          ./run-proof.sh r-cd-1 --env GATEWAY_HOST=10.0.0.246
#
# Outputs:
#   - Metrics → Prometheus (prometheus.dandelion.cult) → Grafana
#   - Logs → stdout + Loki (via journal)
#   - Summary → ./<scenario>-summary.json + report.html (if handleSummary defined)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="${SCRIPT_DIR}/scenarios"

SCENARIO="${1:?Usage: ./run-proof.sh <scenario-name> [k6 args]}"
shift || true

# Resolve scenario file
SCENARIO_FILE="${SCENARIOS_DIR}/${SCENARIO}.js"
if [[ ! -f "$SCENARIO_FILE" ]]; then
  echo "ERROR: Scenario file not found: ${SCENARIO_FILE}"
  echo "Available scenarios:"
  ls "${SCENARIOS_DIR}"/*.js 2>/dev/null | xargs -I{} basename {} .js
  exit 1
fi

# Auto-detect seat and SHA
SEAT="${PROOF_SEAT:-$(hostname)}"
SHA="${PROOF_SHA:-$(openclaw --version 2>/dev/null | awk '{print $3}' | tr -d '()' || echo 'unknown')}"

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
  --env "K6_PROMETHEUS_RW_SERVER_URL=${PROM_URL}" \
  "$@"
