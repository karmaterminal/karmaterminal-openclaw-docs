#!/bin/bash
H=~/i_have_a_pet_human/source/WORKTREES/bm-124337-r21; B=~/i_have_a_pet_human/source/WORKTREES/bm-124337-base
cd ~/i_have_a_pet_human/bm124-tg
for spec in "restart base 1 $B" "restart head 2 $H" "restart base 2 $B" "restart head 3 $H" "restart base 3 $B" "cancel head 2 $H" "cancel base 2 $B" "cancel head 3 $H" "cancel base 3 $B"; do
  set -- $spec; echo "== $1-$2-$3 start $(date -u +%TZ)"
  timeout 590 bash harness/scenario.sh $1 $2 $3 $4 > runs/$1-$2-$3.driver.txt 2>&1; echo "rc=$? end $(date -u +%TZ)"
done
echo BATCH-DONE
