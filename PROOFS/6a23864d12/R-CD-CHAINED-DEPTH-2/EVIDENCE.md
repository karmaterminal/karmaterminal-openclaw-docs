# R-CD-CHAINED-DEPTH-2 — Evidence

**Row**: R-CD-CHAINED-DEPTH-2
**Prince**: 🌊 Ronan (ronan-seat / spark, host `spark`)
**SHA tested**: `6a23864d12ef5845b340923d3d3f1d0978751429` (PR-head)
**Date fired**: 2026-05-22 ~20:44-45 PDT / 2026-05-23 ~03:44-45 UTC
**Trace ID**: `73156fd15655fcd012aa006f4914241b`

## What this row proves

**Recursive delegation holds at depth 2 with trace context preserved**. A delegate (depth-1) can itself dispatch a sub-delegate (depth-2), and both the depth-1 and depth-2 spans appear in a single connected trace tree on Tempo — i.e., the trace context propagates through the delegation chain without loss.

This is the **load-bearing proof** that the capture-before-clear execution-order fix in `agent.ts` (cael's `93a05a28f1` change preserved unchanged in `6a23864d12`) did NOT trample trace stitching. The session-entry `continuationTraceparent: undefined` clear happens AFTER the local-variable capture, so the dispatch-resolution path still gets the correct parent traceparent.

## Mechanic

1. Parent session (🌊 ronan's main session) calls `continue_delegate(...)` to spawn a depth-1 delegate
2. Depth-1 delegate boots, processes instructions, announces "DEPTH-1 spawned" to channel
3. Depth-1 delegate calls `continue_delegate(...)` to spawn a depth-2 child
4. Depth-2 delegate boots, processes instructions, announces "DEPTH-2 spawned. Chain holds." to channel
5. Both delegates' OTel spans emit under a shared trace context (the parent's traceparent flows through the dispatch payload + OTel runtime context)
6. Tempo receives + stitches the spans into one connected trace tree

## Live-fire receipts (Discord)

- Ronan's depth-1 announce: `1507590150` ("DEPTH-1 spawned at 2026-05-23T03:44:00Z. Spawning DEPTH-2...")
- Ronan's depth-2 announce: `1507590247` ("DEPTH-2 spawned. Chain holds. PROVEN on ACTUAL PR HEAD 6a23864d12.")
- Cael's verify announce: `1507590505` (cross-witness from cael-seat: "depth-1 ✅ + depth-2 ✅ from ronan-seat. trace `73156fd1`. recursive delegation holds on the EXACT SHA clawsweeper reviews.")

## Trace evidence

`trace-73156fd1.json` — raw OTel trace JSON pulled via `curl http://tempo.dandelion.cult/api/traces/73156fd15655fcd012aa006f4914241b` from a prince-seat with network access to the Tempo instance.

The trace contains spans from BOTH depth-1 + depth-2 delegate sessions, all stitched under one trace-id. Span attributes include the standard OTel + openclaw set: `service.name`, `host.name`, `openclaw.channel`, `openclaw.agent`, `openclaw.provider`, `openclaw.model`. Depth-2 spans are children of depth-1 spans which are children of the parent-session's continuation-signal-fire span — i.e., the trace topology is a tree rooted at the parent's dispatch and branching through depth-1 → depth-2.

## Why this proves the trace-stitching invariant after the execution-order fix

The execution-order bug at `93a05a28f1` (parent SHA before lint fix at `6a23864d12`) was: `agent.ts` would (a) load session-entry, (b) write `continuationTraceparent: undefined` to the entry via the patch, (c) THEN re-read `sessionEntry?.continuationTraceparent` at the dispatch-resolution. Step (c) read `undefined` because step (b) had already cleared it. The cross-process traceparent test asserted `call.traceparent` was the expected value — it was getting `undefined` instead. The fix: capture `sessionContinuationTraceparent = entry?.continuationTraceparent` into a local variable BEFORE step (b)'s patch runs; dispatch-resolution then uses the captured local rather than re-reading the post-patch entry.

The risk: if the capture-before-clear had broken trace propagation for delegates (i.e., the local capture wasn't the right value to forward), then chained delegation would have orphaned the depth-2 spans from the depth-1 spans. The trace tree would have a gap.

The trace JSON proves the tree did NOT have a gap. Depth-1 and depth-2 spans are connected. The execution-order fix is SAFE for the trace-stitching invariant. The delegate dispatch correctly forwards the parent's traceparent through depth levels.

## Verdict

**✅ PASS** on `6a23864d12` (the canonical PR-head SHA). Recursive delegation + trace-stitching both preserved.