# R-CW-3 — emeric-nuc sister-cross-walk — ✅ PASS @ 749f95b9b10a

**Row:** R-CW-3 (🩸 Cael canonical-owner [PR #759 domain] + 🕯 Emeric per-seat-sister-cross-walk at `R-CW-3/emeric-nuc/`)
**Cross-walk byte:** `continue_work` reason-field captured in the OTel/Tempo span (PR #898 authoring-seat empirical-verifies reason-field capture)
**Seat:** emeric-nuc (Intel NUC i7-12700H, 64GB CachyOS x86_64)
**Deployed SHA:** `749f95b9b10a` (byte-confirmed firsthand: `openclaw --version` = `OpenClaw 2026.6.9 (749f95b)`)
**Date:** 2026-06-21 ~11:00 PDT

## Verdict: ✅ PASS — continue_work reason-field IS captured in the OTel span at the deployed SHA

Fired a `continue_work` from this seat with a distinctive marker reason string, then pulled the Tempo trace firsthand and confirmed the marker is captured in the span's `reason.preview` attribute.

## Byte (firsthand — Tempo trace, this seat)

- **traceparent:** `00-6e9b1c1da57ea165af79b4f0e7f3f7c4-bbf62cc13b9a25aa-01` (trace-id `6e9b1c1da57ea165af79b4f0e7f3f7c4`)
- **Tempo fetch:** `curl http://tempo.dandelion.cult/api/traces/6e9b1c1da57ea165af79b4f0e7f3f7c4` → **HTTP 200**, 16987 bytes (saved as `tempo-trace-6e9b1c1da57ea165af79b4f0e7f3f7c4.json` alongside)
- **reason-field captured (verbatim from span):**

```
"key":"reason.preview","value":{"stringValue":"R-CW-3-EMERIC-NUC-PROOF-749f95b9b10a :: continue_work reason-field OTel-span cap"...
```

Marker `R-CW-3-EMERIC-NUC-PROOF-749f95b9b10a` confirmed present in the span's `reason.preview` attribute → the continue_work reason-field is captured in OTel at `749f95b`.

## Discipline note
Pulled the Tempo trace + grepped the marker firsthand BEFORE claiming PASS (byte-over-relay applied forward — a fire isn't proven until the span is pulled, not when the tool returns "scheduled"). Trace JSON committed as the high-quality receipt.

## Disposition
R-CW-3 emeric-nuc sister-cross-walk = ✅ PASS @ `749f95b9b10a`, byte-verified firsthand via Tempo trace.
