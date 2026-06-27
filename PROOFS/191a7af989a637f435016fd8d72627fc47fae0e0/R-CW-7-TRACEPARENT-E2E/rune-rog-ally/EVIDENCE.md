# R-CW-7 — traceparent E2E propagation (rune-rog-ally on 191a7af989)

**Row**: R-CW-7 (traceparent E2E across continuation spans)  
**Owner**: 🪨 Rune (`rune-rog-ally`)  
**Target SHA**: `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Runtime**: `OpenClaw 2026.6.10 (191a7af)`

## Dispatch

Fired `continue_delegate(mode="silent-wake")` with explicit W3C traceparent:

`00-00000000000000000000000000000001-0000000000000001-01`

Tool response accepted the delegate and returned the same traceparent. The first all-zero traceparent attempt was correctly rejected by validation; the second non-zero traceparent was accepted.

## Tempo capture

Trace export saved as:

- `trace-00000000000000000000000000000001-dispatch-tree.json`

Pulled from:

`http://tempo.dandelion.cult/api/traces/00000000000000000000000000000001`

The trace contains Rune spans under the supplied trace-id, including:

- `continuation.delegate.dispatch` with `delegate.mode=silent-wake`, `chain.step.remaining=199`, `host.name=rune`, `service.name=rune-prince`, and reason preview for the R-CW-7/R-CW-DELEGATE-SELF-CONTINUATION proof child.
- Child run spans linked under the dispatch span: `openclaw.harness.run` → `openclaw.run` → `openclaw.context.assembled` / `openclaw.model.call` / `openclaw.tool.execution`.
- `continuation.queue.fanout` with `fanout.mode=tree` and delivered outcome.

Note: the same trace-id has older cross-fleet spans because `000...001` was used as an explicit test trace-id. The Rune proof spans are host-pinned by `host.name=rune`, `process.pid=2385353`, and timestamp `1782581325...`.

## Child visibility check

The continuation child returned:

- Runtime: `OpenClaw 2026.6.10 (191a7af)`.
- Readable traceparent in inherited prompt/context/environment: **no**.
- This matches the design: traceparent is carried at the OTEL/telemetry layer, not exposed as prompt text.

## Verdict

✅ **PASS** — deployed `191a7af989` accepts/propagates a valid W3C traceparent through `continue_delegate`; Tempo shows the Rune dispatch and child run under the supplied trace-id.
