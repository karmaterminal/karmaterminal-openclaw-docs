#!/usr/bin/env bash
set -uo pipefail
B=$HOME/ci-fenced-08fead65/baseline-gsi; export PATH="$B/bin:$HOME/ci-fenced-08fead65/node24/bin:$PATH" NO_COLOR=1 FORCE_COLOR=0 CI=1
run() { local tag=$1 cfg=$2 file=$3
  for r in b51feb98eb 08fead65d2; do cd $B/wt-$r || exit 1
    timeout 1500 node scripts/run-vitest.mjs run --config $cfg --maxWorkers=1 $file > $B/$tag-$r.log 2>&1
    echo "$tag $r rc=$? $(grep -aE '^ *(Test Files|Tests) ' $B/$tag-$r.log | tr -s ' ' | tr '\n' ' ')" | tee -a $B/summary-rest.txt; done; }
run plugins test/vitest/vitest.plugins.config.ts src/plugins/plugin-module-loader-cache.test.ts
run cli-process test/vitest/vitest.cli-process.config.ts src/cli/update-cli/update-command-resume-completion.test.ts
run ct10 test/vitest/vitest.tooling.config.ts test/scripts/mobile-release.test.ts
echo "done $(date -u +%T)" >> $B/summary-rest.txt
