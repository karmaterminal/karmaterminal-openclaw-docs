#!/usr/bin/env bash
# Quiet gate for the 08fead65d2 live check (🕯 grant 1556767588720185374): trailing 900 s, codex websocket idle
# timeouts AND `overloaded` retries must both be 0 on emeric-live and (once it exists) the isolated gateway.
ssh emeric bash -s <<'R'
w=900; P=~/proof-gw/rerun-08fead65; U=openclaw-proof-rerun-08fead65
cnt() { [ -f "$1" ] && sqlite3 -readonly "$1" "select count(*) from logs where feedback_log_body like '%idle timeout waiting for websocket%' and ts > strftime('%s','now')-$w" || echo 0; }
lt=$(cnt ~/.openclaw/agents/main/agent/codex-home/logs_2.sqlite)
it=$(cnt $P/state/agents/main/agent/codex-home/logs_2.sqlite)
lo=$(journalctl --user -u openclaw-gateway --since "-${w}s" -o cat --no-pager | grep -c "reason=overloaded")
io=$(journalctl --user -u $U --since "-${w}s" -o cat --no-pager 2>/dev/null | grep -c "reason=overloaded")
printf '%s\tlive_idle=%s\tiso_idle=%s\tlive_overloaded=%s\tiso_overloaded=%s\tquiet=%s\n' "$(date -u +%FT%TZ)" "$lt" "$it" "$lo" "$io" "$([ $((lt+it+lo+io)) -eq 0 ] && echo yes || echo no)"
R
