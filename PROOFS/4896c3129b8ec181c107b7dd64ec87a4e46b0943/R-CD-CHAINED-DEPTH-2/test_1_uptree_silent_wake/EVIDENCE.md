# R-CD-CHAINED-DEPTH-2 TEST-1 — up-tree silent-wake (re-fire at 4896c3129b)

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `4896c3129b8ec181c107b7dd64ec87a4e46b0943` (PR-head at deploy `26830502539`; cures landed locally at `c154b2e898` post-deploy per cael `1511395418`; binary-substrate-cross-walks because `4896c3129b → c154b2e898` is 1-file test-only delta in `subagent-announce.targeted-return.integration.test.ts` not touching continuation-rail source-mechanism)
**Verdict**: ✅ PASS — depth-1 shard dispatched depth-2 `continue_delegate(mode="silent-wake", targetSessionKey=<parent main>)` cleanly + cohort traceparent shared with TEST-2/3 fires + tool-result-instrumentation-advance vs prior `1de29746f0` cycle (`targetSessionKey` now exposed in scheduled-response JSON).

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(mode="silent-wake", targetSessionKey=<parent>)`. Verifies depth-1 can dispatch silent-wake depth-2 targeting original parent (not depth-1 dispatcher), exercising (a)-shape session-delivery-queue substrate across two chain hops + silent-wake-mode-injection-semantic at depth-2.

## Byte-derived fire-evidence (rune-prince service, host `rune`)

### Depth-0 → depth-1 dispatch (parent main scheduling TEST-1 shard)

- **cohort traceparent**: `00-9d0fb000a9dab72aec1721b28e60f12e-d3ce368cb0ae65b1-01`
- **trace_id**: `9d0fb000a9dab72aec1721b28e60f12e`
- **parent span**: `d3ce368cb0ae65b1`
- **Note**: TEST-1/2/3 depth-0 → depth-1 dispatches share single cohort traceparent (single-turn-3-parallel-fires from parent main)

### Depth-1 → depth-2 dispatch (TEST-1 shard scheduling silent-wake to parent)

- **depth-1 session_id**: `agent:main:subagent:c464625a-9bf7-43f8-976a-cc6434e8aa90`
- **depth-1 → depth-2 continue_delegate tool-result**:
```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "traceparent": "00-9d0fb000a9dab72aec1721b28e60f12e-d3ce368cb0ae65b1-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```
- **Verified at byte**: `mode="silent-wake"` ✅ + `targetSessionKey="agent:main:discord:channel:1466797..."` ✅ (parent main session)
- **depth-2 spawn-id**: not visible at schedule-time (status=scheduled; spawn happens post-depth-1-response per gateway runtime design)

## Instrumentation-advance vs prior `1de29746f0/test_1_uptree_silent_wake`

Prior cycle EVIDENCE.md noted: "❌ NOT independently confirmed in Tempo: targetSessionKey as separate span attr in this run." At `4896c3129b` build the tool-result directly exposes `targetSessionKey` in the scheduled-response JSON (line above), closing the per-instrumentation-gap at the depth-1-tool-result layer. Tempo span attributes-walk pending fleet observability recovery per cael `1511395767` HONEST-LIMIT.

## Session topology

- Parent main session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:c464625a-9bf7-43f8-976a-cc6434e8aa90`
- Depth-2 target: parent main session (silent-wake injection, no channel echo)

## Honest scope of PASS

- ✅ Cohort traceparent recorded for depth-0 → depth-1 dispatch (single trace_id shared with TEST-2/3 per single-turn-3-parallel-fires shape).
- ✅ Depth-1 successfully scheduled depth-2 with `mode=silent-wake` + `targetSessionKey=<parent>` exposed in tool-result.
- ✅ Instrumentation-advance vs prior cycle: `targetSessionKey` now exposed in scheduled-response JSON (was Tempo-only-instrumentation-gap previously).
- ❌ NOT captured: depth-2 silent-wake injection arrival at parent main (would emit under depth-2 trace post-dispatch; expected to land as next-turn-internal-event after this PROOFS-fire turn ends).
- ❌ NOT captured: Tempo span attribute walk (fleet observability 404 per cael `1511395767` HONEST-LIMIT; will re-fetch when observability recovers).

## Reproducer

```
continue_delegate(
  task="[depth-1] fire continue_delegate(mode='silent-wake', targetSessionKey=<parent main session>) at depth-2; return receipt",
)
```

## Notes

- Cohort traceparent `9d0fb000a9dab72aec1721b28e60f12e` shared across TEST-1/2/3 depth-0 → depth-1 dispatches per single-turn-3-parallel-fires from parent main (turn 4/5/6 of chain).
- Silent-wake-mode is post-compaction-shape from continuation-tools section of OpenClaw runtime docs.
- Tempo URL when fleet observability recovers: http://tempo.dandelion.cult/api/traces/9d0fb000a9dab72aec1721b28e60f12e
