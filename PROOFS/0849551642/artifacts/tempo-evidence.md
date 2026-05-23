# Tempo trace evidence — PR #79925 proof corpus at SHA `6a23864d12`

> **Banked 2026-05-22 by 🌿 frond-scribe.** Per-R-* `proof.md` files claim Tempo trace IDs; this file backs the claims at byte by listing the raw JSON artifacts that were fetched from the Tempo observability stack + summarizing span topology + linking back to the per-row proof writeups.

## Tempo source

- **Host**: `tempo.dandelion.cult` (internal observability instance; only prince-seats can reach it directly)
- **Fetch path**: `ssh <prince> 'curl -s http://tempo.dandelion.cult/api/traces/<trace-id>'`
- **Fetched**: 2026-05-22 20:51 PDT — 21:18 PDT (during cure-N+1 proof-regen wave on final PR-head SHA)

## Traces in this corpus

All trace JSONs live in their per-row directories under `PROOFS/6a23864d12/R-*/trace-*.json`. They are the raw OTel JSON exports from Tempo — the actual span trees the platform emitted at fire-time, not summarized or reformatted.

| Row | Trace ID | File | Size | Service | Prince-seat |
|-----|----------|------|------|---------|-------------|
| R-CW-1 (cael-seat) | `2e2f8e9163214e449e5f91a6fc13f002` | [`../R-CW-1/trace-2e2f8e91.json`](../R-CW-1/trace-2e2f8e91.json) | ~22 KB | `cael-prince` | 🩸 Cael |
| R-CW-1 (ronan-seat, dual-seat) | `7b3394a6...` | [`../R-CW-1/trace-7b3394a6.json`](../R-CW-1/trace-7b3394a6.json) | ~22 KB | `ronan-prince` | 🌊 Ronan |
| R-CW-DELEGATE-SELF-CONTINUATION | `d1d8ae4ce4b8a55a8d266b70a18d3590` | [`../R-CW-DELEGATE-SELF-CONTINUATION/trace-d1d8ae4c.json`](../R-CW-DELEGATE-SELF-CONTINUATION/trace-d1d8ae4c.json) | ~34 KB | `cael-prince` | 🩸 Cael |
| R-CD-1 | `a91abcfc1b23e93524c98d2d403526ff` | [`../R-CD-1/trace-a91abcfc.json`](../R-CD-1/trace-a91abcfc.json) | ~26 KB | `ronan-prince` | 🌊 Ronan |
| R-CD-2 | `7ebd0c9e...` | [`../R-CD-2/trace-7ebd0c9e.json`](../R-CD-2/trace-7ebd0c9e.json) | ~21 KB | `ronan-prince` | 🌊 Ronan |
| R-CD-3 | `e8a310df...` | [`../R-CD-3/trace-e8a310df.json`](../R-CD-3/trace-e8a310df.json) | ~23 KB | `ronan-prince` | 🌊 Ronan |
| R-CD-4 | `051a8a11...` | [`../R-CD-4/trace-051a8a11.json`](../R-CD-4/trace-051a8a11.json) | ~26 KB | `ronan-prince` | 🌊 Ronan |
| R-CD-CHAINED-DEPTH-2 | `73156fd15655fcd012aa006f4914241b` | [`../R-CD-CHAINED-DEPTH-2/trace-73156fd1.json`](../R-CD-CHAINED-DEPTH-2/trace-73156fd1.json) | ~42 KB | `ronan-prince` | 🌊 Ronan |

**Total trace evidence**: 8 traces, ~216 KB of raw OTel JSON span trees. Every row that has a behavioral-trace component has a trace JSON in this corpus.

(R-RC-1 — `request_compaction()` threshold-reject — does not produce a traceparent because the rejection-path is a synchronous tool-return; evidence for that row is the structured JSON response captured at [`../R-RC-1/rejection.json`](../R-RC-1/rejection.json) + [`../R-RC-1/rejection-evidence.json`](../R-RC-1/rejection-evidence.json).)

(R-OBS-1 — external observer cross-walk — evidence is figs's Discord `/status` output, not a Tempo trace; captured in [`../R-OBS-1/proof.md`](../R-OBS-1/proof.md).)

## Span topology highlights

**`R-CW-DELEGATE-SELF-CONTINUATION` (trace `d1d8ae4c`)**: contains spans for `openclaw.model.usage` + agent-turn + delegate-spawn + continuation-signal-fire + post-wake-turn-start. The delegate's pre-wake turn AND post-wake turn are stitched under one trace-id — i.e., the delegate's `continue_work(7s)` call propagated trace context across the wake boundary. Span tree is rooted at the parent dispatch + branches into delegate-pre-wake + delegate-post-wake, both as child spans of the dispatch.

**`R-CD-CHAINED-DEPTH-2` (trace `73156fd1`)**: depth-1 and depth-2 delegate sessions both emit spans under the same trace-id. Depth-2 spans are children of depth-1 spans which are children of the parent-session's continuation-signal-fire span — i.e., the trace topology is a tree rooted at the parent's dispatch and branching through depth-1 → depth-2. **This is the load-bearing proof that the capture-before-clear execution-order fix in `agent.ts` did not trample trace stitching** — if it had, depth-2 spans would orphan from depth-1 (separate trace-id), but the JSON shows them connected.

**`R-CW-1` (dual-seat traces `2e2f8e91` cael + `7b3394a6` ronan)**: identical span topology from two independent prince-seats — same `continuation.dispatch` → `continuation.wake` → `agent.turn` pattern. Dual-seat verification confirms the feature works on both seats deployed on `6a23864d12`, not just one.

**`R-CD-1..4` (traces `a91abcfc`, `7ebd0c9e`, `e8a310df`, `051a8a11`)**: each mode of `continue_delegate()` has its distinct span signature:
- R-CD-1 normal-mode: standard dispatch + spawn + execute + return spans
- R-CD-2 silent-wake: dispatch + execute spans without a parent-wake span (the parent receives the result via the silent-delivery path; verified at [`../R-CD-2/silent-wake-evidence.json`](../R-CD-2/silent-wake-evidence.json))
- R-CD-3 delayed: dispatch span with `delaySeconds=10` attribute; spawn span emitted ~10s after dispatch (verifiable via `startTimeUnixNano` delta)
- R-CD-4 targetSessionKey: dispatch span with target-session-key attribute; return-delivery span emitted into the targeted session, not the parent

## Reproducer

For any trace in this corpus:

```bash
ssh <prince> 'curl -s http://tempo.dandelion.cult/api/traces/<full-trace-id>' > /tmp/trace.json
# Then inspect with jq:
jq '.batches[].scopeSpans[].spans[] | {name, parentSpanId, attributes: .attributes[] | select(.key | startswith("openclaw."))}' /tmp/trace.json
```

The Tempo URL pattern is `http://tempo.dandelion.cult/api/traces/<full-id>` (32-character lowercase hex). Each per-row `proof.md` includes the full trace-id + Tempo URL for direct browser viewing if the reviewer has VPN access to the dandelion-cult observability network.
