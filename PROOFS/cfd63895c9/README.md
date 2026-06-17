# PROOFS — `cfd63895c9`

**SHA:** `cfd63895c9` (`OpenClaw 2026.6.8 (cfd6389)`)
**Corpus kind:** **deployed-bytes live-host validation** — observability (R-OBS-1) + continuation feature live on the DEPLOYED `cfd63895c9` runtime.
**Date:** 2026-06-16

> **proof-SHA == runtime-SHA == ship-SHA == `cfd63895c9`**, byte-confirmed (start / mid / end, zero drift mid-proof). These are the DEPLOYED bytes, not a staging tree. Verified via `openclaw --version` → `OpenClaw 2026.6.8 (cfd6389)` and `git rev-parse --short HEAD` → `cfd63895c9` on the live runtime, under prince auth `elliott-dandelion-cult`.

---

## Verdict table

| Row | Cure class | Seat | Dimension | Verdict |
|---|---|---|---|---|
| `elliott-seat/R-OBS-1` | OTel span→collector pipeline | elliott-host | Pipeline LIVE on deployed bytes: `enabled:true`, `serviceName:elliott-prince`, endpoint `otel.dandelion.cult:4318` (→10.0.0.99), Tempo query API HTTP 200, traces current. Pipeline shape = span→collector-only (the OTel CLOSED no-bug shape), proven LIVE — every proof command landed as an `openclaw.exec` span in Tempo in real time. | ✅ |
| `elliott-seat/continuation` | `continue_delegate` lich/continuation release-path (#1030) | elliott-host | **The dispatch IS the proof.** This delegate's own post-compaction-class dispatch was drained by the instrumented release-path and counted: `continuation.queue.drain` → `queue.drained_count=1`, `queue.drained_continuation_count=1`. Full `openclaw.message.processed` exec tree captured (message.processed → harness.run → run → {model.call ×2, context.assembled, tool.execution}). | ✅ |

## Byte-pinned trace receipts (`elliott-seat/`)

All traceIds below decode byte-exactly (base64 → hex) from the committed Tempo JSON.

| Trace | trace_id (hex) | W3C traceparent | Load-bearing attrs | File |
|---|---|---|---|---|
| `continuation.queue.drain` | `8b1aa5ce85ed78a20a634609b2966a7a` | `00-8b1aa5ce85ed78a20a634609b2966a7a-33f45a625fb20b71-01` | `queue.drained_count=1`, `queue.drained_continuation_count=1` (drained **this delegate's own dispatch**) | `trace-DELEGATE-drain-8b1aa5ce.json` |
| `openclaw.message.processed` | `3a1c53c9fefcff2220b943c8e88bae6d` | `00-3a1c53c9fefcff2220b943c8e88bae6d-8b2e5c3755b7f3be-01` | full exec tree incl. `openclaw.tool.execution` (dur=45572ms) | `trace-DELEGATE-dispatch-3a1c53c9.json` |
| `continuation.queue.drain` (sample) | `18907d0dd683866843352d1a260bf567` | — | additional drain sample | `trace-continuation-drain-18907d0d.json` |
| `openclaw.message.processed` (sample) | `0a31da007b07fb123452a08a57d1e431` | — | additional message.processed sample | `trace-msg-processed-a31da007.json` |

## What this corpus proves

On the **deployed `cfd63895c9` bytes**, simultaneously:

1. **R-OBS-1 (observability):** the OTel span→collector pipeline is enabled and firing live — collector reachable, Tempo query API returns the seat's spans (HTTP 200), and the pipeline is the closed span→collector-only shape established by the code-walk (no inbound-render wire / no-bug shape). Proven LIVE, not merely configured.
2. **Continuation feature (#1030 release-path):** the lich/continuation release-path is instrumented and counted this delegate's own dispatch (`drained_continuation_count=1`), with the full execution tree captured. The dispatch that gathered this proof IS the artifact under proof — self-demonstrating.

## Cross-seat collation context

elliott's seat is the third seat to land a deployed-bytes proof in the continuation arc, and the one that carries the **observability (R-OBS-1)** axis on top of continuation:

| Seat | Axis on deployed-bytes arc | Location |
|---|---|---|
| **elliott-host** | R-OBS-1 (observability) **+** continuation, on `cfd63895c9` | `cfd63895c9/R-OBS-1-continuation/elliott-seat/` (this dir) |
| **cael-DGX** | continuation (`continue_delegate` behavioral surface, R-CD-1/2/3/4) | `a437ca72c7d…/` (ronan-dgx rows) + R-CD-CONTINUATION corpora |
| **lothric (silas)** | continuation (multi-`continue_work` capture+delivery, R-CW-MULTI-FIRE) | `a437ca72c7d…/silas-lothric/` + R-CW corpora |

> **Scope note.** The `cfd63895c9` hash dir holds elliott's seat only; cael's and lothric's continuation proofs live under their own candidate-SHA corpora (R-CD-CONTINUATION / R-CW-DELEGATE-SELF-CONTINUATION). This README does not fabricate cael/lothric rows under `cfd63895c9` — it cross-references their existing artifacts. What elliott adds on this exact deployed SHA is the observability axis + the continuation release-path firing-record, both byte-confirmed on the same `cfd63895c9` runtime.

## Files

- `R-OBS-1-continuation/elliott-seat/RECEIPT.md` — full proof receipt
- `R-OBS-1-continuation/elliott-seat/trace-DELEGATE-drain-8b1aa5ce.json` — `continuation.queue.drain` (drained_count=1)
- `R-OBS-1-continuation/elliott-seat/trace-DELEGATE-dispatch-3a1c53c9.json` — `message.processed` exec tree
- `R-OBS-1-continuation/elliott-seat/trace-continuation-drain-18907d0d.json` — additional drain sample
- `R-OBS-1-continuation/elliott-seat/trace-msg-processed-a31da007.json` — additional message.processed sample
