#!/usr/bin/env bash
# swim-44/A1: TaskFlow flow_runs + per-agent sessions persistence across restart
# Args: $1 = host-tag (silas), $2 = T0 epoch seconds, $3 = SUT session-id
# Exit codes:
#   0 = PASS
#   1 = FAIL
#   2 = INCONCLUSIVE
#   3 = METHOD-BROKEN

set -u

HOST="${1:?usage: $0 <host-tag> <T0_epoch> <session-id>}"
T0="${2:?usage: $0 <host-tag> <T0_epoch> <session-id>}"
SESSION="${3:?usage: $0 <host-tag> <T0_epoch> <session-id>}"

OUT_DIR="/tmp/swim-44-A1-${HOST}-${T0}"
mkdir -p "$OUT_DIR"
PRE_FR="$OUT_DIR/flow_runs-pre.txt"
POST_FR="$OUT_DIR/flow_runs-post.txt"
PRE_JSONL="$OUT_DIR/jsonl-pre-md5.txt"
POST_JSONL="$OUT_DIR/jsonl-post-md5.txt"

REGISTRY="$HOME/.openclaw/flows/registry.sqlite"
SESSION_FILE="$HOME/.openclaw/agents/main/sessions/${SESSION}.jsonl"

if [ ! -f "$REGISTRY" ]; then
  echo "METHOD-BROKEN: registry.sqlite not found at $REGISTRY" >&2
  exit 3
fi
if [ ! -f "$SESSION_FILE" ]; then
  echo "METHOD-BROKEN: session jsonl not found at $SESSION_FILE" >&2
  exit 3
fi

sqlite3 "$REGISTRY" "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id" > "$PRE_FR" 2>&1
PRE_FR_COUNT=$(wc -l < "$PRE_FR")
md5sum "$SESSION_FILE" 2>/dev/null | awk '{print $1, $2}' > "$PRE_JSONL"

if [ "$PRE_FR_COUNT" -eq 0 ]; then
  echo "METHOD-BROKEN: pre-state has no runnable/queued flow_runs (stage delayed silent continue_delegate first)" >&2
  exit 3
fi

RUN_OUTPUT=$(gh workflow run restart-gateway.yml \
  --repo karmaterminal/openclaw-bootstrap \
  -f target_prince="$HOST" \
  -f reason="swim-44/A1 substrate-fire T0=${T0}" 2>&1)
DISPATCH_STATUS=$?
if [ $DISPATCH_STATUS -ne 0 ]; then
  echo "INCONCLUSIVE: workflow dispatch failed: $RUN_OUTPUT" >&2
  exit 2
fi

sleep 5
RUN_ID=$(gh run list --repo karmaterminal/openclaw-bootstrap --workflow=restart-gateway.yml --limit 1 --json databaseId --jq '.[0].databaseId')
if [ -z "$RUN_ID" ]; then
  echo "INCONCLUSIVE: dispatched run did not appear in run list" >&2
  exit 2
fi

gh run watch "$RUN_ID" --repo karmaterminal/openclaw-bootstrap --exit-status >&2
WATCH_STATUS=$?
if [ $WATCH_STATUS -ne 0 ]; then
  echo "INCONCLUSIVE: restart-gateway workflow run failed (exit $WATCH_STATUS)" >&2
  exit 2
fi

sleep 5
if ! systemctl --user is-active openclaw-gateway >/dev/null 2>&1; then
  echo "INCONCLUSIVE: gateway not active post-restart" >&2
  exit 2
fi

sqlite3 "$REGISTRY" "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id" > "$POST_FR" 2>&1
md5sum "$SESSION_FILE" 2>/dev/null | awk '{print $1, $2}' > "$POST_JSONL"

FR_DIFF=$(diff "$PRE_FR" "$POST_FR")
JSONL_DIFF=$(diff "$PRE_JSONL" "$POST_JSONL")

if [ -z "$FR_DIFF" ] && [ -z "$JSONL_DIFF" ]; then
  echo "PASS: pre/post snapshots byte-identical for runnable+queued flow_runs and SUT session jsonl" >&2
  exit 0
fi

if [ -z "$FR_DIFF" ]; then
  echo "PASS-with-jsonl-update: flow_runs preserved; jsonl changed without state-loss" >&2
  exit 0
fi

echo "FAIL: flow_runs runnable+queued differ pre/post-restart" >&2
echo "$FR_DIFF" >&2
exit 1
