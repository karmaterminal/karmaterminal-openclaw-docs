#!/usr/bin/env bash
# Progress-aware hang guard (replaces fenced-seat.sh's dir-age guard): a running shard whose
# shard-state.json test_lines has not increased for STALL_MIN minutes is killed and logged as a hang.
K=$HOME/ci-fenced-08fead65/seat; STALL_MIN=${STALL_MIN:-20}; S=$K/.progress; mkdir -p $S
while systemctl --user is-active --quiet ci-fenced-08fead65; do
  for st in $K/results/*/*/shard-state.json; do
    [ -f "$st" ] || continue
    state=$(jq -r .state "$st" 2>/dev/null); [ "$state" = running ] || continue
    name=$(basename "$(dirname "$st")" | sed 's/^node-//'); lines=$(jq -r '.test_lines // 0' "$st")
    f=$S/$name; prev=$(cut -d' ' -f1 "$f" 2>/dev/null); since=$(cut -d' ' -f2 "$f" 2>/dev/null)
    now=$(date +%s)
    if [ "$lines" != "$prev" ]; then echo "$lines $now" > "$f"; continue; fi
    if [ $(( (now - since) / 60 )) -ge "$STALL_MIN" ]; then
      w=$(ls -d $K/work/*/shard-*-"$name" 2>/dev/null | head -1)
      echo "$(date -u +%FT%TZ) HANG-KILL $name: test_lines stuck at $lines for ${STALL_MIN}m" >> $K/hang.log
      [ -n "$w" ] && { pkill -TERM -f -- "$w"; sleep 20; pkill -KILL -f -- "$w"; }
      echo "$lines 9999999999" > "$f"
    fi
  done
  sleep 60
done
