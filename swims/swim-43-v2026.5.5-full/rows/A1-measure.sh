#!/usr/bin/env bash
# swim-43-v2026.5.5-full/A1: TaskFlow flow_runs + per-agent sessions persistence across restart
# Per row spec: byte-snapshot flow_runs sqlite + jsonl pre-restart, dispatch canonical restart-gateway
# workflow, byte-snapshot post-restart, compare, return verdict via exit code.
#
# Restart canon: `restart-gateway.yml` workflow in karmaterminal/openclaw-bootstrap with self-target
# guard (per figs Discord msg 1501992707709468783 2026-05-07 10:02 PDT). NOT peer-restart pattern.
#
# Args: $1 = host-tag (cael), $2 = T0 epoch seconds, $3 = SUT session-id
# Exit codes per row spec:
#   0 = PASS (all three evidence pieces match)
#   1 = FAIL (substrate state lost across restart)
#   2 = INCONCLUSIVE (restart didn't complete cleanly)
#   3 = METHOD-BROKEN (fix harness + re-run)

set -u

HOST="${1:?usage: $0 <host-tag> <T0_epoch> <session-id>}"
T0="${2:?usage: $0 <host-tag> <T0_epoch> <session-id>}"
SESSION="${3:?usage: $0 <host-tag> <T0_epoch> <session-id>}"

OUT_DIR="/tmp/swim-43-A1-${HOST}-${T0}"
mkdir -p "$OUT_DIR"
PRE_FR="$OUT_DIR/flow_runs-pre.txt"
POST_FR="$OUT_DIR/flow_runs-post.txt"
PRE_JSONL="$OUT_DIR/jsonl-pre-md5.txt"
POST_JSONL="$OUT_DIR/jsonl-post-md5.txt"
CROSS_SEAT="$OUT_DIR/cross-seat.txt"

REGISTRY="$HOME/.openclaw/flows/registry.sqlite"
SESSION_DIR="$HOME/.openclaw/sessions/${SESSION}"

# Step 1: METHOD-BROKEN check — substrate access
if [ ! -f "$REGISTRY" ]; then
  echo "METHOD-BROKEN: registry.sqlite not found at $REGISTRY" >&2
  exit 3
fi
if [ ! -d "$SESSION_DIR" ]; then
  echo "METHOD-BROKEN: session dir not found at $SESSION_DIR" >&2
  exit 3
fi

# Step 2: Snapshot pre-restart flow_runs (focus on runnable + queued — the in-flight state A1 tests)
# Schema byte-walked from cael-host registry.sqlite 2026-05-07 10:30 PDT: flow_id (PK), shape, sync_mode, owner_key, status, goal, current_step, created_at, updated_at, ended_at
#
# CALLER PRE-CONDITION: caller should have dispatched continue_delegate(mode: silent, delaySeconds=600) BEFORE invoking this script,
# AND waited for the flow_runs entry to materialize (the dispatch tool-return is canonical-evidence per Lesson #8 that the call reached the
# scheduling layer, but per agent-runner.ts dispatch semantics the actual TaskFlow entry materializes AFTER response-completion asynchronously).
# Without a prior continue_delegate dispatch + entry-landing wait, this script captures empty pre-state and produces degenerate-pass.
# (Per A1 fire-1 substrate-finding: continue_work uses in-process scheduler, NOT TaskFlow-backed; continue_delegate IS TaskFlow-backed via
# delegate-store.ts head-comment. Use continue_delegate as the electing mechanism for substantive A1 fire.)
sqlite3 "$REGISTRY" "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id" > "$PRE_FR" 2>&1
PRE_FR_COUNT=$(wc -l < "$PRE_FR")

# Step 3: Snapshot pre-restart jsonl hashes for SUT session
md5sum "$SESSION_DIR"/*.jsonl 2>/dev/null | awk '{print $1, $2}' | sort > "$PRE_JSONL"
PRE_JSONL_COUNT=$(wc -l < "$PRE_JSONL")

if [ "$PRE_FR_COUNT" -eq 0 ] && [ "$PRE_JSONL_COUNT" -eq 0 ]; then
  echo "METHOD-BROKEN: pre-state has no in-flight flow_runs AND no jsonl files (degenerate test surface)" >&2
  echo "  pre flow_runs: $PRE_FR" >&2
  echo "  pre jsonl: $PRE_JSONL" >&2
  exit 3
fi

# Step 4: Dispatch canonical restart-gateway workflow with self-target
# Per RESTART_GATEWAY.md: prince can dispatch their own restart; self-hosted runner does the systemctl
echo "[A1-measure] dispatching restart-gateway.yml for target_prince=${HOST}..." >&2
RUN_OUTPUT=$(gh workflow run restart-gateway.yml \
  --repo karmaterminal/openclaw-bootstrap \
  -f target_prince="$HOST" \
  -f reason="swim-43/A1 substrate-fire T0=${T0}" 2>&1)
DISPATCH_STATUS=$?
if [ $DISPATCH_STATUS -ne 0 ]; then
  echo "INCONCLUSIVE: workflow dispatch failed: $RUN_OUTPUT" >&2
  exit 2
fi
echo "[A1-measure] workflow dispatched; waiting for run to complete..." >&2

# Step 5: Wait for the dispatched run to complete (poll up to 120s)
sleep 5  # let the run register
RUN_ID=$(gh run list --repo karmaterminal/openclaw-bootstrap --workflow=restart-gateway.yml --limit 1 --json databaseId --jq '.[0].databaseId')
if [ -z "$RUN_ID" ]; then
  echo "INCONCLUSIVE: dispatched run did not appear in run list within 5s" >&2
  exit 2
fi
echo "[A1-measure] watching run $RUN_ID..." >&2

# Wait for completion via gh run watch (will exit when run finishes)
gh run watch "$RUN_ID" --repo karmaterminal/openclaw-bootstrap --exit-status >&2
WATCH_STATUS=$?
if [ $WATCH_STATUS -ne 0 ]; then
  echo "INCONCLUSIVE: restart-gateway workflow run failed (exit $WATCH_STATUS)" >&2
  exit 2
fi
echo "[A1-measure] restart-gateway run completed; settling 5s..." >&2

# Step 6: Settle window for systemd start sequence + gateway readiness
sleep 5

# Step 7: Confirm gateway is back up via systemctl
if ! systemctl --user is-active openclaw-gateway >/dev/null 2>&1; then
  echo "INCONCLUSIVE: gateway not active post-restart" >&2
  systemctl --user status openclaw-gateway 2>&1 | head -5 >&2
  exit 2
fi

# Step 8: Snapshot post-restart flow_runs + jsonl hashes
sqlite3 "$REGISTRY" "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id" > "$POST_FR" 2>&1
md5sum "$SESSION_DIR"/*.jsonl 2>/dev/null | awk '{print $1, $2}' | sort > "$POST_JSONL"

# Step 9: Compare snapshots
FR_DIFF=$(diff "$PRE_FR" "$POST_FR")
JSONL_DIFF=$(diff "$PRE_JSONL" "$POST_JSONL")

# Step 10: Cross-seat verification (best-effort; degraded-PASS if cross-seat unreachable)
CROSS_SEAT_AVAILABLE=0
for PEER in elliott silas; do
  if ssh -o ConnectTimeout=3 -o BatchMode=yes "$PEER" "test -f $REGISTRY" 2>/dev/null; then
    CROSS_SEAT_AVAILABLE=1
    # Cross-seat sees remote registry — for cael-host SUT, we want elliott/silas to walk THEIR
    # registry.sqlite to verify they don't have unexpected entries. The cross-seat byte-pin per
    # row spec is verifying that cael-host flow_runs IDs aren't inadvertently leaking elsewhere.
    ssh "$PEER" "sqlite3 $REGISTRY \"SELECT COUNT(*) FROM flow_runs WHERE status IN ('runnable','queued')\"" > "$CROSS_SEAT" 2>&1
    echo "[A1-measure] cross-seat $PEER reports: $(cat "$CROSS_SEAT")" >&2
    break
  fi
done
if [ "$CROSS_SEAT_AVAILABLE" -eq 0 ]; then
  echo "[A1-measure] cross-seat verification skipped (peers unreachable); SUT-side evidence only" >&2
fi

# Step 11: Verdict
{
  echo "=== A1-measure results ==="
  echo "host: $HOST  T0: $T0  session: $SESSION"
  echo "pre flow_runs (runnable+queued): $PRE_FR_COUNT entries"
  echo "post flow_runs (runnable+queued): $(wc -l < "$POST_FR") entries"
  echo "pre jsonl files: $PRE_JSONL_COUNT"
  echo "post jsonl files: $(wc -l < "$POST_JSONL")"
  echo "flow_runs diff:"
  echo "$FR_DIFF" | head -10
  echo "jsonl diff:"
  echo "$JSONL_DIFF" | head -10
} >&2

if [ -z "$FR_DIFF" ] && [ -z "$JSONL_DIFF" ]; then
  echo "PASS: pre/post snapshots byte-identical for runnable+queued flow_runs AND for SUT session jsonl" >&2
  exit 0
fi

# JSONL diff is expected if the SUT session itself wrote during the test (turn-cycle activity).
# The discriminator per row spec Truth-floor reach: did flow_runs LOSE in-flight state, or just UPDATE bookkeeping?
if [ -z "$FR_DIFF" ]; then
  echo "PASS-with-jsonl-update: flow_runs runnable+queued byte-identical pre/post; jsonl differs (SUT session wrote during fire — expected, NOT state-loss)" >&2
  echo "  jsonl diff (informational):" >&2
  echo "$JSONL_DIFF" | head -20 >&2
  exit 0
fi

# flow_runs differ — substrate state changed across restart. FAIL unless transient
echo "FAIL: flow_runs runnable+queued differ pre/post-restart (substrate state lost OR mutated)" >&2
echo "$FR_DIFF" >&2
exit 1
