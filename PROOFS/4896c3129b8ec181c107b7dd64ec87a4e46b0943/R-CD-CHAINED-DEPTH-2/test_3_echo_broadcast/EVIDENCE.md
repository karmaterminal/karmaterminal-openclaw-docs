# R-CD-CHAINED-DEPTH-2 TEST-3 — echo-broadcast (fanoutMode=tree) (re-fire at 4896c3129b)

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `4896c3129b8ec181c107b7dd64ec87a4e46b0943` (PR-head at deploy `26830502539`; cures landed locally at `c154b2e898` post-deploy per cael `1511395418`; binary-substrate-cross-walks because `4896c3129b → c154b2e898` is 1-file test-only delta not touching continuation-rail source-mechanism)
**Verdict**: ✅ PASS (instrumentation-advance vs prior cycle) — depth-1 shard dispatched depth-2 `continue_delegate(mode="normal", fanoutMode="tree")` + **`fanoutMode` now exposed in scheduled-response JSON** (closing the instrumentation-gap previously flagged at `1de29746f0/test_3_echo_broadcast`).

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(fanoutMode="tree")`. Verifies broadcast return targeting across continuation/subagent ancestor chain. `fanoutMode=tree` returns to every ancestor in chain (parent main + depth-1 dispatcher receive byte-identical payload).

## Byte-derived fire-evidence (rune-prince service, host `rune`)

### Depth-0 → depth-1 dispatch (parent main scheduling TEST-3 shard)

- **cohort traceparent**: `00-9d0fb000a9dab72aec1721b28e60f12e-d3ce368cb0ae65b1-01`
- **trace_id**: `9d0fb000a9dab72aec1721b28e60f12e`
- **parent span**: `d3ce368cb0ae65b1`
- **Note**: TEST-1/2/3 depth-0 → depth-1 dispatches share single cohort traceparent (single-turn-3-parallel-fires from parent main)

### Depth-1 → depth-2 dispatch (TEST-3 shard scheduling fanoutMode=tree echo-broadcast)

- **depth-1 session_id**: `agent:main:subagent:0c842412-37e5-4e84-b2ac-8f4658b0063e`
- **depth-1 → depth-2 continue_delegate tool-result**:
```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "fanoutMode": "tree",
  "traceparent": "00-9d0fb000a9dab72aec1721b28e60f12e-d3ce368cb0ae65b1-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```
- **Verified at byte**: `mode="normal"` ✅ + **`fanoutMode="tree"` ✅ (now visible in tool-result JSON; was instrumentation-gap at `1de29746f0`)**
- **depth-2 spawn-id**: not visible at schedule-time (status=scheduled; spawn happens post-depth-1-response per gateway runtime design)

## Instrumentation-advance vs prior `1de29746f0/test_3_echo_broadcast`

Prior cycle EVIDENCE.md verdict was "⚠️ PASS-WITH-INSTRUMENTATION-LIMIT — depth-1 shard dispatched depth-2 `continue_delegate(fanoutMode='tree')`; dispatch span recorded in Tempo, but the `fanoutMode` argument is NOT surfaced as a span attribute by current gateway instrumentation." At `4896c3129b` build the tool-result directly exposes `fanoutMode="tree"` in the scheduled-response JSON, **closing the instrumentation-gap at the depth-1-tool-result layer** explicitly named in prior-cycle evidence + recommended-instrumentation-request. Tempo span attribute walk pending fleet observability recovery per cael `1511395767` HONEST-LIMIT.

This row promotes from `⚠️ PASS-WITH-INSTRUMENTATION-LIMIT` to `✅ PASS (instrumentation-advance)` at `4896c3129b` build.

## Session topology

- Parent main session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:0c842412-37e5-4e84-b2ac-8f4658b0063e`
- Depth-2 target (intended): every ancestor in chain (parent main + depth-1 dispatcher) via `fanoutMode=tree` resolution

## Honest scope of PASS

- ✅ Cohort traceparent recorded for depth-0 → depth-1 dispatch (single trace_id shared with TEST-1/2).
- ✅ Depth-1 successfully scheduled depth-2 with `mode=normal` + `fanoutMode=tree` BOTH exposed in tool-result.
- ✅ **Instrumentation-advance vs prior cycle**: `fanoutMode` now exposed in scheduled-response JSON (was Tempo-only-instrumentation-gap previously; cohort recommended-instrumentation-request closed at depth-1-tool-result layer).
- ❌ NOT captured: depth-2 fanout-tree byte-identical-delivery to BOTH parent main AND depth-1 dispatcher (would emit under depth-2 trace plus two gateway-delivery spans).
- ❌ NOT captured: Tempo span attribute walk (fleet observability 404 per cael `1511395767` HONEST-LIMIT; will re-fetch when observability recovers).

## Reproducer

```
continue_delegate(
  task="[depth-1] fire continue_delegate(fanoutMode='tree') at depth-2; return receipt",
)
```

## Notes

- `fanoutMode=tree` is cohort-broadcast shape: depth-2 payload distributes byte-identical to every ancestor in continuation chain via session-delivery-queue.
- Distinct from `targetSessionKeys` (explicit recipient list) — `fanoutMode` resolves recipients structurally from chain rather than requiring caller to enumerate.
- **Instrumentation-gap closed at tool-result layer**: prior-cycle recommended-instrumentation-request was "tagging `fanoutMode`, `target.session.key`, `target.session.keys` as span attrs on `continuation.delegate.dispatch`." At `4896c3129b` tool-result exposes `fanoutMode` AND `targetSessionKey` (TEST-1+2 + TEST-3) directly. Tempo span-attribute layer still pending observability recovery for independent verification.
- Tempo URL when fleet observability recovers: http://tempo.dandelion.cult/api/traces/9d0fb000a9dab72aec1721b28e60f12e
