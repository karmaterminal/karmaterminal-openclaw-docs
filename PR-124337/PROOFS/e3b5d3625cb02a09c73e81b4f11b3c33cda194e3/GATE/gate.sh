#!/bin/bash
# Gate for openclaw#124337 back-merge (PR 9fd80c6cdbd + upstream main 12b56e6492c + slack test port + line-cap fold).
W=~/i_have_a_pet_human/source/WORKTREES/bm-124337-r21
BASE=12b56e6492c0cdd155294012cc4fec7639525e43
cd "$W" || exit 9
export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH OPENCLAW_VITEST_RUNTIME=node
L=~/i_have_a_pet_human/bm124-gate/gate-r3; mkdir -p $L
N="nice -n 19 taskset -c 16-31"
echo "start $(date -u +%TZ) HEAD=$(git rev-parse HEAD) status=$(git status --porcelain | wc -l)" > $L/meta.txt
$N pnpm install --frozen-lockfile --prefer-offline > $L/install.log 2>&1; echo "install rc=$? dirty=$(git status --porcelain | wc -l)" >> $L/meta.txt
F=$(git diff --name-only $BASE HEAD -- '*.ts')
echo "changed .ts vs upstream main: $(echo $F | wc -w)" >> $L/meta.txt
# Tests: changed test files, plus tests in the same dir importing a changed source module.
{
  git diff --name-only $BASE HEAD -- '*.test.ts'
  for f in $(git diff --name-only $BASE HEAD -- '*.ts' | grep -v '\.test\.ts$' | grep -v 'test-support'); do
    m=${f%.ts}; m=${m##*/}
    git grep -l -E "from ['\"][^'\"]*/${m}(\.js)?['\"]" -- "$(dirname "$f")/*.test.ts" 2>/dev/null
  done
  # conflict-touched files
  echo extensions/feishu/src/monitor.comment.test.ts
  echo extensions/sms/src/inbound.test.ts
} | grep -vE '\.live\.test\.ts$' | sort -u > $L/tests-all.txt
grep -E '\.e2e\.test\.ts$' $L/tests-all.txt > $L/tests-e2e.txt
grep -vE '\.e2e\.test\.ts$' $L/tests-all.txt > $L/tests-unit.txt
echo "tests unit=$(wc -l < $L/tests-unit.txt) e2e=$(wc -l < $L/tests-e2e.txt)" >> $L/meta.txt
for s in tsgo:core tsgo:extensions tsgo:core:test tsgo:extensions:test; do $N pnpm $s > "$L/$s.log" 2>&1; echo "$s rc=$?" >> $L/meta.txt; done
$N node scripts/run-vitest.mjs run $(cat $L/tests-unit.txt) > $L/vitest.log 2>&1; echo "vitest rc=$?" >> $L/meta.txt
if [ -s $L/tests-e2e.txt ]; then
  $N node scripts/run-vitest.mjs run $(cat $L/tests-e2e.txt) > $L/vitest-e2e.log 2>&1; echo "vitest-e2e rc=$?" >> $L/meta.txt
fi
$N pnpm exec oxlint $F > $L/oxlint.log 2>&1; echo "oxlint rc=$?" >> $L/meta.txt
$N pnpm exec oxfmt --check $F > $L/oxfmt.log 2>&1; echo "oxfmt rc=$?" >> $L/meta.txt
$N node scripts/check-line-cap-ratchet.mjs --base $BASE > $L/linecap.log 2>&1; echo "linecap rc=$?" >> $L/meta.txt
$N pnpm run check > $L/check.log 2>&1; echo "pnpm-check rc=$?" >> $L/meta.txt
echo "end $(date -u +%TZ) HEAD=$(git rev-parse HEAD) status=$(git status --porcelain | wc -l)" >> $L/meta.txt
