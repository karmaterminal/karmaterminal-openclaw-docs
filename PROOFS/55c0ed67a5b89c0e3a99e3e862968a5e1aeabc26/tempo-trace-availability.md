# Tempo trace availability at FINAL SHA

**Verified at byte 2026-05-20 ~12:34 PDT**: tempo IS interactable + receiving + searchable from cael-seat.

## Endpoint checks
```
curl http://tempo.dandelion.cult/ready                  → 200 "ready"
curl http://tempo.dandelion.cult/api/echo               → 200 "echo"
curl http://tempo.dandelion.cult/api/search?limit=5     → traces flowing
```

## Sample traces from PROOFS firing window
Captured via `/api/search` shortly after R-CD-CHAINED-DEPTH-2 + R-CD-1 re-proofs:

| Trace ID | rootServiceName | rootTraceName | Notes |
|---|---|---|---|
| `5a15e4f9874ac1a34515753d46896f0` | (root not yet received) | | 🌫 R-CD-CHAINED-DEPTH-2 (his short ref `05a15e4f...`) |
| `28f8b5f5b036afa9281dff6102114b34` | elliott-prince | continuation.queue.drain | |
| `8f8518efd5e162097133f4566fc1fd96` | elliott-prince | continuation.queue.drain | |
| `32aa675a391625e01171ac35f4f2b1b9` | cael-prince | openclaw.run | 51s duration |
| `38693e7baf4afb9c9011900e3b849009` | cael-prince | openclaw.message.processed | 53s |

## Continuation OTel namespace firing
`continuation.queue.drain` visible from elliott-prince root span. Confirms continuation-feature spans are flowing into tempo at deployed SHA `55c0ed67a5`.

## Earlier "tempo broken" context
Diagnosis from this morning (Ronan + Silas msgs `1506657079` + `1506663138`) named haproxy resolver-cache poisoning as the failure-mode. That diagnosis was correct at THAT moment (post-outage haproxy restart had stale tempo backend resolution). At THIS moment (post-fleet-stabilization), tempo is responsive.

Long-term cure: haproxy template-PR by 🌻 (in flight) adds `hold nx/timeout/refused/obsolete` to resolvers block + tunes probe tolerances. That prevents the failure-mode from recurring on next outage/restart.

## Tempo trace-URL pattern for PROOFS receipts
For backfilling specific trace receipts into row-evidence files:
```
http://tempo.dandelion.cult/api/traces/<32-char-trace-id>
```
Note: trace-IDs in cohort msgs are often truncated to 8 chars; full 32-char ID needed for `/api/traces/` lookups (use `/api/search` to widen the lookup, then pin the full ID).

---

## Update 2026-05-24 13:15 PDT — superseded by post-rescue state

The "Earlier 'tempo broken' context" section above describes the May 20 haproxy resolver-cache poisoning. A separate, narrower outage occurred 2026-05-24 morning: cael + elliott seats had their `.openclaw.json` `diagnostics.otel.endpoint` config damaged (cael: json.dump reformat → schema crash-loop; elliott: dead gateway). 🌊 ronan restored `.bak` and sed-patched the endpoint on both at ~13:14 PDT. As of 2026-05-24 13:18 PDT:

- All 4 prince seats emitting to `tempo.dandelion.cult:4318` (verified via `/api/search?tags=service.name=<prince>-prince`, 20+ traces each)
- Span families present: `openclaw.run`, `continuation.work`, `continuation.queue.drain`, `openclaw.message.processed`, `openclaw.tool.execution`, `openclaw.harness.run`, `openclaw.model.call`
- Proof corpus re-fired on SHA `0dff94dbe4875a3b7ed44c60a9097a5f55083572` with REAL Tempo traces (not orphaned IDs)

This availability-doc, written at SHA `55c0ed67a5`, remains accurate-as-of-that-SHA. The current proof corpus at SHA `0dff94dbe48` is the byte-clean reference.
