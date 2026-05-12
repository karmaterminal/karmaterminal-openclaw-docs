# Methodology — PROOFS/6db118a2/

## Goal

Demonstrate at byte on a real production-shape openclaw runtime that the continuation feature (continue_work + continue_delegate + request_compaction) stitches multi-span OTel traces across the delegate-spawn boundary without requiring the calling agent to pass an explicit `traceparent`.

## Setup

1. **Settled SHA**: `6db118a2441052e8325b67e2c9b17f7fc6acf419` on branch `frond-scribe-claude/20260512/outcomes-consolidated-presquash-v5`.
2. **Pre-squash discipline**: SHA is a single karmafeast-authored feat-commit squash. All lane-cumulative fixes folded; no follow-up commits ahead.
3. **Fleet-CI green**: `pnpm tsgo` against branch ref = run `25756422606` completed success at 19:15:19Z.
4. **Deploy**: `deploy-gateway.yml` workflow_dispatch with `target_prince=silas`, `ref=6db118a2441052e8325b67e2c9b17f7fc6acf419`, `bypass_validation=true` (justified: continuation-feature lineage, not a v2026.5.7-tag ancestor by design). Run `25756854859` completed success at 19:25:17Z.
5. **Post-deploy byte-confirm**: `openclaw --version` on silas-seat = `OpenClaw 2026.5.12-beta.1 (6db118a)`; gateway restart etime `00:00`.
6. **Config**: silas-seat has `agents.defaults.continuation.crossSessionTargeting: enabled` per fleet canon `1503806085`.

## Live-fire driver

From a real silas-seat openclaw session, the model invoked:

```
continue_delegate(
  task="trace-validate: spawn a subagent that fires its OWN continue_delegate to produce a depth-3 trace tree (root → child → grandchild). subagent should fire continue_delegate(task=\"trace-validate-leaf\") then return.",
  mode="normal"
)
```

**Critical**: no `traceparent` parameter was passed. The tool implementation derives parent context from the active openclaw runtime span via `formatActiveContinuationTraceparent()` (exported from `extensions/diagnostics-otel/src/continuation-tracer-adapter.ts`, wired at `src/agents/tools/continue-work-tool.ts:76` and `src/agents/tools/continue-delegate-tool.ts:196`).

## Validation

- **Capture**: tool returned with chain-tracking metadata; trace_id `e50d3a8bb49f81bf71692041361009e7` recovered from session jsonl + traceparent serialization at tool surface.
- **Query**: `curl http://tempo.dandelion.cult/api/traces/e50d3a8bb49f81bf71692041361009e7`.
- **Assertions**:
  - ≥ 3 `openclaw.run` spans present (root + child + grandchild via continuation chain) — ACTUAL: 3 ✓
  - ≥ 2 `continuation.delegate.dispatch` spans present (each delegate hop produces one) — ACTUAL: 2 ✓
  - Parent-chain valid: child openclaw.run's parent_span_id resolves to a continuation.delegate.dispatch span — ACTUAL: confirmed for both RUN-2 and RUN-3 ✓
  - No orphan spans except root — ACTUAL: 23/24 properly parented, 1 root by definition ✓
  - Span-namespace scope: only `openclaw.*` + `continuation.delegate.dispatch` (no `http.`, `messaging.`, `rpc.`, `db.`, `net.` per OTel semconv) — ACTUAL: confirmed ✓

## Reproducibility

Anyone with access to `tempo.dandelion.cult` can re-query trace `e50d3a8bb49f81bf71692041361009e7` to verify the same span tree. Raw Tempo response banked at `artifacts/tempo-trace-e50d3a8b.json`.

Anyone running the same SHA on a fresh openclaw deploy can re-fire the live-fire driver to produce a fresh trace and observe the same architectural shape. Each fresh fire produces a distinct trace_id; the architecture remains the same.

## Independent validation (cross-trace)

Prior live-fire on lane-cumulative `ac17e0d7b6` from ronan-seat (deployed via `deploy-gateway.yml` run `25756923360` bypass-fire) produced Tempo trace `8fe88c8abccd5a0d908f2747687f5e88` with 38 spans across 4 generations. Same architectural shape; same span namespaces; same parent-chain stitched. Two independent live-fires on two distinct binaries (`ac17e0d7` lane-cumulative and `6db118a2` squashed-rebased) both produce stitched multi-span trees. The architecture's correctness is independent of the specific squash-shape.
