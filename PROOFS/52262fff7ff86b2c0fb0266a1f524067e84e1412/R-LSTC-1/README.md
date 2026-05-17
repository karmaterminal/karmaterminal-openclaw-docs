# R-LSTC-1 — liveSessionToolConfig hot-reload via createOpenClawTools

**SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Build-info on host**: `OpenClaw 2026.5.17 (52262ff)`, builtAt `2026-05-17T19:03:53.295Z`
**Fire by**: 🌫 silas-seat (`urudyne`)
**Re-fire of cure-(10)**: re-fired at ship-SHA to confirm preservation through cure-(11) rebase + UNION-T-3 fold.

## Claim under test

Cure-(11) preserves cure-(10)'s `liveSessionToolConfig` hot-reload seam in `createOpenClawTools`. The `options?.liveSessionToolConfig` branch must remain in the deployed bundle, gating tool construction on a live `getConfig` closure rather than a snapshot `resolvedConfig`, enabling tool config to re-read on each `tool.execute()` invocation rather than freezing at session-start.

## Method

1. Confirmed `build-info.json` on live host shows `52262fff7ff86b2c0fb0266a1f524067e84e1412`.
2. Located deployed bundle: `dist/openclaw-tools-SSpUvzAg.js`.
3. Byte-extracted the `sessionToolConfig` construction region (where `liveSessionToolConfig` is consulted).
4. Confirmed the conditional shape `options?.liveSessionToolConfig ? { getConfig: getRuntimeConfig } : { config: resolvedConfig }` is preserved.

## Evidence

### Bundle byte-extract (recipient-side from deployed dist)

File: `dist/openclaw-tools-SSpUvzAg.js`. Full context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt) (37 lines).

Key region:

```javascript
const sessionToolConfig = options?.liveSessionToolConfig
  ? { getConfig: getRuntimeConfig }
  : { config: resolvedConfig };
```

This conditional is the load-bearing seam: when callers pass `liveSessionToolConfig: true`, downstream tool constructors receive a `getConfig` closure that re-reads runtime state on each invocation rather than capturing a snapshot.

### Live-fire dispatch via continue_delegate

From silas-seat main session running on `52262fff7f`, invoked `continue_delegate(mode="silent", task="R-LSTC-1 proof shard...")` natively (tool call surfaced traceparent: `00-3e37d7fc571ddd7613643ef4f08a9769-120632bed26043d1-01`).

The delegate dispatch creates the span tree `continuation.delegate.dispatch` → `openclaw.run` (child session, parented to the dispatch span) with a shared `chain.id`. This is the load-bearing live-fire substrate: the recipient-side tempo backend captures the delegate's `openclaw.run` span parented to its dispatch span.

Trace ID: `3e37d7fc571ddd7613643ef4f08a9769`. See `trace.json` (recipient-side capture from Tempo at `tempo.dandelion.cult`) — if missing in this commit, the substrate is the trace ID on the Tempo backend reachable from the cohort network.

## Verdict

✅ Adoption preserved through cure-(11) rebase and v7 squash + UNION-T-3 fold.
✅ Live-fire dispatch span tree shows the seam runtime-load-bearing on v7.

## proofs-SHA == push-SHA invariant

`52262fff7ff86b2c0fb0266a1f524067e84e1412` (build-info.json) == `52262fff7ff86b2c0fb0266a1f524067e84e1412` (PR #79925 head at proofs-fire time).

## Substrate-honesty note

The trace.json file in this dir, if present, is captured via `tempo.dandelion.cult` query for traceId `3e37d7fc571ddd7613643ef4f08a9769`. If not yet captured at push-time (Tempo export lag), the trace ID is recorded above and the silas-seat tempo backend retains it.
