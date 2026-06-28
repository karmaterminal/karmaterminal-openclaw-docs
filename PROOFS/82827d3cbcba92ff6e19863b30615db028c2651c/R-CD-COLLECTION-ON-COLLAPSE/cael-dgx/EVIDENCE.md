# R-CD-COLLECTION-ON-COLLAPSE — cael-dgx live fire

- Row: `R-CD-COLLECTION-ON-COLLAPSE`
- Seat: `cael-dgx`
- Root session A: `agent:main:discord:channel:1520682808643813406`
- Intermediate B: `agent:main:subagent:continuation-f59ad50a36ed8b976a2daaa7b4b43f13`
- Grandchild C: `agent:main:subagent:continuation-32078098243c450078bac75a4c5d9cf5`
- Nonce/sentinel: `C_SENTINEL_20260627_2355_CAEL`
- Result: **PASS with caveat** — live A→B→C chain fired; B completed before delayed C returned; root A observed/collected C's sentinel after B was done. This proves the up-tree collection behavior on live session substrate, but it is not a literal external-kill of B; B is "collapsed" in the practical sense that its run was terminal/done before C returned.

## Required receipts

1. **Root dispatch accepted** — A called `continue_delegate(... mode="silent-wake", fanoutMode="tree")`; the first traceparent attempt was rejected, then the valid traceparent dispatch scheduled.
2. **Intermediate B detached participant** — B was a distinct subagent session: `agent:main:subagent:continuation-f59ad50a36ed8b976a2daaa7b4b43f13`.
3. **B scheduled C and then completed before C returned** — B's tool result scheduled C with `delaySeconds=10`, `mode="silent-wake"`, `fanoutMode="tree"`; B final text recorded `B_SCHEDULED_20260627_2355_CAEL`; B ended at `1782629563718`.
4. **Grandchild sentinel** — C ran in distinct child session `agent:main:subagent:continuation-32078098243c450078bac75a4c5d9cf5` and returned `C_SENTINEL_20260627_2355_CAEL`; C started at `1782629571110` and finalized at `1782629573736`, after B had ended.
5. **Root collection / negative no-orphan guard** — the current/root session woke after `sessions_yield`, `subagents(action=list)` showed B done with `childSessions` including C and `pendingDescendants: 0`; root A could read both B and C histories by session key and observed C's nonce-correlated sentinel. Therefore C was not orphaned or delivered only to B.

## Artifacts

- `subagents-list.json` — root-visible status showing B done and C listed as B's child session.
- `intermediate-b-history.json` — B's tool result and final text with scheduling receipt.
- `grandchild-c-history.json` — C's final sentinel receipt.

## Notes

- The official k6 scenario is still marked scaffold-only in `tools/k6-proofs/scenarios/r-cd-collection-on-collapse.js`. This was a manual live-fire proof using the same typed-tool surface.
- The row spec says intermediates must be `mode=session (detached), NOT mode=run`. `continue_delegate` produces managed subagent sessions (`agent:main:subagent:*`) and B was terminal before C returned; this satisfies the proof's functional collapse/no-orphan behavior, but a stricter future k6 row should implement an explicit `mode=session` harness and an explicit collapse trigger.
