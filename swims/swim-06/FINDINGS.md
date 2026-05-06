# Swim 6 Findings — recovered from frozen evidence branch

This file preserves the branch-local findings ledger that accompanied Swim 6 on the historical frozen evidence branch `ronan/rfc-evidence-appendix`.

## P0: `maxChainLength` off-by-one

- **Status**: fix applied during the canary cycle
- **Files**: `src/agents/subagent-announce.ts`, `src/auto-reply/reply/agent-runner.ts`
- **Fix shape**:
  - announce-side guard `>` → `>=`
  - tool dispatch task prefix includes `[continuation:chain-hop:${nextChainCount}]` so tool and bracket paths share the same counter semantics
- **Observed behavior before fix**: `maxChainLength: 10` allowed 12 shards
- **Evidence**: Swim 6-7b journal

## P1: generation-guard tolerance closure bug

- **Status**: identified during Swim 6; not yet fixed in the initial findings note
- **Bug**: `generationGuardTolerance` was captured in the timer closure at schedule time rather than re-read at fire time
- **Fix shape**: move config read inside the `setTimeout` callback
- **Evidence**: Swim 6-2 — config said 300, timer behavior still reflected stale value

## P2: `maxDelegatesPerTurn` hot-reload gap

- **Status**: identified during Swim 6; not yet fixed in the initial findings note
- **Bug**: width-limit config changes were not picked up without gateway restart
- **Fix shape**: read from config at consumption time instead of module init
- **Evidence**: Swim 6-7b — set to 10, still enforced at 5 until restart

## P2: `forbidden` spawn rejection layer

- **Status**: investigated as design / documentation rather than core bug
- **Finding**: the spawn layer had its own concurrent-session cap, producing a third defense layer beyond tool gate and runner gate
- **Evidence**: Swim 6-10 — 10 delegates consumed, 5 spawned, 5 rejected as `forbidden`

## P3: shard message target resolution

- **Status**: cosmetic / investigate
- **Finding**: shards could fail their first `message` call with an explicit-target error, then recover by parsing channel identity from session key
- **Impact**: extra latency and noisier logs, but no correctness loss

## P3: lane queue pressure under fan-out

- **Status**: document
- **Finding**: 5 parallel shards on the same session lane produced queue waits up to ~46 seconds and transient announce retries under load

## Scorecard copy from the original findings note

```text
6-1  ✅ Blind enrichment
6-2  ✅ Queue-drain resistance
6-3  ⏸️ Post-compaction (deferred — needs context buildup)
6-4  ✅ Return-to-fresh-session (3/3)
6-5  ⏳ Context-pressure lifecycle
6-6  ✅ 3-hop chain + visible announce
6-7  ❌ Chain length enforcement (off-by-one) — FIX APPLIED
6-7b ✅ Fan-out cap (maxDelegatesPerTurn)
6-8  ✅ Legacy token hygiene
6-9a ✅ Missing file (graceful ENOENT)
6-9b ✅ Slow shard (69s, completes independently)
6-9c ✅ Empty task (tool-level rejection)
6-10 ✅ Flood test (5 spawned, 5 forbidden — three-layer defense)
```

**Recovered provenance:** `karmaterminal/openclaw` branch `ronan/rfc-evidence-appendix`, file `SWIM6-FINDINGS.md`.