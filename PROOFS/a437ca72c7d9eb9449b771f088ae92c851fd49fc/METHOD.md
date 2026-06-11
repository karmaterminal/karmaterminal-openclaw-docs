# METHOD — `a437ca72c7d9eb9449b771f088ae92c851fd49fc` proof corpus

Methodology canon: `openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md`. This file holds the concrete reproducer-anchors used for THIS corpus's rows so a future-reader can re-walk the bytes.

## Binary verify (every seat, before any row)

```bash
openclaw --version                                   # → OpenClaw 2026.6.2 (a437ca7)
systemctl --user show openclaw-gateway --property=ActiveEnterTimestamp,MainPID
cd ~/flesh_beast_tmp/openclaw && git log --oneline -1 # → a437ca72c7d Merge #992
```

## Durable `flow_runs` walk (CAPTURE + drain state)

```bash
DB=~/.openclaw/state/openclaw.sqlite
# the multi-fire flowIds (distinct rows + revision-cycling + terminal transitions):
sqlite3 -header -column "$DB" "SELECT substr(flow_id,1,8) AS flow, status, revision AS rev,
  datetime(created_at/1000,'unixepoch','localtime') AS created,
  datetime(updated_at/1000,'unixepoch','localtime') AS updated
  FROM flow_runs ORDER BY updated_at DESC LIMIT 12;"
# status totals (storm vs clean):
sqlite3 "$DB" "SELECT status, COUNT(*) FROM flow_runs GROUP BY status;"
```

CAPTURE signature: N `continue_work` fired in ONE turn → N DISTINCT `flow_id`s with the SAME-second `created_at` = array-captured N→N (`scheduleContinuationWorkBatch`). Pre-#985 (`4bbd3aec`) would show 1 (last-write-wins).

## Delivery-drive + wake-events (journal)

```bash
# wake/hedge/drive progression + the busy-seat drive-skip residual:
journalctl --user -u openclaw-gateway --since '<HH:MM>' \
  | grep -E 'continuation:(work-wake|work-hedge-fired|work-drive-skipped)'
# per-flowId drive/skip:
journalctl --user -u openclaw-gateway --since '<HH:MM>' | grep -E '<flowId-prefix>'
```

DELIVERY signature: each fire delivers as a distinct `[continuation:wake] Turn N/200` with its own `Reason:` text preserved (no conflation). On a busy seat, `work-drive-skipped reason=requests-in-flight` is the #952-domain cycling-residual (the seat never goes quiet → retryable-guard re-arms rather than drives). Cure-is-the-quiet drains it (the seat quieting → the matured elections drive → success-mark → drain to terminal).

## #989 chain-reset confirm

```bash
# session_status shows chain N/200. After a fresh non-continuation USER turn,
# the !isContinuationWake reset-gate (agent-runner.ts:1788) resets the counter.
# A full-day continuation session at chain 0 = the gate firing as designed.
```

## #989-P2-1 ordinary-subagent-return reset (both legs — per 🌊's precision)

```
Leg (a): continue_delegate ORDINARY completion (NO in-chain marker)
         → trigger-mint = subagent-return (NOT delegate-return)
         → chain RESETS  (the n/200-hole closer)
Leg (b): in-chain [continuation:chain-hop:N] return
         → trigger-mint = delegate-return
         → chain PRESERVES + CAPS  (runaway-leash intact)
The split is correct ONLY IF BOTH hold (mis-route either way is the bug).
```

## Tempo trace (figs 2026-05-16 — part of the full proof-set)

Each continuation fire emits a trace-id (visible in the journal `[continuation:…]` lines + tool-result payload). Capture:
- `http://tempo.dandelion.cult/api/traces/<trace-id>` (JSON export or span-tree screenshot)
- naming: `R-<row>/<descriptive>_trace.{json,png}` alongside the journal/sqlite receipts
- chained/inter-session/post-compaction rows: trace-parent stitching across spans

## Cure-bytes / gates

Gate-3 local-test logs + Gate-2 cure-byte 4-path verification land under `gates/` + `cure-bytes/` at corpus-root per the runbook, when a drift-cure gate-stack is run for this SHA. (This corpus is primarily live-host behavioral validation post-fanout; gate-stack logs attach if/when the PR-presentation gate-run targets this SHA.)
