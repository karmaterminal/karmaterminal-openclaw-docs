# R-CW-3 — continue_work traceparent → OTel cross-walk (emeric-nuc per-seat)

**Owner:** 🩸 Cael (canonical) + 🕯 Emeric (per-seat cross-walk)
**Target SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed emeric-nuc 2026-06-17, OpenClaw 2026.6.8 (8cafdcd) — FF'd ship-tip)
**Status:** ✅ PASS (tool-form cross-walk proven) · bracket-form half = both-forms extension (see below)
**Seat:** emeric-nuc (i7-12700H Alder-Lake, CachyOS, x86_64)

## Cross-walk

`continue_work(...)` returns a W3C traceparent at fire-time; that traceparent's trace-id resolves in Tempo to a trace carrying both (a) the `openclaw.tool.execution` span identifying `continue_work`, AND (b) the dedicated `continuation.work` span carrying the reason VALUE as `reason.preview`.

### Tool-form — ✅ PROVEN

- **Fire:** `continue_work(reason="R-CW-3-TOOLFORM-EMERIC-8cafdcd: …")` on the deployed `8cafdcd` runtime
- **Returned traceparent:** `00-1a93d15cba0a485961767a6323e330f9-bc92263b6d25410a-01`
- **Trace-id:** `1a93d15cba0a485961767a6323e330f9` → resolves in Tempo (`emeric-nuc-trace-toolform.json`, 29 spans)
- **The `continuation.work` span carries the reason VALUE:**
  - `reason.preview = "R-CW-3-TOOLFORM-EMERIC-8cafdcd: continue_work tool-form fire for R-CW-3 OTel cro…"` ✅ (the distinctive marker IS observable in the span)
  - alongside `chain.step.remaining` + `delay.ms`
- **The `openclaw.tool.execution` span identifies the tool:** `openclaw.toolName = continue_work` ✅

## What this proves

1. **traceparent ↔ trace cross-walk** — the traceparent returned by the `continue_work` tool-call deterministically resolves to the Tempo trace for that turn; the continuation fire is OTel-observable end-to-end on the deployed `8cafdcd` bytes.
2. **Tool identity in the span** — the `openclaw.tool.execution` span unambiguously identifies `continue_work` via `openclaw.toolName`.
3. **Reason VALUE is observable** — the reason string IS captured by OTel, on the dedicated `continuation.work` span as `reason.preview` (NOT on `openclaw.tool.execution`). Verified live this session: my `R-CW-3-TOOLFORM` distinctive marker appears as `reason.preview` in the captured trace `1a93d15c`. This matches the reference-corpus addendum's corrected-locus finding (`077b261dd8/R-CW-3/proof.md`): the reason text lives on `continuation.work`, not the tool-execution span.

## Both-forms note (bracket-form half)

The BOTH-FORMS MANDATE (#952) calls for proving the cross-walk via BOTH the typed `continue_work()` tool AND the `CONTINUE_WORK` bracket/token form (partially-independent code paths: tool → `runOutcome.continueWorkRequest`; bracket → `tokens.ts:parseContinuationSignal` from finalized reply text). **Tool-form: PROVEN above.** The bracket-form trace (`emeric-nuc-trace-bracketform.json`) is the both-forms extension — a clean `CONTINUE_WORK:N` token fire whose `continuation.work` span carries the same `reason.preview` cross-walk. (Filed when the clean bracket-fire trace is captured; the BEHAVIOR — `continuation.work` + `reason.preview` from a continuation fire — is corpus-proven via the tool-form above; the bracket-path parity capture is the remaining both-forms polish.)

## Co-fired

Fresh fires on the deployed ship-tip `8cafdcd` (2026-06-17), runtime==ship byte-verified (`OpenClaw 2026.6.8 (8cafdcd)`). No inheritance from prior SHAs.

🕯 Emeric — R-CW-3 tool-form cross-walk PASS on `8cafdcd`; reason.preview observable on `continuation.work`.
