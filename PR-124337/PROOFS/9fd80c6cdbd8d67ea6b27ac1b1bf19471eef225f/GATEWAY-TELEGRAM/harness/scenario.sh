#!/bin/bash
# Usage: scenario.sh cancel <side> <run#> <worktree>
# Re-execs itself in a fresh user+network namespace with only loopback up, and a minimal env.
if [ -z "${PROOF_NETNS:-}" ]; then
  exec env -i HOME="$HOME" USER="$USER" LANG=C.UTF-8 TERM=dumb PATH=/usr/bin:/bin PROOF_NETNS=1 \
    unshare --map-root-user --net bash -c 'ip link set lo up && exec bash "$0" "$@"' "$0" "$@"
fi
SC=$1; LABEL=$SC-$2-$3; W=$4; source $HOME/i_have_a_pet_human/bm124-tg/harness/gw.sh
wait_prov() { local i; for i in $(seq 1 ${2:-120}); do grep -q "$1" "$OUT/provider.jsonl" 2>/dev/null && return 0; sleep 1; done; return 1; }
wait_tg() { local i; for i in $(seq 1 ${3:-120}); do grep "\"$1\"" "$OUT/telegram.jsonl" 2>/dev/null | grep -q "$2" && return 0; sleep 1; done; return 1; }
case $SC in
cancel)
  export ROUNDS=6 STEP=20
  fresh; start_aux; start_gw
  say "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/' || echo "HOLD-1 never reached provider" >> "$OUT/meta.txt"
  K=$(api keyboard '{"text":"MSG-BTN pick one","data":"proof:approve"}' | sed -E 's/.*"message_id":([0-9]+).*/\1/')
  echo "keyboard message_id=$K $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 3; api press "{\"message_id\":$K}" >> "$OUT/sent.jsonl"; echo >> "$OUT/sent.jsonl"; echo "press message_id=$K $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 8; rows queued
  say "/stop"; sleep 10; rows after-stop
  echo "markup-edits on K before redelivery: $(grep '"bot-edit-markup"' $OUT/telegram.jsonl | grep -c "\"message_id\":$K")" >> "$OUT/meta.txt"
  if wait_tg bot-send 'MSG-SUBMIT' 90; then echo "SUBMIT replied after stop $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "SUBMIT not replied within 90 s of stop" >> "$OUT/meta.txt"; fi
  rows before-second-press
  echo "after stop: handler invocations=$(wc -l < $OUT/handler.jsonl 2>/dev/null) answers cbq-1=$(grep -c '"callback_query_id":"cbq-1"' $OUT/telegram.jsonl) markup-edits on K=$(grep '"bot-edit-markup"' $OUT/telegram.jsonl | grep -c "\"message_id\":$K") keyboards=$(curl -fsS http://127.0.0.1:$MKP/__control/state | sed -E 's/.*"keyboards":(\[[^]]*\]).*/\1/')" >> "$OUT/meta.txt"
  api press "{\"message_id\":$K}" >> "$OUT/sent.jsonl"; echo >> "$OUT/sent.jsonl"; echo "second press message_id=$K $(date -u +%TZ)" >> "$OUT/meta.txt"
  if wait_tg bot-send 'MSG-SUBMIT' 150; then echo "SUBMIT replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "SUBMIT NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 10; rows final
  echo "final: handler invocations=$(wc -l < $OUT/handler.jsonl 2>/dev/null) markup-edits on K=$(grep '"bot-edit-markup"' $OUT/telegram.jsonl | grep -c "\"message_id\":$K") SUBMIT sends=$(grep '"bot-send"' $OUT/telegram.jsonl | grep -c MSG-SUBMIT) keyboards=$(curl -fsS http://127.0.0.1:$MKP/__control/state | sed -E 's/.*"keyboards":(\[[^]]*\]).*/\1/')" >> "$OUT/meta.txt"
  stop_gw; stop_aux ;;
restart)
  export ROUNDS=6 STEP=20
  fresh; start_aux; start_gw
  say "HOLD-1 keep the turn busy"; wait_prov 'hold-sleep 1/' || echo "HOLD-1 never reached provider" >> "$OUT/meta.txt"
  K=$(api keyboard '{"text":"MSG-BTN pick one","data":"proof:approve"}' | sed -E 's/.*"message_id":([0-9]+).*/\1/')
  echo "keyboard message_id=$K $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 3; api press "{\"message_id\":$K}" >> "$OUT/sent.jsonl"; echo >> "$OUT/sent.jsonl"; echo "press message_id=$K $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 8; rows queued
  stop_gw; rows after-shutdown
  echo "after shutdown: handler invocations=$(wc -l < $OUT/handler.jsonl 2>/dev/null) markup-edits on K=$(grep '"bot-edit-markup"' $OUT/telegram.jsonl | grep -c "\"message_id\":$K") keyboards=$(curl -fsS http://127.0.0.1:$MKP/__control/state | sed -E 's/.*"keyboards":(\[[^]]*\]).*/\1/')" >> "$OUT/meta.txt"
  start_gw
  if wait_prov 'MSG-SUBMIT' 180; then echo "SUBMIT reached the model $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "SUBMIT never reached the model" >> "$OUT/meta.txt"; fi
  if wait_tg bot-send 'MSG-SUBMIT' 240; then echo "SUBMIT replied $(date -u +%TZ)" >> "$OUT/meta.txt"; else echo "SUBMIT NOT replied by deadline" >> "$OUT/meta.txt"; fi
  sleep 15; rows final
  echo "final: handler invocations=$(wc -l < $OUT/handler.jsonl 2>/dev/null) callbackIds=$(grep -o '"callbackId":"[^"]*"' $OUT/handler.jsonl | sort | uniq -c | tr -s ' ' | tr '\n' ';') markup-edits on K=$(grep '"bot-edit-markup"' $OUT/telegram.jsonl | grep -c "\"message_id\":$K") SUBMIT sends=$(grep '"bot-send"' $OUT/telegram.jsonl | grep -c MSG-SUBMIT) keyboards=$(curl -fsS http://127.0.0.1:$MKP/__control/state | sed -E 's/.*"keyboards":(\[[^]]*\]).*/\1/')" >> "$OUT/meta.txt"
  stop_gw; stop_aux ;;
esac
finish
