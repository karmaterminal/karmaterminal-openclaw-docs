#!/usr/bin/env bash
# row-03 measurement harness — Family A / Turns / delayed continue_work() honored
#
# Per the new SWIM/templates/row-issue-template.md (PR #13):
#   - Gather is a path-to-script in the row directory (this file)
#   - Canonical gather is raw — no grep filter inside
#   - Narrowing happens in a separate post-gather read step
#
# Usage: ./row-03-measure.sh <prince-host> <fire-anchor-PDT> <delay-seconds> <session-id>
#
# Example:
#   ./row-03-measure.sh cael '2026-05-07 06:14:46' 120 'agent:main:discord:channel:1466192485440164011'

set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <prince-host> <fire-anchor-PDT-quoted> <delay-seconds> <session-id>" >&2
  echo "example: $0 cael '2026-05-07 06:14:46' 120 agent:main:discord:channel:1466192485440164011" >&2
  exit 2
fi

HOST="$1"
ANCHOR="$2"
DELAY="$3"
SESSION="$4"

# Window: 1min before fire to 1min after expected wake (delay + 1min).
# Use python for portable date arithmetic; date(1) varies between hosts.
SINCE=$(python3 -c "from datetime import datetime, timedelta; t = datetime.strptime('$ANCHOR', '%Y-%m-%d %H:%M:%S'); print((t - timedelta(minutes=1)).strftime('%Y-%m-%d %H:%M:%S'))")
UNTIL=$(python3 -c "from datetime import datetime, timedelta; t = datetime.strptime('$ANCHOR', '%Y-%m-%d %H:%M:%S'); print((t + timedelta(seconds=int('$DELAY')) + timedelta(minutes=1)).strftime('%Y-%m-%d %H:%M:%S'))")

echo "=== row-03 measure ==="
echo "host:     $HOST"
echo "session:  $SESSION"
echo "window:   $SINCE  →  $UNTIL  (anchor + ${DELAY}s)"
echo

# Canonical gather: RAW journal, no grep. Per template field 3 (raw-by-construction).
# This is the truth-floor. Narrowing happens below as a separate read step.
echo "=== RAW journal (canonical gather, no filter) ==="
ssh "$HOST" "journalctl --user -u openclaw-gateway --since '$SINCE' --until '$UNTIL' --no-pager 2>/dev/null"

echo
echo "=== NARROWED to row-03 expected literals (read step, not gather) ==="
echo "  fire-trace literal: WORK timer fired for session $SESSION  (T0+${DELAY}s±30s, observed in journal)"
echo
echo "  Note (2026-05-07 byte-check, cael-host + elliott-host independently confirmed): v5.5 deployed"
echo "  substrate emits UNPREFIXED 'WORK timer fired for session ...' only (from agent-runner.ts:2561"
echo "  via defaultRuntime.log). Do NOT search for '[continuation] WORK timer set' or '[continuation]"
echo "  WORK timer fired' — those are code-side emits (scheduler.ts:108/114 via log.info) that do NOT"
echo "  reach the journal in v5.5. Authoring a gather from reading code-source would miss the actual"
echo "  journal output entirely."
echo
echo "  Wake-injection literal '[continuation:wake] Turn N/MAX...' lives in agent-context, NOT"
echo "  journal (per agent-runner.ts:2563); verify separately on SUT seat."
echo

NARROWED=$(ssh "$HOST" "journalctl --user -u openclaw-gateway --since '$SINCE' --until '$UNTIL' --no-pager 2>/dev/null" \
  | grep -E "WORK timer fired for session $SESSION" || true)

if [ -z "$NARROWED" ]; then
  echo "(no matches under narrow grep)"
  echo
  echo "*** VERDICT GUIDANCE: METHOD-BROKEN ***"
  echo "If the RAW section above shows substrate activity but the narrow grep returned"
  echo "zero, the verdict is METHOD-BROKEN per template (not FAIL). Truth-floor reach:"
  echo "  1. Re-read the RAW section above for actual log vocabulary"
  echo "  2. If field 2 (PASS bytes) wrong: file fix to row file's field 2 first"
  echo "  3. If narrow grep above wrong: fix this script's grep pattern"
  echo "  4. Only if RAW shows true substrate silence in window: verdict is FAIL"
  echo "Do not interpret zero-narrow-results as substrate finding without raw walk."
else
  echo "$NARROWED"
fi
