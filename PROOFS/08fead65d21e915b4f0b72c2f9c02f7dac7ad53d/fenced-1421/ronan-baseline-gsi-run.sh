#!/usr/bin/env bash
# Baseline for elliott's executed red (gateway-server-isolated): the two failing files at upstream b51feb98eb vs cut 08fead65d2.
set -uo pipefail
B=$HOME/ci-fenced-08fead65/baseline-gsi; N=$HOME/ci-fenced-08fead65/node24/bin
export PATH="$N:$PATH" NO_COLOR=1 FORCE_COLOR=0 CI=1
SRC=$HOME/flesh_beast_best_beast/source/openclaw
for r in b51feb98ebb1bfa6735b62d136eca9abdbee4285 08fead65d21e915b4f0b72c2f9c02f7dac7ad53d; do
  W=$B/wt-${r:0:10}; [ -d $W ] || git -C $SRC worktree add -q --detach $W $r
  cd $W; echo "== ${r:0:10} node $(node -v) $(date -u +%T)" | tee -a $B/summary.txt
  corepack enable --install-directory $B/bin >/dev/null 2>&1; export PATH="$B/bin:$PATH"
  timeout 1200 pnpm install --frozen-lockfile > $B/install-${r:0:10}.log 2>&1; echo "install rc=$?" | tee -a $B/summary.txt
  for f in src/gateway/server.chat-cli-auth.test.ts src/gateway/server.cli-watchdog.test.ts; do
    timeout 1800 node scripts/run-vitest.mjs run --config test/vitest/vitest.gateway-server-isolated.config.ts --maxWorkers=1 $f > $B/$(basename $f .test.ts)-${r:0:10}.log 2>&1; rc=$?
    echo "$f rc=$rc $(grep -aE '^ *(Test Files|Tests) ' $B/$(basename $f .test.ts)-${r:0:10}.log | tr -s ' ' | tr '\n' ' ')" | tee -a $B/summary.txt
  done
done
echo "done $(date -u +%T)" >> $B/summary.txt
