#!/usr/bin/env bash
# Re-runs the PR #121204 proof harness at the safe-branch candidate and at upstream main (control).
# Fails (exit 1) unless every install and every phase exits 0.
set -u
S0=${SCRATCH:?set SCRATCH to the scratch dir holding openclaw/, gate25-F/ and proof-121204/}; W=$S0/gate25-F
H1=$S0/proof-121204/harness/recovery-proof.mts
HEAD_SHA=3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6; CONTROL_SHA=b3c7dc2af7ddb61a71afd169788d846dc37ae2a0
bad=0
checkout() { cd $S0/openclaw && git fetch -q origin $1 || git fetch -q https://github.com/openclaw/openclaw.git $1; cd $W && git checkout -q --detach -f $1 && git clean -qfd -e node_modules -e .artifacts && echo "tree $(git rev-parse HEAD) dirty=$(git status --short | wc -l)" && nice -n 15 pnpm install --frozen-lockfile > /dev/null 2>&1; rc=$?; echo "install rc=$rc"; [ $rc -eq 0 ] || bad=1; }
san() { sed -i -e "s#$HOME#<home>#g" -e "s#$(hostname)#<host>#g" -e 's/\x1b\[[0-9;]*m//g' "$1"; }
p121() { side=$1; out=$S0/proof-121204g/logs; mkdir -p $out; for sc in recovery edit-decide edit-commit rename-commit; do run=$S0/proof-121204g/runs/$side-$sc; rm -rf $run; mkdir -p $run; f=$out/$side-$sc.log
  { echo "### $side / $sc / tree $(git -C $W rev-parse HEAD)"; for ph in A B; do echo "### phase $ph"; c=0; (cd $W && nice -n 15 timeout 300 node --import $W/scripts/tsx.mjs $H1 --tree $W --run $run --phase $ph --scenario $sc) || c=$?; echo "### phase $ph exit=$c"; done; } > $f 2>&1; san $f
  [ "$(grep -c '^### phase [AB] exit=0$' $f)" = 2 ] || { echo "nonzero phase exit in $f"; bad=1; }; grep '\[verdict\]' $f | sed "s#^#121204 $side/$sc #"; done; }
checkout $HEAD_SHA; p121 head
checkout $CONTROL_SHA; p121 control
[ $bad -eq 0 ] && echo proofs-done || { echo proofs-FAILED; exit 1; }
