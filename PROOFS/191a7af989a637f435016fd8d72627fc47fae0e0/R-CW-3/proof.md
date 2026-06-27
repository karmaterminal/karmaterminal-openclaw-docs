# R-CW-3 — continue_work reason-field OTel cross-walk (emeric-nuc per-seat)

**Owner:** 🩸 Cael (canonical) + 🕯 Emeric (per-seat cross-walk)  
**Target SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0` (deployed emeric-nuc, OpenClaw 2026.6.10 (`191a7af`))  
**Status:** ✅ PASS (tool-form cross-walk proven)  
**Seat:** emeric-nuc (i7-12700H Alder-Lake, CachyOS, x86_64)

## Scenario

Verify the `reason` parameter passed to `continue_work()` is captured as the `reason.preview` attribute on the emitted `continuation.work` span, and that the returned W3C traceparent resolves to a Tempo trace for the live deployed assembly.

## Fire

Fired from emeric-main-session on deployed `191a7af989a637f435016fd8d72627fc47fae0e0`:

```text
continue_work(
  delaySeconds=5,
  reason="R-CW-3-TOOLFORM-EMERIC-191a7af989: continue_work tool-form fire for reason-field OTel proof on deployed assembly; capture reason.preview on continuation.work span."
)
→ traceparent 00-4bf92f3577b34da6a3ce929d0e0e4736-840f98f12dde3900-01
```

## Observed

Tempo trace fetched HTTP 200 from `http://tempo.dandelion.cult/api/traces/4bf92f3577b34da6a3ce929d0e0e4736` and saved as `emeric-nuc-trace-toolform.json`.

Decoded `continuation.work` span attributes include:

```text
reason.preview = "R-CW-3-TOOLFORM-EMERIC-191a7af989: continue_work tool-form fire for reason-field"
chain.step.remaining = 199
delay.ms = 5000
```

The trace also contained an older pending continuation span in the same trace (`Check PR #1232...`, delay 300000); the proof row is the span with the distinctive `R-CW-3-TOOLFORM-EMERIC-191a7af989` marker.

## Verdict

✅ **PASS** — the `continue_work()` tool-form reason is OTel-observable on `continuation.work.reason.preview` on the deployed `191a7af989a637f435016fd8d72627fc47fae0e0` runtime, and the returned traceparent resolves in Tempo. The required machine-readable Tempo JSON is present in this row.

## Artifacts

- `emeric-nuc-trace-toolform.json` — full Tempo trace JSON for trace `4bf92f3577b34da6a3ce929d0e0e4736`.
