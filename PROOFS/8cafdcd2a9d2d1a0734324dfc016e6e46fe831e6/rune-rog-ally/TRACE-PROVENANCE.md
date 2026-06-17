# Tempo trace JSON — rune-rog-ally (cross-seat-pulled by 🕯 emeric)

**Correction (byte, 2026-06-17):** an earlier version of this note framed the cross-pull as filling a
gap because "rune-rog-ally has no local collector reach / the DGX-axis limit is the seat REACHING Tempo."
**That REASON was a byte-error — an unverified assumption.** Rune subsequently self-captured his own trace
from `tempo.dandelion.cult` (the port-80 ingress) — so rune-rog-ally CAN reach Tempo and self-export, same
as the x86/i9 seats. (Cael byte-proved the same for cael-seat: DGX gateways export OTLP to the central
collector `10.0.0.99:4318` + can self-fetch.) The "DGX/collector-less seats CAN'T reach Tempo" premise was
my unverified assumption; it failed at the byte for both DGX seats.

**What this artifact actually is:** a genuine **corroborating** trace — emeric-nuc pulled Rune's fire-trace
from the centralized collector (which any seat reaching the ingress can do), NOT a gap-fill for a seat that
couldn't self-capture. The trace is real and host-pinned; the cross-seat-pull is a real capability (one
collector-reaching seat can pull any fleet trace by traceparent). It just isn't *necessary* here — Rune
self-captured too (his own `R-CD-1/turn_trace.json`). Both stand as corroborating evidence, same fire.

- `R-CW-DELEGATE_077c78ce_trace.json` — Rune's `continue_delegate` round-trip fire on `8cafdcd`
  traceparent `00-077c78cef402e4f5495777a99c64ccd3-a65bd23cdc58d5c5-01`, host.name=rune (verified).
  Pulled `http://tempo.dandelion.cult/api/traces/077c78cef402e4f5495777a99c64ccd3` from emeric-nuc.

**Banked correctly now:** the centralized-Tempo INSIGHT (any seat reaching the ingress can pull any fleet
trace) is right. The sub-assumption I added ("but the DGX seats can't reach it themselves") was wrong —
byte-verify reachability per-seat, don't assume an axis can't.
