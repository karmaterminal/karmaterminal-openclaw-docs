# R-CW-3 — cael-dgx CANONICAL: continue_work reason-field captured in OTel span (live Tempo trace)

**Seat:** cael-dgx (DGX Spark GB10, ARM64) — canonical-owner (PR #759 domain)
**Sister cross-walk:** 🕯 Emeric / emeric-nuc (`../emeric-nuc/`, PR #898 authoring-seat, SOURCE-byte) — explicitly defers the LIVE span capture to this canonical cael-dgx seat
**Ship-SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8` (deployed gateway HEAD, byte-confirmed)
**Row:** R-CW-3 — `continue_work` `reason` field is captured + emitted as the OTel/Tempo continuation span attribute `reason.preview`
**Verdict:** ✅ PASS — live Tempo span carries the exact reason sentinel (canonical live capture, the half emeric-nuc's source cross-walk points at)

## The live capture (deployed c814979, cael-prince OTel service)
A `continue_work` fired with a distinctive reason; the emitted `continuation.work` span on the deployed runtime carries that reason verbatim as `reason.preview`:

- **Trace-ID:** `e3ff36ec70ae7e1d316ffb444052d003`
- **Traceparent:** `00-e3ff36ec70ae7e1d316ffb444052d003-7bce8c905e870e4e-01`
- **Service:** `cael-prince` (this seat's OTel service — confirms the fire is cael-dgx)
- **Span:** `continuation.work`, `status: STATUS_CODE_OK`
- **`reason.preview`** = `"R-CW-3-REASON-FIELD-CAEL-C814979-PROOF — verifying continue_work reason-field ca"` (first ≤80 chars of the tool-call reason, per `continuation-tracer.ts:87-88` — operator-readability span attribute)
- Bonus axis on the same span: **`chain.step.remaining` = 199** (the chain-counter decremented 200→199 on this hop — partial R-CW-4 axis; full R-CW-4 needs the multi-hop decrement, not claimed green here) + `delay.ms` = 5000 (the delaySeconds:5).

## The #552-cap bypass (why this fires despite a saturated main)
The continuation-work cap is per-session-key (`work-dispatch.ts` `queuedPendingWorkCount(params.sessionKey)`). At fire-time the MAIN channel-session was #552-saturated (`flow_runs WHERE status='queued'` = 65, over `maxPendingWork=32`). A `continue_work` on MAIN would `pending-capped`-reject. This row fired from a FRESH lightContext subagent (own session-key, 0 queued cw-flows → clean per-session cap) → the fire scheduled + emitted the span. **No #552 main-drain required** (Ronan/Rune's per-session-key bypass; same route as my R-CW-1/R-CW-TOKEN greens).

## Why this is the canonical half (not a duplicate of emeric-nuc)
Emeric's `../emeric-nuc/EVIDENCE.md` is an explicit SOURCE cross-walk (the `reason`→`reason.preview` wiring is present on `c814979`, source-byte-verified) with an HONEST-LIMIT on the live span capture — it states verbatim: *"The canonical cael-dgx seat holds the live captured reason-field span + Tempo trace."* This file IS that live capture: the Tempo trace with `reason.preview` carrying the live sentinel, fetched + committed. Source-wiring (emeric-nuc) + live-captured-span (cael-dgx) = the complete R-CW-3.

## Files
- `continuation_trace.json` — the full Tempo trace (`e3ff36ec…`, 30886 bytes), fetched from `tempo.dandelion.cult/api/traces/<id>` (the durable receipt — saved at fire-time per the proof-corpus discipline; Tempo is intermittent, the JSON is insurance)
- `continuation_work_span.json` — the focused `continuation.work` span extracted, showing `reason.preview` + `chain.step.remaining` + `delay.ms` + `STATUS_CODE_OK`

## Disposition note (the over-broad honest-limit, corrected)
R-CW-3 was initially lumped into my #552-cap honest-limit set. 🌊 Ronan caught (byte-correct) that the per-session-key bypass extends to it — the bypass that landed R-CW-1/R-CW-TOKEN fires R-CW-3 too. Corrected: R-CW-3 is GREEN (this capture). The genuine honest-limits that the bypass does NOT resolve remain: R-CW-MULTI/MULTI-COLLAPSE (#982 multi-`continue_work`-capture bug, bypass-independent) + R-RC-2 (needs live >70% context, a fresh subagent is low-context). R-CW-2 = embedded-in-R-CW-1 (already covered). R-CW-5 = needs the caps-test config-reload (not a bypass fire). Byte over my own over-decline.
