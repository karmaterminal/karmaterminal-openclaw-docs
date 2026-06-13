# swim-43/X2 — Main-session vs delegate vs leaf tool visibility

**Swim:** swim-43-v2026.5.5-full
**Block:** X — Family Observability
**Row ID:** X2
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/X2.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**Evidence class:** repo-test + code-read (current pass); live-row still required
**Gather:** registration call-site audit, current continuation-tool registration tests, explicit note that no delegate/leaf-specific live matrix has been run

## Surface under test

Per `SWIM/cases/X2.md`: tool visibility differs correctly across main-session / delegate / leaf contexts, with no leak of restricted tools to the wrong context.

This pass answers the narrower question the current tree can actually prove: what controls continuation-tool visibility today, and is any of that control keyed to session depth or ancestry.

## Result — current tree audit

### Current registration controls are wiring-based, not ancestry-based

In `src/agents/openclaw-tools.ts`, continuation tools are registered by option wiring:

```ts
...(continuation.enabled === true && options?.continueWorkOpts
  ? [createContinueWorkTool({ agentSessionKey: options?.agentSessionKey, ...options.continueWorkOpts })]
  : []),
...(continuation.enabled === true && options?.drainsContinuationDelegateQueue !== false
  ? [createContinueDelegateTool({ agentSessionKey: options?.agentSessionKey })]
  : []),
...(continuation.enabled === true && options?.requestCompactionOpts
  ? [createRequestCompactionTool({ agentSessionKey: options?.agentSessionKey, sessionId: options?.sessionId, runId: options?.runId, ...options.requestCompactionOpts })]
  : []),
```

Representative anchor:

```text
src/agents/openclaw-tools.ts:648-673
```

What matters here:
- `continue_work` visibility depends on `continuation.enabled` + `continueWorkOpts` being wired
- `continue_delegate` visibility depends on `continuation.enabled` + `drainsContinuationDelegateQueue !== false`
- `request_compaction` visibility depends on `continuation.enabled` + `requestCompactionOpts` being wired

None of these conditions mention main-session vs delegate-session vs leaf-session.

### Current repo tests pin wiring truth-tables, not session-depth truth

Current tests in `src/agents/tools/continuation-tools-registration.test.ts` pin:

```text
- continue_delegate exposed on normal turns when continuation is enabled
- continue_delegate hidden when continuation is disabled
- continue_delegate exposed when drainsContinuationDelegateQueue is undefined
- continue_delegate exposed when drainsContinuationDelegateQueue is true
- continue_delegate hidden when drainsContinuationDelegateQueue is false
- continue_work exposed when continuation is enabled and continueWorkOpts are wired
- request_compaction exposed when continuation enabled and requestCompactionOpts are wired
- request_compaction hidden when continuation disabled or opts omitted
```

These are real protections, but they are not a main/delegate/leaf matrix.

### No current branch on session ancestry found in the continuation-tool registration path

Fresh grep on the registration path finds no `spawnedBy`, `isSubagent`, `delegate session`, or `leaf session` branch in continuation-tool registration.

Representative search result:

```text
src/agents/openclaw-tools.ts: no session-depth/ancestry condition in continuation tool registration
src/agents/tools/continuation-tools-registration.test.ts: no main-vs-delegate-vs-leaf assertions
```

Related `spawnedBy` / subagent machinery exists elsewhere (for session access / routing), but not in the continuation-tool registration path itself.

## What is proved vs not proved

### Proved now

- continuation-tool visibility is currently controlled by feature flag + wiring options
- current repo-test coverage protects those wiring truth-tables
- there is no obvious ancestry-based branch in the continuation-tool registration codepath today

### Still not proved

- whether main / delegate / leaf sessions should differ by product contract
- whether the live session kinds actually receive the expected tool surfaces at runtime
- whether any non-registration layer suppresses or adds visibility by session kind

The case file asks for a per-context tool-list snapshot. This pass does not yet provide it.

## Verdict

**INCONCLUSIVE**.

Honest current read:
- the implementation appears **uniform-by-wiring**, not **differentiated-by-session-kind**
- but the X2 case asks for a live proof of that matrix, and I have not run it yet

So this row can move off pure TBD, but it cannot be PASSed from repo-test/code-read alone.

## Status ladder

- [x] **Triaged** — case compared against current implementation
- [x] **Authored** — repo-test/code-read findings written down
- [ ] **Fire-ready** — still need explicit live matrix procedure for main / delegate / leaf
- [ ] **Verified** — PASS blocked on live runtime snapshots

## References

- **Case file**: `SWIM/cases/X2.md`
- **Current implementation**: `src/agents/openclaw-tools.ts`
- **Current tests**: `src/agents/tools/continuation-tools-registration.test.ts`
- **Related older row**: `openclaw-bootstrap/swims/swim-34-formal-matrix/rows/X2.md`

## Notes

X2 is slightly different from X1:
- **X1** asks whether the public continuation tools are visible where the contract says
- **X2** asks whether visibility differs correctly across context depth

Current code-read says the implementation is not depth-aware at registration time. That may be correct by design — or it may mean the case is prescriptive rather than descriptive. The live row should answer that explicitly instead of letting the distinction blur.
