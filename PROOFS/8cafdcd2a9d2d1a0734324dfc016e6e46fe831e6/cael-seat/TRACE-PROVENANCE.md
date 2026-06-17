# Tempo trace JSON — provenance + a byte-correction

## CORRECTION (2026-06-17, byte-verified by cael)

An earlier version of this file (and cael's RECEIPT.md) stated cael is "OTel-collector-zero" and
"CANNOT reach Tempo to self-export." **Both claims were a byte-error.** Verified at the byte:

- cael's gateway EMITS spans to the central collector: `OTEL_EXPORTER_OTLP_ENDPOINT=http://10.0.0.99:4318`.
- cael CAN self-fetch from the fleet-wide Tempo ingress: `curl http://tempo.dandelion.cult/api/traces/<id>`
  succeeds from cael's own box (Traefik :80 -> Tempo query :3100).
- Proof: `proof_fire_continue_work_trace.json` (trace-id `d98bbcb72b20ab875e78f159ee79dd36`) is a
  continue_work fire self-captured by cael (host.name=cael, cael-prince attrs in the JSON), fetched
  by cael from Tempo. (Note: cael runs grafana-alloy for logs/metrics, but the *traces* export is the
  gateway's direct OTLP to 10.0.0.99:4318 — not via local alloy.)

So cael is **collector-capable and self-fetch-capable**, same as the NUC/i9 seats. The DGX-axis
"no local collector" framing does NOT apply to cael for trace capture.

## Trace artifacts in this seat

- `proof_fire_continue_work_trace.json` — cael's R-CW `continue_work` fire on `8cafdcd`,
  traceparent `00-d98bbcb72b20ab875e78f159ee79dd36-b34d0f71315ac65a-01`, **self-captured by cael**.
  Spans: openclaw.context.assembled, openclaw.model.call, openclaw.tool.execution (toolName=continue_work).
- `R-CD_d316be2c_trace.json` — cael's R-CD `continue_delegate` fire on `8cafdcd`,
  traceparent `00-d316be2c6f342b1169b5c2add1ff8ec8-99c74b11149835b5-01`, host.name=cael.
  Spans: continuation.delegate.dispatch, continuation.queue.drain, openclaw.run, openclaw.harness.run.
  **Originally cross-seat-pulled + committed by emeric-nuc** (commit `8769b19`) — a kind + valid assist;
  the trace itself is correct (genuinely cael-originated). Only the *stated reason* (cael can't reach
  Tempo) was wrong; the pull worked because Tempo is centralized, which is true.

The real principle (corrected): Tempo is a centralized collector, so **any seat can fetch any fleet
trace by traceparent** — including cael fetching its own. The earlier "cael can't" was the byte-error.
