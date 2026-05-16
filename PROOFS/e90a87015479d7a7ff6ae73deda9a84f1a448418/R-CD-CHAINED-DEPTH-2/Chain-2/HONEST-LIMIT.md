# Chain-2 — ordering-condition, NOT a regression (byte-walked, corrected)

**Seat**: ronan
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418

## Correction to earlier hypothesis

Earlier `HONEST-LIMIT.md` cited `compaction-boundary chain-guard` as cause. **That was wrong.** Byte-walk of gateway journal + source code shows the actual gate:

```
src/agents/subagent-spawn.ts:813-820
  const maxChildren = cfg.agents?.defaults?.subagents?.maxChildrenPerAgent
    ?? DEFAULT_SUBAGENT_MAX_CHILDREN_PER_AGENT  (=5)
  const activeChildren = countActiveRunsForSession(requesterInternalKey)
  if (activeChildren >= maxChildren) {
    return { status: "forbidden", error: "sessions_spawn has reached max active children for this session" }
  }
```

## Journal evidence (gateway log, 2026-05-16 11:08:30-40 PDT)

```
11:08:30.199 [continue_delegate] Consuming 6 tool delegate(s) for session sprites
11:08:30.278 Post-compaction delegate dispatch: R-CD-3
11:08:40.216 Tool DELEGATE spawn rejected (forbidden) for session sprites
11:08:40.229 Tool DELEGATE spawn rejected (forbidden) for session sprites
```

Two `forbidden` events at 11:08:40 = Chain-2 + Chain-3.

## Mechanism

7 delegates fired from single turn:
1. R-CD-1 (normal, delay=5s)
2. R-CD-2 (silent-wake, delay=8s)
3. R-CD-3 (post-compaction → handled by post-compaction-delegate-dispatch, separate path)
4. R-CD-4 (silent, cross-session targetSessionKey, delay=5s)
5. Chain-1 depth-1 (silent, delay=3s) → spawned ✅ (activeChildren=4 at dispatch)
6. Chain-2 depth-1 (silent, cross-session, delay=3s) → **forbidden** (activeChildren=5 at dispatch ≥ maxChildren=5)
7. Chain-3 depth-1 (silent, delay=3s) → **forbidden** (activeChildren=5 at dispatch)

Chain-1 squeaked through because it was the 5th-active (activeChildren=4 < 5 at the moment its spawn-call was evaluated). Chain-2 + Chain-3 hit `activeChildren=5 >= maxChildren=5` and returned forbidden.

## Classification

**Ordering condition, NOT regression, NOT environmental.**

- `src/agents/subagent-spawn.ts` diff PR-head→CANDIDATE_SHA = 0 bytes (verified via 🌿's byte-walk in `1505272930`)
- Same gate would have fired on PR-head with the same fire-pattern
- My config has `subagents.maxConcurrent=16, maxSpawnDepth=5` but no `maxChildrenPerAgent` set → default 5
- The gate fired correctly; my dispatch fired 6 regular delegates + 1 post-compaction in single turn, exceeded per-session active-children budget

## Why my earlier HONEST-LIMIT.md was wrong

I asserted `compaction-boundary chain-guard` from memory without byte-walking. The journal grep regex `delegate-rejected|DELEGATE spawn forbidden` missed the actual log line `DELEGATE spawn rejected (forbidden)`. The error log line phrasing differs from my mental model. Same shape as morning's *praecipitatio*: assertion before byte-check.

## Verdict at byte

- ✅ Schedule-shape contract verified at byte (parent EVIDENCE.md)
- ✅ Dispatch correctly fired `maxChildrenPerAgent` policy gate
- 🔬 Behavioral data: cross-session targeting at depth-1 (Chain-2) is NOT relevant; the gate fired purely on active-children count
- ⚠️ Self-correction: never assert mechanism without byte-walking the journal + the source

## To re-verify Chain-2 behavior cleanly

Fire Chain-2 alone (not coupled with R-CD-1/2/3/4 + Chain-1/3 in same turn). With activeChildren=0 at fire-time, the cross-session-targeted-return depth-2 chain should dispatch correctly. Open for follow-up if needed.
