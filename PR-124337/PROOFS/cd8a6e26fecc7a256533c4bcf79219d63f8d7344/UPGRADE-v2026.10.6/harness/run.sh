#!/usr/bin/env bash
# PR #124337 upgrade / data-model compatibility proof.
# Stable v2026.10.6 writes the state; the PR candidate drains it in a fresh process.
# A copy of the same stable-written state is drained by stable itself as the control.
# Head's doctor migrates the state first (the upgrade step); a copy of the migrated state is
# drained by clean upstream 7ab64536d3 as the second control, so the PR's own effect is isolated.
# Exits 1 unless every step exits 0.
set -u
P=~/i_have_a_pet_human/upgrade124337-2026.10.6
ST=~/i_have_a_pet_human/source/WORKTREES/stable-2026.10.6   # v2026.10.6 = fe06181dc5 (tag object 3494baecba)
HD=~/i_have_a_pet_human/source/WORKTREES/bm-124337          # candidate cd8a6e26fe (dist built at 8da32c408e; cd8a only drops a test)
UP=~/i_have_a_pet_human/source/WORKTREES/ctl-main-827a      # clean upstream main 7ab64536d3, the PR's base
H=$P/harness/upgrade-124337.mts; DUMP=$P/harness/upgrade-dump.mts
N="nice -n 19 taskset -c 16-31"
export PATH=~/.nvm/versions/node/v26.12.1/bin:$PATH
R=$P/runs/upgrade; RC=$P/runs/control; RU=$P/runs/upstream
bad=0
ident() {
  local tag=$1 tree=$2
  echo "== identity $tag $(date -u +%FT%TZ) tree=$tree HEAD=$(git -C $tree rev-parse HEAD) tracked_changes=$(git -C $tree status --porcelain --untracked-files=no | wc -l) node=$(node -v) cwd=$(pwd)" >> $P/logs/identity.txt
}
san() { sed -i -e "s#$HOME#<home>#g" -e "s#$(hostname)#<host>#g" -e 's/\x1b\[[0-9;]*m//g' "$1"; }
step() {
  local name=$1 tree=$2; shift 2
  local f=$P/logs/$name.log c=0
  ident "start-$name" $tree
  { echo "### $name / tree $(git -C $tree rev-parse HEAD)"; (cd $tree && $N timeout 600 "$@") || c=$?; echo "### exit=$c"; } > $f 2>&1
  ident "end-$name" $tree
  san $f
  [ "$(grep -c '^### exit=0$' $f)" = 1 ] || { echo "nonzero exit in $f"; bad=1; }
  grep -hE '\] dispatch |recoverStaleClaims|total=|\[seed-rest\] ' $f | sed "s#^#$name #"
}
rm -rf $P/runs; mkdir -p $R
step stable-seed           $ST node --import $ST/scripts/tsx.mjs $H --tree $ST --run $R --mode seed
step stable-seed-rest      $ST node --import $ST/scripts/tsx.mjs $H --tree $ST --run $R --mode seed-rest
step dump-stable-written   $ST node $DUMP --run $R --label stable-written
cp -a $R $RC
step head-doctor-migrate   $HD bash $P/harness/doctor-migrate.sh $HD $R
step dump-after-migrate    $HD node $DUMP --run $R --label after-migrate
cp -a $R $RU
step head-drain            $HD node --import $HD/scripts/tsx.mjs $H --tree $HD --run $R --mode drain
step dump-after-head       $HD node $DUMP --run $R --label after-head
step upstream-drain        $UP node --import $UP/scripts/tsx.mjs $H --tree $UP --run $RU --mode drain
step dump-after-upstream   $UP node $DUMP --run $RU --label after-upstream
step control-stable-drain  $ST node --import $ST/scripts/tsx.mjs $H --tree $ST --run $RC --mode drain
step dump-after-stable     $ST node $DUMP --run $RC --label after-stable
[ $bad -eq 0 ] && echo proofs-done || { echo proofs-FAILED; exit 1; }
