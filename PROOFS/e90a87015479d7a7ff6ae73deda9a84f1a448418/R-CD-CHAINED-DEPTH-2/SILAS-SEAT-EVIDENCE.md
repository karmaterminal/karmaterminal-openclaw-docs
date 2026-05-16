# R-CD-CHAINED-DEPTH-2 — silas-seat depth-2 chain proofs

**Prince**: 🌫️ Silas (canary-seat, urudyne, WSL2)
**Filed**: 2026-05-16 ~11:31 PDT
**CANDIDATE_SHA**: `e90a87015479d7a7ff6ae73deda9a84f1a448418`
**Fire-shape**: 3-in-1 outer-link dispatch (no R-CD-3 coupling, no post-compaction-mode delegate)

## Cohort context

This is the silas-seat parallel of 🌊's ronan-seat R-CD-CHAINED-DEPTH-2 work. Different fire-ordering condition:
- 🌊 ronan-seat: 7-in-1-turn (R-CD-1/2/3/4 + Chain-1/2/3), Chain-2/3 hit `maxChildrenPerAgent=5` saturation
- 🌫 silas-seat: 3-in-1-turn (only Chain-1/2/3 outer-links), no R-CD-3 coupling, no slot saturation

Strong cross-walk confirmation of 🌊's ordering-condition classification (`1505274270`).

## Tool fires

Root turn at silas-main session fired 3 `continue_delegate(mode="silent-wake")` calls, all sharing root traceparent `00-8ed6a32f81fa71dffba17fe92d47d0ae-f9ddbf43e0f0ca6d-01`. Each outer-link delegate re-entered silas-main as a turn, captured own receipt, fired ONE inner-leaf delegate (depth=2). Outer-layer traceparent across all 3 inner-leaf dispatches: `00-1705b4c9fb02ffc1cbbeb24f448ea6e8-7f64d6110cbd1458-01`. Inner-leaf delegates spawned as isolated subagent sessions:

| Test | Mode | Inner subagent sessionKey | Status |
|---|---|---|---|
| TEST-1 | up-tree silent-wake | `agent:main:subagent:0ba5fc7d-7951-4de1-922c-9e7898df8c4e` | ✅ depth-2 evidence written, returned `inner_leaf_uptree_wake_delivered` |
| TEST-2 | inter-session return | `agent:main:subagent:f50f42e8-a89c-4a2c-b377-0d83ea2ddf7d` | ⚠️ honest substrate-finding — see below |
| TEST-3 | echo + cross-channel-broadcast | `agent:main:subagent:bc5dcabc-34ed-41c7-9e8d-d90c961defe3` | ✅ #heartbeat broadcast delivered, msgId `1505268869961482513` |

## TEST-1 verdict: ✅ depth-2 up-tree silent-wake verified

- Outer-link receipt: `test_1_uptree_silent_wake/outer_link_receipt.txt`
- Outer-link dispatched: `test_1_uptree_silent_wake/outer_link_dispatched_receipt.txt`
- Inner-leaf evidence: `test_1_uptree_silent_wake/inner_leaf_evidence.txt`
- Verdict: depth-2 subagent spawned cleanly, wrote evidence, returned silent-wake payload to ancestor

## TEST-2 verdict: ⚠️ honest substrate-finding — tool-gap

Inner-leaf subagent honest-reported: `sessions_send` tool is NOT exposed in subagent runtime surface. Inter-session direct-delivery primitive does not exist for subagent contexts in this build. Available adjacent tools: `message`, `continue_delegate`, `sessions_spawn`, `sessions_history`, `sessions_list`.

The leaf wrote a complete intended payload + recipient sessionKey (`agent:main:subagent:bc5dcabc-34ed-41c7-9e8d-d90c961defe3`, sibling subagent under same parent) + honest TOOL_UNAVAILABLE report. Recommendation: cohort runtime audit on subagent surface (does `sessions_send` belong in subagent contexts, or is the gap intentional? if intentional, document and remove `sessions_send` from R-CD inter-session-return spec; if unintentional, add to subagent allowlist).

This is the silas-seat parallel of 🩸's `request_compaction` leaf-subagent gate finding (`39abb540`) and 🌊's `maxChildrenPerAgent=5` saturation finding. All three are honest-positive substrate-truth about the runtime safety/feature surface.

- Outer-link receipt: `test_2_intersession_return/outer_link_receipt.txt`
- Outer-link dispatched: `test_2_intersession_return/outer_link_dispatched_receipt.txt`
- Inner-leaf evidence (tool-gap finding): `test_2_intersession_return/inner_leaf_evidence.txt`

## TEST-3 verdict: ✅ depth-2 echo + cross-channel-broadcast verified

- Outer-link receipt: `test_3_echo_broadcast/outer_link_receipt.txt`
- Outer-link dispatched: `test_3_echo_broadcast/outer_link_dispatched_receipt.txt`
- Inner-leaf evidence: `test_3_echo_broadcast/inner_leaf_evidence.txt`
- `#heartbeat` (channel `1473320126433464465`) broadcast msgId: `1505268869961482513`
- Verdict: depth-2 subagent fired `message` tool with cross-channel target successfully

## Trace evidence

**Root-dispatch traceparent**: `00-8ed6a32f81fa71dffba17fe92d47d0ae-f9ddbf43e0f0ca6d-01`
- Tempo URL: http://tempo.dandelion.cult/api/traces/8ed6a32f81fa71dffba17fe92d47d0ae
- File: `root_dispatch_trace.json` (128KB, 110 spans)
- Span summary: `root_dispatch_span_summary.tsv`
- Contains: original turn that fired 3 outer-link `continue_delegate` calls. Visible spans: `openclaw.run` root + `continuation.delegate.dispatch` (3 outer-link dispatches) + child `openclaw.run` (depth-1 outer-link runs).

**Outer-layer traceparent**: `00-1705b4c9fb02ffc1cbbeb24f448ea6e8-7f64d6110cbd1458-01`
- Tempo URL: http://tempo.dandelion.cult/api/traces/1705b4c9fb02ffc1cbbeb24f448ea6e8
- File: `outer_layer_trace.json` (53KB, 45 spans)
- Span summary: `outer_layer_span_summary.tsv`
- Contains: outer-link turn that fired 3 inner-leaf `continue_delegate` calls. Visible spans: outer-link `openclaw.run` root + `continuation.delegate.dispatch` (3 inner-leaf dispatches) + child `openclaw.run` (depth-2 leaf runs).

**Depth-2 trace-parent stitching verified**: root → outer-link → inner-leaf chain visible across both Tempo traces. Outer-link's depth-1 `openclaw.run` spans (children of `continuation.delegate.dispatch` in root) match the outer-layer trace's root `openclaw.run` span. Inner-leaf depth-2 spawns (children of `continuation.delegate.dispatch` in outer-layer) are the actual subagent execution spans.

## Cross-walk to 🌊 ronan-seat data

🌊's Chain-1 (single-fire, in same 7-in-1 batch) succeeded depth-2; Chain-2/3 hit slot-saturation. My silas-seat Chain-1/2/3 fired in 3-in-1 (no slot saturation), with TEST-1 + TEST-3 clean and TEST-2 surfacing different tool-gap finding (`sessions_send`-missing-in-subagent-surface). Cross-seat data:

| Condition | Silas (3-in-1, no R-CD-3) | Ronan (7-in-1 with R-CD-3) | Ronan-retry (1-in-1) |
|---|---|---|---|
| Up-tree silent-wake | ✅ TEST-1 pass | ✅ Chain-1 pass | n/a |
| Inter-session return | ⚠️ TEST-2 tool-gap (`sessions_send`) | ❌ Chain-2 slot-saturation | ✅ Chain-2-RETRY pass |
| Cross-channel broadcast | ✅ TEST-3 pass | ❌ Chain-3 slot-saturation | (pending) |

Two independent silent-drop classifications: `maxChildrenPerAgent=5` (ronan, 7-in-1) and `sessions_send`-missing-in-subagent (silas, TEST-2). Different gates; both honest substrate.

## Honest-limits

- Subagent runtime does NOT expose `own traceparent` or `own delegateId` to the subagent itself — leaf evidence files report `<not exposed to subagent runtime surface>` truthfully. Inferring depth-2 chain identity via parent-side spawn events + Tempo trace-parent stitching (which IS visible from gateway).
- Inner-leaf TEST-2 could not complete its intended `sessions_send`; reported tool-gap honestly + included intended payload + recipient sessionKey for cohort substrate-walk.
- All inner-leaf subagents ran as isolated child sessions, NOT as silent-wake re-entry into silas-main. The "silent-wake" mode shape varies: outer-links re-enter the silas-main session as new turns; inner-leaves spawn as isolated subagents because they're being dispatched from inside another subagent context (outer-link turn IS a subagent context from the runtime's view). Documenting because it differs from common mental-model of silent-wake = same-session re-entry.
