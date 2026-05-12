# PROOFS for PR #79925 — SHA `6db118a2441052e8325b67e2c9b17f7fc6acf419` (X''''''-prime)

## Summary

X''''''-prime is the canonical-rebase + lane-complete continuation feature shipping to upstream `openclaw/openclaw#79925`. This corpus documents live-fire validation on a real prince host with the deployed binary built from this exact SHA.

**SHA**: `6db118a2441052e8325b67e2c9b17f7fc6acf419`
**Branch**: `frond-scribe-claude/20260512/outcomes-consolidated-presquash-v5`
**Base**: `da7f9a62676ced24aa78f3ee0180669f67d3e4e3` (karmaterminal `origin/main`; ancestor of `openclaw/main`; 3-dot PR-diff = 312 files / +38511 / -1110 — feature-only)
**Fleet-CI**: run `25756422606` ✓ completed success at 2026-05-12T19:15:19Z
**Local gates**: `tsgo:core` ✓ `tsgo:test` ✓ (incremental cache from prior canonical-rebase runs)

## Verdicts

| Property                          | Verdict | Evidence                                                        |
|-----------------------------------|---------|-----------------------------------------------------------------|
| Multi-span trace stitching        | ✅      | `multi-span-tempo-evidence.md` — 24 spans, depth-3, no orphan-except-root |
| Auto-pickup (no explicit traceparent) | ✅  | Live-fire fired without `traceparent` param; depth-N chain stitched |
| Span-namespace scope discipline   | ✅      | Only `openclaw.*` + `continuation.delegate.dispatch` spans emitted at runtime |
| Continuation tool wiring          | ✅      | `continue-work-tool.ts:76` → `formatActiveContinuationTraceparent()` (event-carried, not OTel SDK `getActiveSpan()`) |
| crossSessionTargeting gate works  | ✅      | RFC §5.3; gate enforces at tool validation + TaskFlow dispatch + post-compaction release + bracket-syntax spawn |

## Methodology

See `METHOD.md` for the live-fire substrate + Tempo-query methodology.

## Files

- `METHOD.md` — methodology + reproducibility
- `continuation-live-fire.md` — single live-fire on settled SHA: trace_id, journal byte excerpts, depth-3 chain
- `multi-span-tempo-evidence.md` — Tempo trace dump + parent-chain validation
- `crossSessionTargeting-behavioral-matrix.md` — gate state evidence (disabled-default + enabled paths, fanoutMode variants)
- `artifacts/` — raw substrate dumps (Tempo JSON, journal excerpts)

## Cure-arc lineage

This SHA folds 14 iterations of carrier-cure work driven through copilot lane `frond-scribe-copilot/20260512/otel-event-carried-tracecontext-fix` ending at `ac17e0d7b6` ("honor remote traceparents in otel parenting"). Prior live-fire on `ac17e0d7` independently validated multi-span stitching at Tempo trace `8fe88c8abccd5a0d908f2747687f5e88` (38 spans, 4-generation chain) from ronan-seat (per `1503827917`). This corpus validates the same architecture on the squashed-and-rebased shipping SHA from silas-seat (Tempo trace `e50d3a8bb49f81bf71692041361009e7`, 24 spans, 3-generation chain).

Two independent seats, two distinct Tempo traces, same architectural shape — auto-pickup multi-span stitching proven at byte on the SHA shipping to PR.
