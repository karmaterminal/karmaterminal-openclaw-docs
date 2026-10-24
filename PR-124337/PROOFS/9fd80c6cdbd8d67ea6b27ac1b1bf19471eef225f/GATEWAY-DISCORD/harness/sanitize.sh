#!/bin/bash
# Copies each run's receipts into logs/<run>/ with home path, host name, ANSI codes and synthetic snowflakes relabelled.
B=$HOME/i_have_a_pet_human/bm124-gate; mkdir -p $B/logs
san() { sed -E -e "s#$HOME#<home>#g" -e "s#\b$(hostname)\b#<host>#g" -e 's/\x1b\[[0-9;]*m//g' \
  -e 's/1000000000000000001/<guild>/g' -e 's/2000000000000000001/<dm-channel>/g' -e 's/2000000000000000002/<guild-channel>/g' \
  -e 's/3000000000000000001/<bot>/g' -e 's/4000000000000000001/<human>/g' -e 's/50000000000000000([0-9]{2})/msg#\1/g' \
  -e 's/proof-token-not-a-credential/<fake-token>/g'; }
for d in $B/runs/*/; do r=$(basename $d); o=$B/logs/$r; mkdir -p $o
  for f in meta.txt rows.txt discord.jsonl sent.jsonl; do [ -f $d/$f ] && san < $d/$f > $o/$f; done
  [ -f $d/provider.jsonl ] && grep -v '"model":"gpt-5.6-luna"' $d/provider.jsonl | san > $o/provider.jsonl
  for g in $d/gateway-*.log; do [ -f $g ] && san < $g | grep -vE '\[state/sqlite\]|plugin tool factory returned null|app-server spawn' > $o/$(basename $g); done
done
grep -rlE "$(hostname)|$HOME|[0-9]{17,20}" $B/logs | head
echo sanitized $(ls $B/logs | wc -l) runs
