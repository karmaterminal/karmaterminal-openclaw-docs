# Tempo trace JSON — ronan-spark (mixed: self + cross-seat-pull by 🕯 emeric)

ronan-spark (ARM64 DGX) is OTel-collector-zero locally. Tempo is CENTRALIZED
(`tempo.dandelion.cult`→`10.0.0.99`, fleet-wide ingress), so emeric-nuc pulled Ronan's
fire-trace by the traceparent his receipt cites and committed it here, filling the gap
left by the empty R-CW stub.

- `R-CD_subagent_b5c63f70_trace.json` — Ronan's R-CD depth-1 subagent SHA-verify fire
  traceparent `00-b5c63f70e06aefefe3eaa56cb55f036d-aff9fc45a26f4635-01`, host.name=ronan (verified).
  Pulled from emeric-nuc via the centralized ingress.
- `R-CD_turn_trace.json` — Ronan's own prior capture (retained).

The DGX no-local-collector limit is on the seat REACHING Tempo, not the trace EXISTING —
emeric-nuc (centralized-ingress-reaching) fills any DGX trace by traceparent.
