#!/bin/bash
# Copies each run's receipts into logs/<run>/ with home path, host name and ANSI codes removed, and the
# synthetic Telegram ids and fake tokens relabelled. Raw copies stay in runs/.
B=$HOME/i_have_a_pet_human/bm124-tg; rm -rf $B/logs; mkdir -p $B/logs
san() { sed -E -e "s#$HOME#<home>#g" -e "s#\b$(hostname)\b#<host>#g" -e 's/\x1b\[[0-9;]*m//g' \
  -e 's/123456789:AAproof-fake-token-not-a-credential/<fake-bot-token>/g' -e 's/proof-124337-tg-local-token/<fake-gateway-token>/g' \
  -e 's/5000000001/<human>/g' -e 's/7000000001/<bot>/g'; }
for d in $B/runs/*/; do r=$(basename $d); o=$B/logs/$r; mkdir -p $o
  for f in meta.txt rows.txt telegram.jsonl sent.jsonl handler.jsonl provider.jsonl; do [ -f $d/$f ] && san < $d/$f > $o/$f; done
  for g in $d/gateway-*.log; do [ -f $g ] && san < $g | grep -vE '\[state/sqlite\]|plugin tool factory returned null|app-server spawn|\[scheduler\] running event-loop-health' > $o/$(basename $g); done
done
grep -rlE "$(hostname)|$HOME|AAproof|([0-9]{1,3}\.){3}[0-9]{1,3}" $B/logs | while read f; do grep -oE "$(hostname)|$HOME|AAproof|([0-9]{1,3}\.){3}[0-9]{1,3}" "$f" | sort -u | grep -vE '^127\.0\.0\.1$|^0\.0\.0\.0$' | sed "s|^|$f: |"; done | head -20
echo sanitized $(ls $B/logs | wc -l) runs
