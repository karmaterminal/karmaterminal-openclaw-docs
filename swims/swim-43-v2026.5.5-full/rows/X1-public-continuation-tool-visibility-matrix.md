# swim-43/X1 — Public continuation tool visibility matrix (across session kinds)

**Swim:** swim-43-v2026.5.5-full
**Block:** X — Family Observability
**Row ID:** X1
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/X1.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**Evidence class:** repo-test (current pass) + live-row (still required)
**Gather:** tool-registration repo tests + tool execute-time guard tests + explicit note of missing live session-kind matrix proof

## Surface under test

Per `SWIM/cases/X1.md`: public continuation tools (`continue_work`, `continue_delegate`, `request_compaction`) are visible exactly where the contract specifies across session kinds.

At this pass, the repo-test surface is byte-pinned; the live-row session-kind matrix is not yet executed.

## Coverage expectation

- **Repo tests expected:** registration + execute-time guard coverage for all three public continuation tools
- **Live rows expected:** per-session-kind tool-list snapshots for main / delegate / leaf / heartbeat-like contexts
- **Evidence artifacts expected:** exact test locations for registration behavior, exact execute-time guard tests, and a clear statement of the still-open live matrix gap

## Result — current repo-test audit

### Registration-layer proof

Current source-tree tests pin registration behavior in `src/agents/tools/continuation-tools-registration.test.ts`:

- `continue_delegate` exposed on normal turns when continuation is enabled
- `continue_delegate` hidden when continuation is disabled
- `continue_delegate` exposed when `drainsContinuationDelegateQueue` is `undefined` or `true`
- `continue_delegate` hidden when `drainsContinuationDelegateQueue` is explicitly `false`
- `continue_work` exposed when continuation is enabled and runner wiring is present
- `request_compaction` exposed when continuation is enabled and `requestCompactionOpts` are wired
- `request_compaction` hidden when continuation is disabled
- `request_compaction` hidden when continuation is enabled but opts are omitted

Representative test anchors from current tree:

```text
src/agents/tools/continuation-tools-registration.test.ts:22   exposes continue_delegate on normal turns when continuation is enabled
src/agents/tools/continuation-tools-registration.test.ts:65   hides continue_delegate when continuation is disabled
src/agents/tools/continuation-tools-registration.test.ts:77   exposes continue_work when continuation is enabled and the runner wires it
src/agents/tools/continuation-tools-registration.test.ts:93   exposes continue_delegate when drainsContinuationDelegateQueue is undefined
src/agents/tools/continuation-tools-registration.test.ts:103  exposes continue_delegate when drainsContinuationDelegateQueue is explicitly true
src/agents/tools/continuation-tools-registration.test.ts:113  hides continue_delegate when drainsContinuationDelegateQueue is explicitly false
src/agents/tools/continuation-tools-registration.test.ts:271  exposes request_compaction when continuation enabled AND requestCompactionOpts wired
src/agents/tools/continuation-tools-registration.test.ts:280  hides request_compaction when continuation disabled
src/agents/tools/continuation-tools-registration.test.ts:292  hides request_compaction when continuation enabled but opts omitted
```

### Execute-time guard proof

Current tree also pins session-present guard behavior at execute time:

```text
src/agents/tools/continue-work-tool.test.ts:85       requires an active session
src/agents/tools/request-compaction-tool.test.ts:81  throws when no session key is provided
```

And the tool implementations themselves still carry the sessionless guard strings:

```text
src/agents/tools/continue-work-tool.ts:46         "continue_work requires an active session. Not available in sessionless contexts."
src/agents/tools/continue-delegate-tool.ts:148    "continue_delegate requires an active session. Not available in sessionless contexts."
src/agents/tools/request-compaction-tool.ts:163   "request_compaction requires an active session. Not available in sessionless contexts."
```

## What is still missing

The case claim is broader than the repo-test proof currently banked.

Still missing for a full row verdict:
- live session-kind × tool matrix snapshots
- explicit delegate-session proof
- explicit leaf-session proof
- heartbeat/sessionless-context visibility proof at the user-visible tool surface (not just unit-test execute guards)

No current byte in this pass proves the full main / delegate / leaf / heartbeat matrix required by `SWIM/cases/X1.md`.

## Verdict

**INCONCLUSIVE**.

What is proved now:
- registration-layer behavior is materially pinned in repo tests
- execute-time session guards exist for the public continuation tools

What is **not** yet proved:
- the live session-kind visibility matrix demanded by the case file

So X1 should move off pure TBD, but it is not a PASS yet.

## Status ladder

- [x] **Triaged** — case read against current source-tree
- [x] **Authored** — repo-test audit written down
- [ ] **Fire-ready** — live session-kind matrix still needs explicit plan
- [ ] **Verified** — PASS blocked on live matrix snapshots

## References

- **Case file**: `SWIM/cases/X1.md`
- **Prior swim precedent**: `openclaw-bootstrap/swims/swim-34-formal-matrix/rows/X1.md`
- **Current source tests**:
  - `src/agents/tools/continuation-tools-registration.test.ts`
  - `src/agents/tools/continue-work-tool.test.ts`
  - `src/agents/tools/request-compaction-tool.test.ts`

## Notes

This is useful progress because the swim-34 X1 read is now partially outdated: the current tree *does* pin more registration and execute-time guard behavior than the older row had banked. But the live matrix claim in `SWIM/cases/X1.md` is still larger than the current proof surface, so the honest verdict remains INCONCLUSIVE until a real session-kind walk is run.
