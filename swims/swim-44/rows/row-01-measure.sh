#!/usr/bin/env bash
# swim-44 row-01 — continue_delegate(silent-wake) byte-decidable on cael-host
# Per SWIM-METHODOLOGY.md:90 (grep before claiming, raw before narrowing).
#
# Args: $1 = host-tag for output filename (e.g. cael), $2 = T0 epoch seconds (default: now).
# Exits 0 = candidate PASS (literals present in expected windows),
#       1 = candidate FAIL (gather ran, literals not present after raw re-read confirmed substrate vocabulary),
#       2 = INCONCLUSIVE (env confound: gateway restart in window, etc.),
#       3 = METHOD-BROKEN (gather harness wrong: missing journal access, missing literal-tokens, etc.).

set -u

HOST="${1:?usage: $0 <host-tag> [T0_epoch]}"
T0="${2:-$(date +%s)}"
WINDOW_END=$((T0 + 60))   # silent-wake delegate is immediate-fire; 60s window covers dispatch + completion-event
OUT_DIR="/tmp/swim-44-row-01-${HOST}-${T0}"
mkdir -p "$OUT_DIR"
RAW_LOG="$OUT_DIR/raw-journal.log"
NARROW_LOG="$OUT_DIR/narrowed.log"

# Step 1: raw gather (no grep) — truth-floor per SWIM-METHODOLOGY.md:90
journalctl --user -u openclaw-gateway \
  --since "@$T0" --until "@$WINDOW_END" \
  --no-pager > "$RAW_LOG" 2>&1
RAW_BYTES=$(wc -c < "$RAW_LOG")

# Step 2: METHOD-BROKEN check — if gateway-journal access produced 0 bytes in a 60s window
# while the gateway is up, the harness can't see the substrate
if [ "$RAW_BYTES" -lt 100 ]; then
  echo "METHOD-BROKEN: raw journal capture < 100 bytes ($RAW_BYTES) in 60s window" >&2
  echo "  raw log: $RAW_LOG" >&2
  exit 3
fi

# Step 3: INCONCLUSIVE check — gateway restart inside window invalidates wake-evidence
if grep -qE 'event-loop-lag armed|systemd.*started|new node PID' "$RAW_LOG"; then
  echo "INCONCLUSIVE: gateway restart event detected in window" >&2
  grep -E 'event-loop-lag armed|systemd.*started|new node PID' "$RAW_LOG" | head -3 >&2
  exit 2
fi

# Step 4: narrow to expected PASS literals
# PASS literal A: "Consuming N tool delegate(s)" — from agent-runner.ts dispatch path
# PASS literal B: "delegate-spawned hop=" — from continuation/delegate-dispatch path
grep -E 'Consuming [0-9]+ tool delegate|delegate-spawned hop=' "$RAW_LOG" > "$NARROW_LOG"
NARROW_LINES=$(wc -l < "$NARROW_LOG")

if [ "$NARROW_LINES" -ge 2 ]; then
  echo "PASS: $NARROW_LINES literal matches in window" >&2
  cat "$NARROW_LOG" >&2
  echo "  raw log: $RAW_LOG" >&2
  echo "  narrowed log: $NARROW_LOG" >&2
  exit 0
fi

# Step 5: 0 or 1 narrow matches — narrow returned less than expected.
# Per truth-floor reach: re-read raw to check if vocabulary is what we expect
echo "FAIL or METHOD-BROKEN: $NARROW_LINES literal matches (expected >= 2)" >&2
echo "  raw log size: $RAW_BYTES bytes; narrow returned $NARROW_LINES lines" >&2
echo "  raw log: $RAW_LOG" >&2
echo "  vocabulary check: re-grep raw for 'delegate' (any case, any prefix)" >&2
grep -i delegate "$RAW_LOG" | head -10 >&2
# If raw shows delegate-related activity but our narrowed pattern missed it,
# that's METHOD-BROKEN (vocabulary gap in our narrow pattern).
# If raw shows zero delegate activity in window, that's substrate FAIL.
if grep -qi delegate "$RAW_LOG"; then
  echo "METHOD-BROKEN: raw contains 'delegate' lines but narrow pattern missed them" >&2
  exit 3
fi
exit 1
