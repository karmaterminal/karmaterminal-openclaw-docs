#!/usr/bin/env bash
# Re-runs the 121204 and 124337 proof harnesses at the back-merged heads and at upstream main (control).
set -u
S0=${SCRATCH:?set SCRATCH to the scratch dir holding openclaw/, gate25-F/ and proof-*/}; W=$S0/gate25-F
H1=$S0/proof-121204/harness/recovery-proof.mts; H2=$S0/proof-124337/harness/boundary-proof.mts
checkout() { cd $S0/openclaw && git fetch -q origin $1 || git fetch -q https://github.com/openclaw/openclaw.git $1; cd $W && git checkout -q --detach -f $1 && git clean -qfd -e node_modules -e .artifacts && echo "tree $(git rev-parse HEAD)" && nice -n 15 pnpm install --frozen-lockfile > /dev/null 2>&1; echo "install rc=$?"; }
san() { sed -i -e "s#$HOME#<home>#g" -e "s#$(hostname)#<host>#g" -e 's/\x1b\[[0-9;]*m//g' "$1"; }
p121() { side=$1; out=$S0/proof-121204/logs; mkdir -p $out; for sc in recovery edit-decide edit-commit rename-commit; do run=$S0/proof-121204/runs/$side-$sc; rm -rf $run; mkdir -p $run; f=$out/$side-$sc.log
  { echo "### $side / $sc / tree $(git -C $W rev-parse HEAD)"; for ph in A B; do echo "### phase $ph"; c=0; (cd $W && nice -n 15 timeout 300 node --import $W/scripts/tsx.mjs $H1 --tree $W --run $run --phase $ph --scenario $sc) || c=$?; echo "### phase $ph exit=$c"; done; } > $f 2>&1; san $f; grep '\[verdict\]' $f | sed "s#^#121204 $side/$sc #"; done; }
p124() { side=$1; out=$S0/proof-124337/logs; mkdir -p $out; for ph in A1 A2 B; do st=$S0/proof-124337/rerun/$side-${ph%[12]}/state; [ $ph = A1 ] || [ $ph = B ] && rm -rf $(dirname $st); mkdir -p $st; f=$out/$side-$ph.log
  { echo "### $side / $ph / tree $(git -C $W rev-parse HEAD)"; c=0; (cd $W && nice -n 15 timeout 600 node --import $W/scripts/tsx.mjs $H2 --tree $W --state $st --phase $ph) || c=$?; echo "### exit=$c"; } > $f 2>&1; san $f; grep '\[verdict\]' $f | sed "s#^#124337 $side/$ph #"; done; }
checkout 41277c50d231bb848eec5ed56645fc7f08ea70d9; p121 head
checkout 0cb65da5f2283965905abe1c55aca505e8139550; p124 head
checkout 042db1e7064930a08c534c4487864d7bfb8c5287; p121 control; p124 control
echo proofs-done
