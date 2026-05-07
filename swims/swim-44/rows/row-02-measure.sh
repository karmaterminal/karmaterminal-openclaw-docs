#!/usr/bin/env bash
# swim-44/row-02 measurement harness
# Tests normal-mode continue_delegate journal emissions on deployed v5.5.
# Per L-v5.5-journal-vocabulary lesson: raw-journal-first, narrowed grep separate,
# METHOD-BROKEN guidance on zero-match-against-active-raw.
#
# Usage: ./row-02-measure.sh <host> <T0_epoch> <session-id>

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <host> <T0_epoch> <session-id>" >&2
  echo "example: $0 ronan 1778170000 agent:main:discord:channel:1466192485440164011" >&2
  exit 2
fi

HOST="$1"
T0="$2"
SESSION="$3"
WINDOW=120
T_END=$((T0 + WINDOW))

OUTDIR="/tmp/swim-44-row-02-${HOST}-${T0}"
mkdir -p "$OUTDIR"

echo "=== swim-44/row-02 measure ==="
echo "host:       $HOST"
echo "session:    $SESSION"
echo "T0:         $T0 ($(date -d @$T0 '+%Y-%m-%d %H:%M:%S %Z'))"
echo "T_END:      $T_END (T0 + ${WINDOW}s)"
echo "output:     $OUTDIR/"
echo

echo "=== RAW journal (canonical gather, no filter) ==="
ssh "$HOST" "journalctl --user -u openclaw-gateway --since '@${T0}' --until '@${T_END}' --no-pager 2>/dev/null" \
  | tee "$OUTDIR/raw-journal.log"

echo
echo "=== NARROWED — expected PASS literals for normal-mode delegate ==="
echo "  literal 1 (dispatch):     Consuming N tool delegate(s) for session $SESSION"
echo "  literal 2 (spawn-event):  [continuation:delegate-spawned] hop=N/MAX mode=normal session=$SESSION"
echo

NARROWED=$(grep -E "(Consuming [0-9]+ tool delegate.*$SESSION)|(delegate-spawned hop=.*mode=normal.*$SESSION)" "$OUTDIR/raw-journal.log" || true)

if [ -z "$NARROWED" ]; then
  ANY_DELEGATE=$(grep -iE 'delegate' "$OUTDIR/raw-journal.log" || true)
  if [ -n "$ANY_DELEGATE" ]; then
    echo "*** VERDICT GUIDANCE: METHOD-BROKEN ***"
    echo "Narrow grep returned zero matches but raw shows delegate activity:"
    echo "$ANY_DELEGATE"
    echo
    echo "Per L-v5.5-journal-vocabulary lesson: substrate vocabulary may differ from"
    echo "expected literals. Re-read raw output above, fix narrow pattern, re-run."
    echo "Do NOT interpret zero-narrow-match as substrate FAIL without raw-walk."
    exit 3
  else
    echo "Zero delegate activity in raw window. Verdict: FAIL (substrate genuinely silent)"
    exit 1
  fi
else
  echo "$NARROWED"
  CONSUMING_COUNT=$(echo "$NARROWED" | grep -cE "Consuming [0-9]+ tool delegate" || true)
  SPAWN_COUNT=$(echo "$NARROWED" | grep -cE "delegate-spawned hop=.*mode=normal" || true)
  echo
  echo "=== Verdict-input ==="
  echo "Consuming literal count:        $CONSUMING_COUNT"
  echo "delegate-spawned literal count: $SPAWN_COUNT"
  if [ "$CONSUMING_COUNT" -ge 1 ] && [ "$SPAWN_COUNT" -ge 1 ]; then
    echo "VERDICT: PASS — both expected literals present"
    exit 0
  elif [ "$CONSUMING_COUNT" -ge 1 ] && [ "$SPAWN_COUNT" -eq 0 ]; then
    echo "VERDICT-CANDIDATE: substrate-finding (Consuming present, delegate-spawned missing for normal mode — would mirror silent-mode finding from row-01; investigate)"
    exit 4
  else
    echo "VERDICT: partial-match; investigate"
    exit 4
  fi
fi
