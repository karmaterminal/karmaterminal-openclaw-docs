#!/usr/bin/env bash
set -uo pipefail
B=$HOME/ci-fenced-08fead65/baseline-gsi; export PATH="$B/bin:$HOME/ci-fenced-08fead65/node24/bin:$PATH" NO_COLOR=1 FORCE_COLOR=0 CI=1
FILES="extensions/onepassword/src/op-client.test.ts extensions/onepassword/src/secret-ref-resolver.test.ts extensions/vault/src/cli.test.ts extensions/onepassword/src/secret-ref-cli.test.ts extensions/onepassword/src/op-path.test.ts"
for r in b51feb98eb 08fead65d2; do cd $B/wt-$r || exit 1
  echo "== $r node $(node -v) head $(git rev-parse --short HEAD) $(date -u +%T)" | tee -a $B/summary-ext.txt
  timeout 2400 node scripts/run-vitest.mjs run --config test/vitest/vitest.extensions.config.ts --maxWorkers=1 $FILES > $B/extensions-$r.log 2>&1; echo "rc=$? $(grep -aE '^ *(Test Files|Tests) ' $B/extensions-$r.log | tr -s ' ' | tr '\n' ' ')" | tee -a $B/summary-ext.txt
done; echo "done $(date -u +%T)" >> $B/summary-ext.txt
