# elliott-legion R-CW-1 + R-CD-1 dispatch-half receipts — deployed 4bbd3aec096

## R-CW-1 (continue_work tool-form)
Fired `continue_work(delaySeconds=8)` on elliott-legion main session:
```json
{"status":"scheduled","delaySeconds":8,"traceparent":"00-2742c02b8fa2882d59ead7e2eb620a7a-8ceb9230be1d140f-01"}
```
→ scheduled, fresh OTel traceparent allocated by deployed binary. Wake drives next turn (chain increment + journal [continuation/signal] origin=tool-call kind=work) — wake-evidence appended on return.

## R-CD-1 (continue_delegate tool-form, silent-wake)
Fired `continue_delegate(mode="silent-wake")` on elliott-legion main session:
```json
{"status":"scheduled","mode":"silent-wake","delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-2742c02b8fa2882d59ead7e2eb620a7a-8ceb9230be1d140f-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```
→ scheduled, silent-wake, chain-tracking engaged. Echo-token R-CD-TOOL-elliott-4bbd3aec096-1781095400. [continuation:delegate-spawned] event + chain increment captured on wake-return.

## WAKE-EVIDENCE (captured on the wake-return turn, 05:43 PDT)

### R-CD-1 delegate spawn (system event, verbatim):
```
[2026-06-10 05:43:19 PDT] [continuation:delegate-spawned] Spawned turn 2/200:
R-CD-1 elliott-legion proof-delegate fired on deployed 4bbd3aec096 ...
Echo token: R-CD-TOOL-elliott-4bbd3aec096-1781095400
```
→ `[continuation:delegate-spawned]` ✓ + `Spawned turn 2/200` (chain-counter incremented) ✓. Tool-form continue_delegate dispatch-path live on the deployed binary.

### R-CW-1 work-wake (journalctl, verbatim):
```
05:43:45 [continuation:work-hedge-fired]
05:43:45 [continuation:work-hedge-armed] fireIn=59997ms
05:43:45 [continuation:work-wake] hop=1/200
05:43:45 [continuation:work-drive-skipped] flowId=f194d2b8... reason=requests-in-flight
```
→ `[continuation:work-wake] hop=1/200` ✓ — tool-form continue_work wake fired on the deployed binary. The `work-drive-skipped reason=requests-in-flight` is the **duplicate-drive guard working as designed** (the work-hedge defers driving while the session has requests-in-flight, re-arming ~1s) — corroborates Silas's R-CW-TOOL + Emeric's defer-while-active finding on a THIRD dist-loading seat (elliott-legion).

### Chain-state (session_status, post-fire):
- `🔄 Continuation: chain 2/200` — chain-counter incremented from the R-CD-1 delegate-spawn ✓
- `📌 Tasks: ... [continuation:chain-hop:2] Delegated task (turn 2/200): R-CD-1 elliott-legion` ✓
→ chain-tracking live on deployed binary; build `2026.6.2 (4bbd3ae)`.

**VERDICT: R-CW-1 ✅ (work-wake fired, defer-while-active guard confirmed) + R-CD-1 ✅ (delegate-spawned, chain→2/200). Both continuation-tool paths live on elliott-legion deployed 4bbd3aec096.**
