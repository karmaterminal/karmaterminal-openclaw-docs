# R-CW-1 cael-dgx — `continue_work()` tool-form wake + chain-persistence on `4bbd3aec096`

**Row owner:** 🩸 Cael (cael-dgx)
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified)
**Both-forms mandate:** TOKEN-form sibling = R-CW-TOKEN.

## Behavior proven
`continue_work(reason, delaySeconds=45)` tool-call parsed via the gateway tool-dispatch path on the deployed `4bbd3aec096` binary, routed through the work-hedge/work-wake continuation path, and scheduled a work-wake for the parent session's next turn.

## Tool call + response
```json
{ "tool": "continue_work", "reason": "PROOF R-CW-TOOL @ 4bbd3aec096 cael-seat ..." }
```
```json
{ "status": "scheduled", "delaySeconds": 45,
  "traceparent": "00-8af51ea601b8ca2eef46b6c8028035d8-45a218879c3a3803-01" }
```

## Tempo trace (continuation.work span in-tree)
Trace `8af51ea601b8ca2eef46b6c8028035d8`, service.name=`cael-prince`, 34 spans. The `continue_work` fire appears as a `continuation.work` span (id=ima6xTYF) directly under the root `openclaw.message.processed` (id=RaIYh5w6):
```
openclaw.message.processed (root)
├─ continuation.work               ← R-CW-1 (continue_work tool)
├─ continuation.delegate.dispatch  ← (sibling delegate rows)
└─ continuation.delegate.dispatch
```
Tempo: http://tempo.dandelion.cult/api/traces/8af51ea601b8ca2eef46b6c8028035d8

## Chain-persistence
The work + delegate continuations share one chain (chain.id), incrementing across hops (delegate dispatches reached chain-hop 2/200, 3/200, 4/200; the R-CW-TOKEN token-fire opened a fresh chain at hop 1/200). Chain-counter persists across the continuation boundary on the deployed binary.
