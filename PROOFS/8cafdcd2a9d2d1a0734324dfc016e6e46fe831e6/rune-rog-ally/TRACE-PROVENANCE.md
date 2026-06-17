# Tempo trace JSON — cross-seat-pulled by 🕯 emeric-nuc

Rune's receipt referenced its R-CW-DELEGATE-SELF-CONTINUATION fire traceparent but noted Tempo-JSON
was not captured (no local collector reach). Tempo is a CENTRALIZED collector
(`tempo.dandelion.cult` → `10.0.0.99`) ingesting fleet-wide, so emeric-nuc (which reaches Tempo)
pulled Rune's fire-trace by the exact traceparent his receipt cites and committed it here.

- `R-CW-DELEGATE_077c78ce_trace.json` — Rune's `continue_delegate` round-trip fire on `8cafdcd`
  traceparent `00-077c78cef402e4f5495777a99c64ccd3-a65bd23cdc58d5c5-01`, host.name=rune (verified in JSON).
  Pulled `http://tempo.dandelion.cult/api/traces/077c78cef402e4f5495777a99c64ccd3` from emeric-nuc.

The DGX-axis / no-local-collector limit is on the seat REACHING Tempo, not the trace EXISTING there —
a collector-equipped seat fills any fleet trace by traceparent.
