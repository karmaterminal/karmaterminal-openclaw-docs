#!/usr/bin/env bash
# Runs every scenario on every tree: phase A then phase B, each in its own
# process, niced and pinned off the production gateway's cores. Localhost only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
H="$ROOT/harness/recovery-proof.mts"
RUNS="$ROOT/runs"
LOGS="$ROOT/logs"
mkdir -p "$RUNS" "$LOGS"

run() { # side tree scenario
  local side="$1" tree="$ROOT/$2" scenario="$3"
  local run="$RUNS/$side-$scenario" out="$LOGS/$side-$scenario.log"
  rm -rf "$run"
  mkdir -p "$run"
  {
    echo "### $side / $scenario / tree $(git -C "$tree" rev-parse HEAD)"
    for phase in A B; do
      echo "### phase $phase"
      local code=0
      (cd "$tree" && nice -n 10 taskset -c 16-31 timeout 300 \
        node --import "$tree/scripts/tsx.mjs" "$H" --tree "$tree" --run "$run" \
        --phase "$phase" --scenario "$scenario") || code=$?
      echo "### phase $phase exit=$code"
    done
  } >"$out" 2>&1
  sed -i -e "s#$HOME#<home>#g" -e "s#$(hostname)#<host>#g" "$out"
  grep '\[verdict\]' "$out" | sed "s#^#$side/$scenario #"  || true
}

run head head recovery
run control control recovery
for scenario in edit-decide edit-commit; do
  run head head "$scenario"
  run control control "$scenario"
  run prefix-fbef prefix-fbef "$scenario"
  run prefix-08d7 prefix-08d7 "$scenario"
done
for side in head prefix-cdef control; do
  run "$side" "$side" rename-commit
done
