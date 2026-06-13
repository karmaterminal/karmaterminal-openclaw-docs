# R-RC-2 — volitional `request_compaction` fired live (cael-seat)

**Proof type:** real-behavior runtime evidence (captured Tempo trace JSON, sha256-verifiable).

## What this proves

A volitional `request_compaction` fired end-to-end on a live OpenClaw deployment (cael-seat, 2026-06-13 session): the tool was invoked, compaction was released, and the post-compaction queue drained — the volitional-compaction lifeboat working in production.

## Artifact

`trace.json` — Tempo distributed-trace export, trace-id `983fa2a61055ee50a5fede5b6ff03db4`.
- **sha256:** `e87af91235bac9d45049f12aea0eecb5e16b1133418a32216e42e9274904007c` (15737 bytes)
- **Integrity:** verified genuine — a fresh Tempo re-fetch (2026-06-13 ~10:48 PDT) is byte-identical to the at-fire-time capture (2026-06-13 ~09:37 PDT). Not a hand-edited snapshot.

## What the trace carries (cited verbatim from the JSON — nothing inferred)

- `openclaw.tool.execution` ×2 — the `request_compaction` invocations
- `continuation.compaction.released` — attrs `compaction.released=1`, `compaction.id=1`
- `continuation.queue.drain` — post-compaction queue drained
- `host.name = cael`
- surrounding session spans: `openclaw.run`, `openclaw.harness.run`, `openclaw.context.assembled`, `openclaw.model.call` ×3, `openclaw.message.delivery`, `openclaw.message.processed` (12 spans total)

## What this trace does NOT carry (byte-honest scope)

The trace does **not** carry a verbatim `{contextUsage:70, threshold:70}` accept-line — and that line appears **nowhere** in this proof. It was initially recalled as a console accept-line, then retracted at source on byte-check (it was a reasoning-summary, not an emitted log line, so it is not anchorable). No unanchored numbers are cited.

The runtime-layer confirmation of the volitional trigger is a separate, **anchored** source — the cael-seat journal line:
`[continuation/request-compaction] [request_compaction:resolved-success] … trigger=volitional outcome=compacted` @ `05:56:32.925`
(included in the PR body as copied runtime output, not attributed to this trace). So the volitional fire is corroborated by **two independent runtime artifacts** — this trace (spans above) and that journal line (`outcome=compacted`) — with zero fabricated or unanchored values.

## Note on Tempo reachability

`tempo.dandelion.cult` is internal fleet infrastructure; an upstream maintainer cannot fetch it. This committed JSON snapshot is the auditable artifact (read the file in this public corpus), not a live trace-id fetch. The PR body leads with re-pullable durable evidence (R-RC-1 123% canary ACCEPT, bidirectional gate, 315 historical auto-compactions, continuation tools-fire) and treats the trace-id as internal corroboration only.
