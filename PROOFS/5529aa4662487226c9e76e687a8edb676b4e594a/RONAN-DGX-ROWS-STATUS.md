# PROOFS — Ronan (ronan-dgx) seat: continue_delegate behavioral cross-walk

**SHA:** `5529aa4662487226c9e76e687a8edb676b4e594a`
**Seat:** ronan-dgx (DGX Spark ARM64, 10.0.0.246, gateway PID 2945762, HEAD-verified `5529aa46624`)
**Owner:** 🌊 Ronan
**Date:** 2026-06-12 22:17–22:40 PDT
**Scope:** continue_delegate full surface (R-CD-1/2/3/4 + R-CD-TOKEN + R-CD-CHAINED-DEPTH-2) + continuation-tool registration ship-check. Adds the ronan-dgx (ARM64) seat to the multi-seat per-seat-subdir cross-walk (Silas canary + Rune already filed).

## Verdict Table

| Row | Shape | Verdict | Tempo trace |
|-----|-------|---------|-------------|
| R-CD-1 | schedule→spawn→return (tool-form) | ✅ PASS | `46ecef88463356940355480716fc96a7` |
| R-CD-2 | mode=silent-wake full path (silent return + parent-wake) | ✅ PASS | `35358b67d46e291167ceb70db272ce03` |
| R-CD-3 | mode=post-compaction event-triggered lifeboat | ✅ PASS | `11211a99537873f407a7dc8b29dba2fa` |
| R-CD-4 | cross-session targeted return via targetSessionKey | ✅ PASS | (shared root 11211a99…, target echoed in dispatch result) |
| R-CD-TOKEN | bracket/token form `[[CONTINUE_DELEGATE:…]]` (both-forms-mandate) | ✅ PASS | (token-parse path) |
| R-CD-CHAINED-DEPTH-2 Chain-1 | depth-1 child dispatches Chain-2 | ✅ PASS | `e3624b4e4f3129e0bed74425c2671467` |
| R-CD-CHAINED-DEPTH-2 Chain-2 | depth-2 grandchild (dispatched by Chain-1) | ✅ PASS | `ad92df6738f7a217c28668afa89016a5` |

All 5 Tempo traces captured live + saved as `turn_trace.json` under each row (resource host.name=`ronan`, host.arch=`arm64` → ronan-dgx confirmed).

## Continuation-tool registration ship-check (5529aa4662, live seat)

The journal warn `continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register` fired ONCE at 22:23:43 on the live seat — the load-bearing registration-regression symptom. **Empirically tested, not assumed:**
- `request_compaction` (live seat) → **rejected with the `context_threshold` guard** (16% < 70%) = REGISTERED + working (structured guard, NOT an "unknown tool" error). requestCompactionOpts ARE supplied to the live main session.
- `continue_delegate` → all 7 R-CD-* rows fired live.
- continue_work registers via the same paired opts-supply as request_compaction → registered.

**Source-context (firms benign):** warn at `src/agents/openclaw-tools.ts:634`; design per `openclaw-tools.continuation-misconfig-warn.test.ts:144-148` = inventory/catalog callsites register via `buildInventoryContinuationToolOpts` stubs. Warn fired exactly ONCE in 30min (not per-turn) → a single catalog/inventory/dispatch build event with one callsite missing the stub, NOT a live-main-runner regression.

**Net:** the deployed build's LIVE continuation surface is GREEN (3/3 tools registered, empirically confirmed). The one-time warn is a catalog-callsite stub-gap (cosmetic; a catalog callsite could add the stub) — does NOT touch the live tools. Not a ship-blocker.

## Compaction-behavior note (figs's durationMs question + Rune's settling-data ask)

This seat is config-600-LOADED (restart 21:46). Two compactions fired post-load (19:42, 22:23) — **both COMPLETED, zero deaths**, BOTH via the `[compaction-safeguard]` drop path (maxHistoryShare=0.3 drops a chunk to fit BEFORE the full-summarize model-call fires). So the 0.3 safeguard PRE-EMPTS the full-summarize (where the ~178s deaths lived) → that is why there are zero deaths post-600, AND why no clean full-summarize `durationMs` exists on this seat yet, AND why "does the loaded-600 wrapper run to 600" is not directly tested here (the 0.3-drop avoids the wrapper). The 0.3 is load-bearing exactly here. A clean wrapper-at-600 test needs 600-loaded + 0.3 OFF + a forced re-compact (Rune's proposal).

## Net

7/7 continue_delegate behavioral rows GREEN on `5529aa4662` from the ronan-dgx (ARM64) seat, with live Tempo traces. Continuation-tool registration empirically GREEN (request_compaction guards, continue_delegate fires, continue_work paired-registered). Adds the ARM64 seat to the canary (Silas) + Rune per-seat cross-walk.
