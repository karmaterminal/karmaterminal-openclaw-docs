#!/usr/bin/env bash
# Remove fenced-seat.sh's flawed dir-age guard from the cut-side plugins run when it starts.
for i in $(seq 1 600); do
  p=$(pgrep -f 'cmp-plugins-08fead65d2/fenced-seat.sh' | head -1)
  if [ -n "$p" ]; then sleep 5; for c in $(pgrep -P $p); do if pgrep -P "$c" -x sleep >/dev/null; then kill "$c" && echo "$(date -u +%T) killed guard $c" >> ~/ci-fenced-08fead65/kill-dirage-guard.log; fi; done; exit 0; fi
  sleep 15
done
