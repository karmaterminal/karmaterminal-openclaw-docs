# R-CW-7 — traceparent E2E propagation across continuation spans — rune-rog-ally seat

**Verdict: ✅ PASS** — traceparent propagates end-to-end across the full continuation chain (single trace-id stitches the originating turn → delegate-dispatch → child run → continue_work) on the deployed fix.

- **Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64)
- **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
- **Traceparent (W3C):** `00-9327d6531a29ebb9ad56e2ffba70a24f-de122ac7e9a3dbbc-01` (emitted at the `continue_delegate` fire)
- **Trace-id:** `9327d6531a29ebb9ad56e2ffba70a24f` (base64-encoded in the OTLP export as `kyfWUxop67mtVuL/unCiTw==`)
- **Source fire:** the R-CW-DELEGATE-SELF-CONTINUATION self-continuation chain
- **Artifacts:** `traceparent_stitching.txt`, `selfcont_trace.json` (32-span trace, in the R-CW-DELEGATE-SELF-CONTINUATION row dir)

## The E2E propagation evidence

**Single trace-id across all 32 spans** (byte-verified):
```
distinct trace-ids across all 32 spans: 1
  trace-id: kyfWUxop67mtVuL/unCiTw==   (= 9327d6531a29ebb9ad56e2ffba70a24f)
```

Every span in the continuation chain — the originating `openclaw.message.processed`/`openclaw.run`, the `continuation.delegate.dispatch`, the child's nested `openclaw.harness.run`/`openclaw.run`, and the `continuation.work` election — shares the SAME W3C trace-id. The traceparent was not dropped or re-rooted at any hop boundary.

**The continuation spans stitch to the originating turn** (parent chain):
```
continuation.delegate.dispatch  <-parent-  openclaw.message.processed
continuation.work               <-parent-  openclaw.message.processed
```

So the traceparent `9327d6531a29ebb9` (emitted at the `continue_delegate` tool-fire, returned in the tool result) propagated through: the dispatch span → the spawned child's run spans → the child's own `continue_work` election span — all under one trace. This is the cross-hop trace-parent stitching the runbook's Tempo-trace requirement calls for ("trace-parent stitching evidence across the spans: continuation.delegate.dispatch → child openclaw.run").

## Disposition

PASS. traceparent propagates E2E across the continuation chain on the deployed ship SHA — single trace-id, byte-verified, continuation spans stitched to the originating turn. Stone-axis-substrate-of-record-witness shape.
