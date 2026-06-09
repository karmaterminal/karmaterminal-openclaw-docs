# Tempo byte-walk — ronan-dgx continuation spans LIVE on deployed 9b1f42a694

**Trace:** `e75683acb974543e03ebc0bbb81f0c05` (service.name=`ronan-prince`, 107KB)
**Query:** `curl http://tempo.dandelion.cult/api/traces/e75683acb974543e03ebc0bbb81f0c05` — parent-byte-walked (NOT echo-cited), confirmed the spans exist in Tempo on the deployed gateway.

## Authoritative continuation-primitive spans (the live fire-receipts)
Byte-confirmed present in the trace — the deployed `9b1f42a694` binary emitted these for my fires:

| Span name | Span ID | Maps to |
|-----------|---------|---------|
| `continuation.work` | `voLZfyaB8eM=` | R-CW (continue_work self-continuation) |
| `continuation.delegate.dispatch` | `pq4/JJrSqAI=` | R-CD-1 (silent) |
| `continuation.delegate.dispatch` | `/8mphxjjYPs=` | R-CD-2 (silent-wake) |
| `continuation.delegate.dispatch` | `2ilQ5+Wo4W0=` | R-CD-CHAIN-1 (depth-1) |
| `continuation.delegate.dispatch` | `CA68Ko3GSsw=` | R-CD-CHAIN-1 (depth-2 child) |
| `continuation.queue.drain` | `XbqMzsRZq0A=` | deployed gateway pulling my shard off the queue (dispatch-receipt) |
| `continuation.queue.drain` | `yUJQ/oTELtI=` | second queue-drain (the chained/wake dispatch) |

The `continuation.queue.drain` spans are the authoritative dispatch-receipts (the live gateway draining my shards), each **immediately followed by `openclaw.harness.run` + `openclaw.run`** spans (the spawn→execution of the delegate sub-agents) — proving the full **dispatch → queue-drain → spawn → harness-run → return** cycle landed on the deployed binary, not just the tool-return acknowledgment.

## Why this is firmer than the tool-return traceparent
The per-row EVIDENCE cites the traceparent (`00-e75683ac…`) the tool returned at dispatch. This byte-walk goes further: it confirms that traceparent's trace **actually materialized in Tempo** with the continuation-span hierarchy (4× `delegate.dispatch` + 1× `work` + 2× `queue.drain` + the following `harness.run` spawn-spans) — the live observability receipt off the deployed gateway. Matches the cohort rigor (🪨 rune `72c5d3551b…`, 🌻 elliott `cd6d…` queue-drain).
