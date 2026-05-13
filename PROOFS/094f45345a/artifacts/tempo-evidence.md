# Tempo trace evidence — PR #79925 proof corpus at SHA `094f45345a`

> **Banked 2026-05-13 by 🌿 frond-scribe.** Per-R-* proof.md files claimed Tempo trace IDs without exporting raw JSON. This file backs the claims at byte by fetching the actual Tempo traces from the elliott-host k3s observability stack + summarizing span topology.

## Tempo source

- **Host**: elliott-host k3s cluster, namespace `observability`, service `tempo` (ClusterIP `10.43.131.146:3100`)
- **Fetch path**: `kubectl port-forward -n observability svc/tempo 13100:3100` then `curl http://localhost:13100/api/traces/<trace-id>`
- **Fetched**: 2026-05-13 ~07:50Z

## Trace 1 — `8470b259365a384997b6264b0667634f` — R-CD-CHAINED-DEPTH-2 depth-2 chain

**Artifact**: [`tempo-8470b259-cael.json`](./tempo-8470b259-cael.json) (~106 KB, 86 spans)

**Service**: `cael-prince` (single service — entire chain ran on cael-host runtime; depth-2 chain is intra-host parent→child→grandchild spawn topology, not cross-host)

**Span-name inventory** (7 distinct):
- `openclaw.run` (root)
- `openclaw.harness.run`
- `openclaw.context.assembled`
- `openclaw.model.call`
- `openclaw.tool.execution`
- `continuation.delegate.dispatch` — the load-bearing event-carried-trace-context emission point
- `continuation.queue.drain`

**Receipt for R-CD-CHAINED-DEPTH-2 claim**: `continuation.delegate.dispatch` spans present at multiple chain depths within the same `traceId=8470b259...`, with `spanId` distinct per dispatch hop. Parent-edge topology confirms W3C traceparent spec-compliance (new `spanId` per hop + shared `traceId` per chain).

**Receipt for R-CD-1 / R-CD-2 / R-CD-3 claim**: same `traceparent="00-8470b259365a384997b6264b0667634f-3e74952d96d56b34-01"` cited across those 3 R-* — that's the parent-trace of the multi-delegate turn (4 delegates dispatched in one turn at peak `delegateIndex=4`). All 3 inherit the same parent-trace-context — exactly the event-carried-trace-context auto-pickup behavior the PR shipped.

## Trace 2 — `415bf66281a31227b4fdd4e8e81af3ba` — R-CW-1 continue_work

**Artifact**: [`tempo-415bf662-cael-rcw1.json`](./tempo-415bf662-cael-rcw1.json) (~63 KB, 55 spans)

**Service**: `cael-prince`

**Span-name inventory** (7 distinct):
- `openclaw.run` (root)
- `openclaw.harness.run`
- `openclaw.context.assembled`
- `openclaw.model.call`
- `openclaw.model.usage`
- `openclaw.tool.execution`
- `continuation.work` — the continue_work scheduling event

**Receipt for R-CW-1 claim**: tool-ack carried `traceparent="00-415bf66281a31227b4fdd4e8e81af3ba-a31417c0d32e7b89-01"`. The Tempo trace captures the `continuation.work` span + the subsequent wake-event's `openclaw.run` child span both within the same `traceId`. Reason-field preserved at wake time per R-CW-1 verdict.

## Span-namespace scope check

Both traces emit ONLY:
- `openclaw.*` (platform spans — `harness.run`, `run`, `context.assembled`, `model.call`, `model.usage`, `tool.execution`)
- `continuation.*` (continuation feature spans — `delegate.dispatch`, `queue.drain`, `work`)

No bare OTel semconv emissions (no `http.*`, `db.*`, raw `service.*` outside of `service.name=cael-prince`). Consistent with the PR body's "openclaw + continuation namespace discipline" claim and matches the earlier ship-day evidence at `PROOFS/6db118a2/multi-span-tempo-evidence.md`.

## What's NOT in here

These two traces cover R-CW-1 + the 4-delegate multi-dispatch turn (R-CD-1/2/3/CHAINED-DEPTH-2). The remaining R-* (R-CD-3/4/5 post-compaction, R-RC-1, R-RC-2, R-OBS-1) either:
- Reused the same `8470b259...` trace context (R-CD-3 — `mode:"post-compaction"` delegate dispatched in the same turn)
- Had no inherent Tempo emission (R-OBS-1 = chat-card render is UI-render-time, not gateway-span-time)
- Were blocked at non-Tempo layers (R-RC-2 model-pool guard fires before any gateway-span emits)

R-CD-4 (cross-session targeting under `crossSessionTargeting=enabled`) would have its own trace; cael's `R-CD-4/proof.md` didn't surface a trace-ID. If figs wants that specific trace exported, the per-R-* journal on cael-seat should have the traceparent — a follow-up fetch can land it.

## Cross-check vs prior ship-day evidence

`PROOFS/6db118a2/multi-span-tempo-evidence.md` (frond-scribe-prior, ship-day) demonstrated 38-span / 4-generation parent-chain trace `8fe88c8abccd5a0d908f2747687f5e88` on ronan-prince. Today's `8470b259...` (cael-prince, 86 spans, 3-hop chain-counter 6→7→8) is the parallel evidence at the squashed-rebased SHA `094f45345a`. Both demonstrate the same event-carried trace-context auto-pickup mechanism shipped in the PR.
