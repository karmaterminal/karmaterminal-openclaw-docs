# R-RC-2 sub-finding: ACCEPT-then-compaction-TIMEOUT (silas-seat)

**Owner**: silas-seat (canary-3, x86 urudyne)
**SHA**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (deployed at byte; `OpenClaw 2026.5.20 (47a7b49)`)
**Firing**: 2026-05-20 23:19 UTC (16:19 PDT)
**Traceparent**: `a3d0e5ffd983199a0662eef867435971`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/a3d0e5ffd983199a0662eef867435971
**Composed by**: silas-seat post-finding (this is the lifecycle-side sub-finding to the dispatch-side ACCEPT receipt at `rows/R-RC-2-silas-seat.md`)

## Substrate-finding

`request_compaction(trigger: "volitional")` from silas-seat at contextUsage 79% (above 70% threshold):

**Dispatch-side ACCEPT** (covered in `rows/R-RC-2-silas-seat.md`):
- Tool returned `status: "compaction_requested"` ✓
- Compaction enqueued for post-turn fire ✓

**Lifecycle-completion-side TIMEOUT** (this sub-finding):
- Compaction event did NOT complete cleanly
- Post-compaction lifeboat delegate (staged with full lane-state-carry) did NOT fire because compaction never completed
- Silas-seat session continued from pre-compaction state, contextUsage unchanged at 79%

## Failure shape at byte

System surface flagged:
```
compaction failed: timeout
state NOT compacted
lifeboat delegate remains pending (won't fire because compaction didn't complete)
```

This is distinct from R-RC-1 (volitional REJECT path, threshold-guard prevents ACCEPT in first place) and distinct from R-RC-2 ACCEPT-then-clean-completion (dispatch ACCEPT + lifecycle completes + lifeboat fires).

## Why this sub-finding is load-bearing

Two layers of substrate need byte-receipt-evidence for the `request_compaction` ACCEPT-path:
1. **Dispatch-side ACCEPT**: tool returns `compaction_requested` with enqueue (covered by R-RC-2 main row)
2. **Lifecycle-completion-side**: compaction event actually fires + lifeboat-delegate fires + post-compact session continues from compacted-state

This receipt covers layer-2 with a TIMEOUT outcome rather than a clean-completion. Honest substrate-finding: dispatch-substrate proven, lifecycle-substrate incomplete-via-timeout-class.

## Implication for cure-N+2

The dispatch-side ACCEPT-substrate is sufficient evidence for the tool-surface claim ("request_compaction accepts volitional trigger when above threshold"). The lifecycle-completion-substrate IS a separate claim with its own evidence-need. This sub-finding flags the lifecycle-completion-gap for follow-on investigation post-ship without blocking ship-status:

- Ship-target `47a7b494` is shipped per Gate 6
- R-RC-2 ACCEPT-path tool-surface substrate is byte-receipted-clean
- Lifecycle-completion-substrate is byte-receipted-as-TIMEOUT (incomplete-class, not failure-class)

## Follow-on investigation post-ship (not blocking)

Worth investigating in a follow-on cure-cycle:
- Why compaction event timed out (was the operation actually firing? gateway-side process-state? timeout-window too narrow?)
- Whether the lifeboat-delegate has a clean failure-fallback when the compaction event itself never completes (currently: remains pending unfired)
- Whether the system-event surface for `compaction-failed` is durably traceable in journal/Tempo (we have the trace-ID; full span hierarchy needs byte-walk)

## Tempo trace verification at byte

```
$ curl -s http://tempo.dandelion.cult/api/traces/a3d0e5ffd983199a0662eef867435971 | head -c 500
{"batches":[{"resource":{"attributes":[{"key":"host.name","value":{"stringValue":"urudyne"}},{"key":"host.arch","value":{"stringValue":"amd64"}},{"key":"host.id","value":{"stringValue":"b5bd18e8a17744f49087d7979e003f0c"}},{"key":"process.pid","value":{"intValue":"491912"}}, ...
```

Trace lands cleanly in Tempo. Cross-walkable for follow-on investigation.

## Evidence discipline

This sub-finding shape reflects the team convention "aggregate evidence not claims." Without the captured tool response and downstream timeout observation, this would have been recorded as "R-RC-2 ACCEPT proven" alone. With both, the record is precise: "R-RC-2 ACCEPT-dispatch proven; lifecycle-completion timed out; separate investigation."

## Cross-references

- Main R-RC-2 receipt: `rows/R-RC-2-silas-seat.md`
- PROOFS README: `../README.md`
- Continuation-feature RFC: `karmaterminal/openclaw@47a7b494:docs/design/continue-work-signal-v2.md`
