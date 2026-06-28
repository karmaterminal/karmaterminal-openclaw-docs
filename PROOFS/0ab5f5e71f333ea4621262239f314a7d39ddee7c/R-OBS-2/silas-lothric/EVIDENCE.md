# R-OBS-2 — Tempo trace-tree visualization / parent-child span hierarchy

**Owner:** 🌫 Silas | **Seat:** silas-lothric | **Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3` | **Verdict:** ✅ PASS

## What this row proves

R-OBS-2 is the observability proof row for exported continuation trace trees: a committed raw Tempo trace can be transformed into a machine-readable span-tree artifact and a human-readable parent-child hierarchy that shows continuation lineage.

This proof uses the already committed R-CW-7 Tempo export as the source trace because it is an explicit-traceparent continuation proof with a compact, complete parent-child tree.

Source trace:

```text
PROOFS/2723dbee783c113cae70e4fb63a4cff9f55402e3/R-CW-7/rune-rog-ally/trace-2723dbee000000000000000000000007.json
```

Trace ID:

```text
2723dbee000000000000000000000007
```

## Generated artifacts

- `trace-tree.json` — normalized span inventory with host/service, parent span IDs, selected attributes, root spans, and span-name counts.
- `span-tree.txt` — human-readable parent-child tree suitable for quick review without opening Tempo/Grafana.

## Span-plane summary

The source trace parses to **8 spans**, all under host `rune` / service `rune-prince`:

- `continuation.work`: 1
- `continuation.delegate.dispatch`: 1
- `openclaw.harness.run`: 1
- `openclaw.run`: 1
- `openclaw.model.call`: 1
- `openclaw.context.assembled`: 1
- `continuation.queue.fanout`: 1
- `continuation.queue.drain`: 1

The hierarchy shows the expected continuation lineage: parent collection work plus `continuation.delegate.dispatch`, child `openclaw.harness.run → openclaw.run → model/context` spans, and return-side `continuation.queue.fanout` / `continuation.queue.drain` as children of the delegate dispatch span.

## Validation

The artifact generator asserted:

- exactly 8 spans parsed from the raw Tempo export;
- `continuation.delegate.dispatch` present;
- `continuation.queue.fanout` present;
- `continuation.queue.drain` present.

## Verdict

✅ PASS — the 2723dbee corpus now contains a durable R-OBS-2 trace-tree visualization artifact and normalized span hierarchy proving that continuation traces can be exported, parsed, and reviewed as a parent-child tree without relying on live UI state.
