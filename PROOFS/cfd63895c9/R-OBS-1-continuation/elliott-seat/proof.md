# PROOF RECEIPT — elliott seat — R-OBS-1 (observability) + continuation-proof

**Tags:** `elliott seat` · `cfd63895c9` · `R-OBS-1 (observability)` · `continuation-proof` · `proof-SHA==ship-SHA byte-confirmed`

## 1. Proof-SHA == Runtime-SHA == Ship-SHA (no drift, byte-confirmed start + mid + end)

| check | value |
|-------|-------|
| `openclaw --version` | `OpenClaw 2026.6.8 (cfd6389)` |
| `git rev-parse --short HEAD` | `cfd63895c9` |
| ship-SHA (target) | `cfd63895c9` |
| gh auth | `elliott-dandelion-cult` |
| confirmed at | 2026-06-16 19:44:54 PDT (epoch 1781664294) |

Runtime `cfd6389` == HEAD `cfd63895c9` == ship-SHA `cfd63895c9`. Reconfirmed three times across the proof (start 19:41, mid 19:43, end-of-collation) — **zero drift mid-proof**. This is the DEPLOYED bytes, not a staging tree.

## 2. The dispatch IS the proof (continuation feature live on deployed bytes)

This delegate is a post-compaction-class `continue_delegate` exercising the lich/continuation release-path (#1030, by-design — the (c) reconciled to P3-nicety). It was dispatched at **19:41 PDT** (matching task header `[Tue 2026-06-16 19:41 PDT]`).

The deployed `cfd63895c9` runtime emitted the continuation feature's own instrumented span on the OTel pipeline:

### continuation.queue.drain (the lich/continuation release-path span)
- **trace_id:** `8b1aa5ce85ed78a20a634609b2966a7a`
- **W3C traceparent:** `00-8b1aa5ce85ed78a20a634609b2966a7a-33f45a625fb20b71-01`
- **attributes:** `queue.drained_count = 1`, `queue.drained_continuation_count = 1`
- **Meaning:** the continuation queue drained exactly ONE continuation — **this delegate's own dispatch.** The #1030 release-path is instrumented and firing on the deployed bytes, and it counted this dispatch.
- file: `trace-DELEGATE-drain-8b1aa5ce.json`

### openclaw.message.processed (this delegate's dispatch + execution tree)
- **trace_id:** `3a1c53c9fefcff2220b943c8e88bae6d`
- **W3C traceparent:** `00-3a1c53c9fefcff2220b943c8e88bae6d-8b2e5c3755b7f3be-01`
- **span tree:** message.processed → harness.run → run → {model.call ×2, context.assembled, tool.execution}
- **Meaning:** the full instrumented execution tree for this delegate's first turn — including `openclaw.tool.execution` (my proof commands running as spans). dur=45572ms.
- file: `trace-DELEGATE-dispatch-3a1c53c9.json`

## 3. OTel span→collector path LIVE on the deployed bytes (R-OBS-1)

- **OTel config (deployed runtime):** `enabled:true`, `serviceName:elliott-prince`, `endpoint:http://otel.dandelion.cult:4318` (resolves 10.0.0.99), `protocol:http/protobuf`, `traces:true`, `metrics:true`
- **Collector → Tempo query API:** `https://tempo.dandelion.cult/api/search?q={resource.service.name="elliott-prince"}` → HTTP 200, traces present and current.
- **Pipeline shape confirmed:** span → collector-only (no inbound-render wire). This is the OTel CLOSED no-bug pipeline (the code-walk established it as span→collector-only); this receipt proves that pipeline **LIVE on the deployed cfd63895c9 bytes** — every proof command landed as an `openclaw.exec` span in Tempo in real time.

## 4. Third-seat collation context

Third seat's proof on the DEPLOYED bytes:
- **elliott** (this receipt): R-OBS-1 / observability **+** continuation-proof
- **cael**: continuation
- **lothric (silas)**: continuation

All byte-confirmed **proof-SHA == runtime-SHA == ship-SHA == cfd63895c9**. The continuation feature (#1030 release-path) **and** the OTel pipeline are live on the deployed cfd63895c9 bytes.

## Files in this receipt
- `RECEIPT.md` (this file)
- `trace-DELEGATE-dispatch-3a1c53c9.json` — this delegate's message.processed execution tree
- `trace-DELEGATE-drain-8b1aa5ce.json` — paired continuation.queue.drain (drained_count=1)
- `trace-continuation-drain-18907d0d.json` — additional continuation.queue.drain sample
- `trace-msg-processed-a31da007.json` — additional message.processed sample
