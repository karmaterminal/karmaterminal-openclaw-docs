#!/bin/bash
# Usage: scenario.sh <abandon|cancel|restart> <side> <run#> <worktree>
SC=$1; LABEL=$SC-$2-$3; W=$4; source $HOME/i_have_a_pet_human/bm124-gate/harness/gw.sh
wait_prov() { local i; for i in $(seq 1 ${2:-120}); do grep -q "$1" "$OUT/provider.jsonl" 2>/dev/null && return 0; sleep 1; done; return 1; }
wait_send() { local i; for i in $(seq 1 ${2:-120}); do grep '"bot-send"' "$OUT/discord.jsonl" 2>/dev/null | grep -q "$1" && return 0; sleep 1; done; return 1; }
case $SC in
abandon)
  export ROUNDS=20 STEP=25
  fresh; start_aux; start_gw
  dm "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/'
  sleep 3; dm "MSG-A first queued"; sleep 1; dm "MSG-B second queued"
  T0=$(date +%s)
  while [ $(( $(date +%s) - T0 )) -lt 330 ]; do sleep 30; rows "+$(( $(date +%s) - T0 ))s"; done
  dm "MSG-C after the abandonment window"
  if wait_send 'MSG-C' 420; then echo "C replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "C NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 5; rows final
  stop_gw; stop_aux ;;
abandon-new)
  export ROUNDS=${ROUNDS:-24} STEP=25 DROP=new
  fresh; start_aux; start_gw
  dm "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/'
  sleep 3; dm "MSG-A takes the one queue slot"; sleep 3; dm "MSG-B rejected while the slot is full"
  T0=$(date +%s)
  while [ $(( $(date +%s) - T0 )) -lt ${WIN:-540} ]; do sleep 30; rows "+$(( $(date +%s) - T0 ))s"; done
  wait_prov '"phase":"reply","markers":\["HOLD-1"\]' 300 && echo "HOLD-1 done $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 20; dm "MSG-C after the hold"
  if wait_send 'MSG-C' 240; then echo "C replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "C NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 10; rows final
  for m in A B C; do echo "MSG-$m sends: $(grep '"bot-send"' $OUT/discord.jsonl | grep -c "MSG-$m")" >> "$OUT/meta.txt"; done
  stop_gw; stop_aux ;;
guild)
  export ROUNDS=${ROUNDS:-22} STEP=25 DROP=old QMODE=collect QCAP=${QCAP:-2}
  fresh; start_aux; start_gw
  gm "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/'
  sleep 3
  for i in 01 02 03 04 05 06 07 08 09 10 11 12; do gm "MSG-G$i busy room"; sleep 5; done
  T0=$(date +%s)
  while [ $(( $(date +%s) - T0 )) -lt ${WIN:-420} ]; do sleep 30; rows "+$(( $(date +%s) - T0 ))s"; done
  wait_prov '"phase":"reply","markers":\["HOLD-1"\]' 600 && echo "HOLD-1 done $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 30; gm "MSG-Z after the hold"
  if wait_send 'MSG-Z' 300; then echo "Z replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "Z NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 10; rows final
  stop_gw; stop_aux ;;
cancel)
  export ROUNDS=6 STEP=20
  fresh; start_aux; start_gw
  dm "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/'
  sleep 3; dm "MSG-A queued then stopped"; sleep 8; rows queued
  dm "/stop"; sleep 10; rows after-stop
  if wait_send 'MSG-A' 240; then echo "A replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "A NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 5; rows final
  stop_gw; stop_aux ;;
restart)
  export ROUNDS=6 STEP=20
  fresh; start_aux; start_gw
  dm "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/'
  sleep 3; dm "MSG-A queued across a restart"; sleep 8; rows queued
  stop_gw; rows after-shutdown
  start_gw
  if wait_send 'MSG-A' 300; then echo "A replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "A NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 20; rows final
  echo "A sends: $(grep '"bot-send"' $OUT/discord.jsonl | grep -c MSG-A)" >> "$OUT/meta.txt"
  stop_gw; stop_aux ;;
esac
finish
