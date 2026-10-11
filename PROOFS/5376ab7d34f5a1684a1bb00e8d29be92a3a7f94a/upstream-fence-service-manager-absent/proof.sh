#!/usr/bin/env bash
# Runs inside a node:24.17.0-bookworm container as uid 1000 (no service manager).
# Inputs in /in, receipts in /out. Product bytes are git-archived from the exact head.
set -uo pipefail
OUT=/out
exec > >(tee -a "$OUT/proof.log") 2>&1
read HEADSHA MAINSHA < /in/shas
echo "== environment $(date -u +%FT%TZ)"
echo "head=$HEADSHA upstream_main=$MAINSHA variant=${VARIANT:-plain}"
echo "uid=$(id -u) pid1=$(cat /proc/1/comm) node=$(node -v) arch=$(uname -m)"
echo "systemctl=$(command -v systemctl || echo absent)"
systemctl --user is-system-running 2>&1 | head -2 || true
echo "XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-unset} DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-unset}"

mkdir -p /w && tar -xf /in/head.tar -C /w && cd /w
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1 NO_COLOR=1
mkdir -p "$HOME/bin" && corepack enable --install-directory "$HOME/bin" pnpm && export PATH="$HOME/bin:$PATH"
echo "pnpm=$(pnpm -v)"
pnpm install --frozen-lockfile --reporter=silent || { echo "INSTALL FAILED"; exit 2; }

use() { # use <main|head> <main|head>: fence source, fence test
  cp "/in/$1-fence.mts" scripts/lib/live-gateway-dist-fence.mts
  cp "/in/$2-fence.test.ts" test/scripts/live-gateway-dist-fence.test.ts
  echo "-- fence src=$1 test=$2 src_sha256=$(sha256sum scripts/lib/live-gateway-dist-fence.mts | cut -c1-16)"
}
vt() {
  node scripts/run-vitest.mjs run --maxWorkers=1 "$1" 2>&1 | tail -25
  echo "exit=${PIPESTATUS[0]}"
}
probe() { # real fence call against this container, no mocks
  cat > /tmp/probe.mts <<'EOF'
import { resolveLiveManagedGatewayDistFence } from "/w/scripts/lib/live-gateway-dist-fence.mts";
import { listTsdownOutputRoots } from "/w/scripts/tsdown-build.mts";
const r = await resolveLiveManagedGatewayDistFence("/w", { env: process.env, requireVerified: true, outputPaths: listTsdownOutputRoots() });
console.log("FENCE_RESULT " + JSON.stringify(r));
EOF
  node --import tsx /tmp/probe.mts 2>&1 | tail -5
}

echo; echo "== 1. unit: upstream main fence + main tests (control)"
use main main; vt test/scripts/live-gateway-dist-fence.test.ts; vt test/scripts/live-gateway-dist-fence.absence.test.ts
echo; echo "== 2. unit: head fence + head tests (GREEN expected)"
use head head; vt test/scripts/live-gateway-dist-fence.test.ts; vt test/scripts/live-gateway-dist-fence.absence.test.ts
echo; echo "== 3. unit: fix reverted (main fence) + head tests (RED expected)"
use main head; vt test/scripts/live-gateway-dist-fence.test.ts
echo; echo "== 4. unit: fix reapplied (GREEN expected)"
use head head; vt test/scripts/live-gateway-dist-fence.test.ts

echo; echo "== 5. real fence in this container: upstream main"
use main head; probe
echo; echo "== 6. real fence in this container: head"
use head head; probe

if [ "${FULL_PREP:-0}" = 1 ]; then
  echo; echo "== 7. real test preparation at upstream main (refusal expected)"
  use main head; rm -rf dist
  node --import tsx scripts/prepare-vitest-runtime.mts; echo "exit=$?"; ls dist 2>/dev/null | head -3 || echo "no dist"
  echo; echo "== 8. real test preparation at head (build expected)"
  use head head; rm -rf dist
  node --import tsx scripts/prepare-vitest-runtime.mts 2>&1 | tail -15; echo "exit=${PIPESTATUS[0]}"
  echo "dist entries: $(ls dist 2>/dev/null | wc -l)"
  echo; echo "== 9. a Vitest file after real preparation at head"
  vt test/scripts/live-gateway-dist-fence.test.ts
fi
echo "== done $(date -u +%FT%TZ)"
