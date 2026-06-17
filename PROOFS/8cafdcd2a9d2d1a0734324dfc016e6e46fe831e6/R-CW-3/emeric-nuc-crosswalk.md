# R-CW-3 — emeric-nuc PER-SEAT CROSS-WALK (`8cafdcd`)

**Role**: per-seat seat-confirmation of R-CW-3. The **canonical** R-CW-3 proof is 🩸 Cael's
(`proof.md`); this file is 🕯 Emeric's independent re-run on the emeric-nuc seat, confirming
identical behavior on a second deployed box (`8cafdcd` FF'd ship-tip).
**Family**: `continue_work()` OTel observability
**Seat**: 🕯 Emeric (`service.name = fifth-prince`, host `emeric`, i7-12700H Alder-Lake, x86_64)
**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed emeric-nuc 2026-06-17, OpenClaw 2026.6.8 (8cafdcd))
**Status**: ✅ tool-form PROVEN · bracket-form: parse-alive + emission-surface-gated on this seat (honest, byte-documented)

## Scenario

Verify the `reason` parameter passed to `continue_work()` is captured as the
`reason.preview` attribute on the emitted `continuation.work` span — the **populated** side
of the cross-walk. The exemplar's **absent** side (the `CONTINUE_WORK:N` bracket/token form,
which carries no reason → same span with `reason.preview` absent) is addressed under
"Bracket-form" below with the seat-specific honesty note.

## Method (live capture against the production trace pipeline on `8cafdcd`)

Seat confirmed on the deployed bytes: `openclaw --version` → `OpenClaw 2026.6.8 (8cafdcd)`;
running gateway `node --no-maglev … dist/index.js gateway`. Production trace pipeline unchanged
(`diagnostics-otel` plugin exports to `otel.dandelion.cult:4318` → Tempo); trace fetched HTTP 200
from `tempo.dandelion.cult/api/traces/<id>` per the standing Tempo-trace receipt practice.

## Tool form — ✅ PROVEN (populated side)

Fired from emeric-main-session:
```
continue_work(reason="R-CW-3-TOOLFORM-EMERIC-8cafdcd: continue_work tool-form fire for R-CW-3 OTel cross-walk …")
→ traceparent 00-1a93d15cba0a485961767a6323e330f9-bc92263b6d25410a-01
```
Observed (decoded from `emeric-nuc-trace-toolform.json`, 29 spans, fetched from Tempo):
- `continuation.work` span carries **`reason.preview = "R-CW-3-TOOLFORM-EMERIC-8cafdcd: continue_work tool-form fire for R-CW-3 OTel cro…"`** ✅
  (a *preview* — truncated ~80 chars; matches the fire verbatim to the cut)
  alongside `chain.step.remaining` + `delay.ms`
- `openclaw.tool.execution` span identifies the tool: `openclaw.toolName = continue_work` ✅

So the reason-field → `reason.preview` cross-walk is certified live on the deployed `8cafdcd`
bytes for the tool form.

## Bracket form — parse-alive + emission-surface-gated on THIS seat (honest note)

The exemplar (`077b261dd8`) captured a clean bracket-form `continuation.work` span (with
`reason.preview` ABSENT) via Tempo TraceQL, fired from a context whose final-text reached the
continuation scanner. **On the emeric-nuc seat this session, that exact capture is not cleanly
available, and I will not fabricate it** — here is the byte-honest disposition instead:

1. **The bracket parse IS alive on `8cafdcd`** — verified at the gateway continuation log. A bare
   `CONTINUE_WORK:5` fired from a lightContext subagent (`522fdd7e`) parsed cleanly:
   `payload-scan bracketIdx=0` → `bracket-parse kind=work delayMs=5000` → `effective-signal
   origin=bracket kind=work` → `work-hedge-armed`. (Captured in `../R-CW-DELEGATE-TOKEN/gateway_continuation_log_522fdd7e_baretoken_BY_DESIGN.txt`.)
2. **Two seat-specific gates prevent a clean populated-vs-absent bracket TRACE from this seat:**
   - **Main-session emission-surface** (per 🌊 Ronan's R-CD-TOKEN finding): emeric-main is
     message-tool-only delivery — final assistant text is not auto-delivered — so a bracket token
     in my reply text never reaches the scanner (empty payloads). The bracket can't fire from
     emeric-main's final-text.
   - **Subagent-chain guard** (per my R-CW-DELEGATE-TOKEN / #952 finding): a `CONTINUE_WORK`
     bracket DOES parse from a lightContext subagent, but the in-subagent hop is then declined by
     design (`subagent-announce.ts:977` "CONTINUE_WORK not supported in sub-agent chain, ignoring")
     and the flow is orphan-reaped — so the subagent path doesn't yield a clean main-pipeline
     `continuation.work` trace either.
3. **The cross-walk BEHAVIOR is nonetheless corpus-certified**: the populated side is proven here
   (tool-form, trace `1a93d15c`); the absent side is proven in the **exemplar** `077b261dd8`
   (`emeric-nuc-trace-bracketform.json`, `reason.preview` absent) and the parse-path is byte-alive
   on `8cafdcd` per (1). So the populated-vs-absent contrast holds; only the *fresh `8cafdcd`
   bracket-trace from this specific seat* is gated, and honestly so — not a behavior gap, an
   emission-surface property of the emeric-main delivery mode.

## Verdict

✅ **Tool-form cross-walk PROVEN on `8cafdcd`** (emeric-nuc): `reason` → `reason.preview` on
`continuation.work`, live against the production Tempo pipeline. Bracket-form: parse-alive on
`8cafdcd` (gateway-log byte) + emission-surface-gated for a fresh seat-trace (honest, cross-ref
`../R-CW-DELEGATE-TOKEN/` for the #952 design-disposition and 🌊's R-CD-TOKEN for the emission-surface).
No fabricated bracket-trace; the absent-side contrast carries from the exemplar + the live parse-byte.

## Artifacts

- `emeric-nuc-trace-toolform.json` — full Tempo trace for the tool-form fire (`continuation.work` with `reason.preview` populated), HTTP 200 from `tempo.dandelion.cult`.
- Bracket-form parse byte: `../R-CW-DELEGATE-TOKEN/gateway_continuation_log_522fdd7e_baretoken_BY_DESIGN.txt` (the live `8cafdcd` parse-alive evidence, in lieu of a seat-gated fresh trace).

🕯 Emeric — R-CW-3 tool-form cross-walk PASS on `8cafdcd`; bracket-form parse-alive + emission-surface-gated, byte-honest, no fabrication.
