#!/usr/bin/env bash
# Re-runs the PR #124337 boundary harness at the safe-branch candidate and at its upstream base (control).
# Fails (exit 1) unless every install and every phase exits 0.
set -u
S0=${SCRATCH:?set SCRATCH to the scratch dir holding openclaw/, gate25-F/ and proof-124337/}; W=$S0/gate25-F
H2=$S0/proof-124337/harness/boundary-proof.mts
HEAD_SHA=ee2f6dfdf651a8bd4416edb435335c5393190c5e; CONTROL_SHA=042db1e7064930a08c534c4487864d7bfb8c5287
bad=0
checkout() { cd $S0/openclaw && git fetch -q origin $1 || git fetch -q https://github.com/openclaw/openclaw.git $1; cd $W && git checkout -q --detach -f $1 && git clean -qfd -e node_modules -e .artifacts && echo "tree $(git rev-parse HEAD) dirty=$(git status --short | wc -l)" && nice -n 15 pnpm install --frozen-lockfile > /dev/null 2>&1; rc=$?; echo "install rc=$rc"; [ $rc -eq 0 ] || bad=1; }
san() { sed -i -e "s#$HOME#<home>#g" -e "s#$(hostname)#<host>#g" -e 's/\x1b\[[0-9;]*m//g' "$1"; }
p124() { side=$1; out=$S0/proof-124337d/logs; mkdir -p $out; for ph in A1 A2 B; do st=$S0/proof-124337d/rerun/$side-${ph%[12]}/state; [ $ph = A1 ] || [ $ph = B ] && rm -rf $(dirname $st); mkdir -p $st; f=$out/$side-$ph.log
  { echo "### $side / $ph / tree $(git -C $W rev-parse HEAD)"; c=0; (cd $W && nice -n 15 timeout 600 node --import $W/scripts/tsx.mjs $H2 --tree $W --state $st --phase $ph) || c=$?; echo "### exit=$c"; } > $f 2>&1; san $f
  [ "$(grep -c '^### exit=0$' $f)" = 1 ] || { echo "nonzero exit in $f"; bad=1; }; grep '\[verdict\]' $f | sed "s#^#124337 $side/$ph #"; done; }
checkout $HEAD_SHA; p124 head
checkout $CONTROL_SHA; p124 control
[ $bad -eq 0 ] && echo proofs-done || { echo proofs-FAILED; exit 1; }
