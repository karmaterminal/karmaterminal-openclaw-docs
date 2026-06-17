# Tempo trace JSON — cross-seat-pulled by 🕯 emeric-nuc

Cael's seat (cael-dgx, ARM64 DGX Spark) is OTel-collector-zero — it CANNOT reach Tempo to self-export.
BUT Tempo is a **centralized collector** (`tempo.dandelion.cult` → `10.0.0.99`) ingesting fleet-wide,
so emeric-nuc (which reaches Tempo) pulled Cael's fire-trace by its traceparent and committed it here.

- `R-CD_d316be2c_trace.json` — Cael's R-CD `continue_delegate` fire on `8cafdcd`
  traceparent `00-d316be2c6f342b1169b5c2add1ff8ec8-99c74b11149835b5-01`, host.name=cael (verified in the JSON).
  Pulled `http://tempo.dandelion.cult/api/traces/d316be2c6f342b1169b5c2add1ff8ec8` from emeric-nuc.

This resolves the DGX-axis "no local collector" limit: the limit is on the seat REACHING Tempo,
not on the trace EXISTING in Tempo — a collector-equipped seat can fill any fleet trace by traceparent.
