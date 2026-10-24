#!/bin/bash
LABEL=smoke-$1; W=$2; source $HOME/i_have_a_pet_human/bm124-gate/harness/gw.sh
fresh; start_aux; start_gw
dm "hello MSG-PING"
for i in $(seq 1 90); do grep -q '"bot-send"' "$OUT/discord.jsonl" && break; sleep 1; done
sleep 3; rows after-ping
stop_gw; stop_aux; finish
