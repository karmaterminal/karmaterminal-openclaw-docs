#!/usr/bin/env bash
# PR #121204 upgrade/data-compatibility proof: stable v2026.10.3 writes the state, the PR head drains it.
# A copy of the same stable-written state is drained by stable itself as the control.
# Fails (exit 1) unless every install, phase and seed exits 0.
set -u
S0=${SCRATCH:?set SCRATCH to the scratch dir holding openclaw/, gate25-F/, proof-121204/ and proof-121204-upgrade-src/}; W=$S0/gate25-F; U=$S0/proof-121204-upgrade
H1=$S0/proof-121204-upgrade-src/recovery-proof-upgrade.mts
STABLE=v2026.10.3; HEAD_SHA=3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6
bad=0
checkout() { cd $S0/openclaw && { git fetch -q origin $1 2>/dev/null || git fetch -q https://github.com/openclaw/openclaw.git "$1" "+refs/tags/$1:refs/tags/$1" 2>/dev/null || git fetch -q https://github.com/openclaw/openclaw.git $1; }; cd $W && git checkout -q --detach -f $1 && git clean -qfd -e node_modules -e .artifacts && echo "tree $(git rev-parse HEAD) ($1) dirty=$(git status --short | wc -l)" && nice -n 15 pnpm install --frozen-lockfile > /dev/null 2>&1; rc=$?; echo "install rc=$rc"; [ $rc -eq 0 ] || bad=1; }
san() { sed -i -e "s#$HOME#<home>#g" -e "s#$(hostname)#<host>#g" -e 's/\x1b\[[0-9;]*m//g' "$1"; }
step() { name=$1; shift; f=$U/logs/$name.log; { echo "### $name / tree $(git -C $W rev-parse HEAD)"; c=0; (cd $W && nice -n 15 timeout 600 "$@") || c=$?; echo "### exit=$c"; } > $f 2>&1; san $f; [ "$(grep -c '^### exit=0$' $f)" = 1 ] || { echo "nonzero exit in $f"; bad=1; }; grep -h '\[verdict\]\|\[seed\]\|total=' $f | sed "s#^#$name #"; }
rm -rf $U; mkdir -p $U/logs $U/runs; cp $S0/proof-121204-upgrade-src/upgrade-*.mts $U/
R=$U/runs/upgrade; RC=$U/runs/control; mkdir -p $R
checkout $STABLE
step stable-phaseA node --import $W/scripts/tsx.mjs $H1 --tree $W --run $R --phase A --scenario recovery
step stable-seed node --import $W/scripts/tsx.mjs $U/upgrade-seed.mts --tree $W --run $R
step dump-stable-written node $U/upgrade-dump.mts --run $R --label stable-written
cp -a $R $RC
checkout $HEAD_SHA
step head-phaseB node --import $W/scripts/tsx.mjs $H1 --tree $W --run $R --phase B --scenario recovery
step dump-after-head node $U/upgrade-dump.mts --run $R --label after-head
checkout $STABLE
step control-stable-phaseB node --import $W/scripts/tsx.mjs $H1 --tree $W --run $RC --phase B --scenario recovery
step dump-after-stable node $U/upgrade-dump.mts --run $RC --label after-stable
[ $bad -eq 0 ] && echo proofs-done || { echo proofs-FAILED; exit 1; }
