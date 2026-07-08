# R-CW-6 — continue_work chain cap boundary (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/219
Method packet: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/219#issuecomment-4883552643
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: PASS — source + direct harness proof; no live config mutation.

## Scope

`R-CW-6` checks the continue_work chain-depth cap boundary: when the current chain count is already at `maxChainLength`, a new `continue_work` election must be capped/rejected before any durable wake is enqueued or driven.

Per frond-scribe direction for this row, this proof does **not** mutate live `openclaw.json`, does **not** restart the gateway, and does **not** seed the live TaskFlow DB. It uses deployed/candidate source at exactly `bca2b0b89ab886bf23a10e4983926f6b374b3188` plus a direct harness against the scheduler function.

## Source receipts

`source/scheduler-source-snippet.txt` captures the boundary predicate in `src/auto-reply/continuation/scheduler.ts`:

```ts
const allocatedChainHop = chainState.currentChainCount;

if (allocatedChainHop >= config.maxChainLength) {
  log.info(
    `[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`,
  );
  return "chain-capped";
}
```

`source/work-dispatch-source-snippet.txt` captures `scheduleContinuationWork(...)` calling `checkContinuationBudget(...)` before pending-cap checks, hop allocation, TaskFlow row creation, or timer arming:

```ts
const budgetCheck = checkContinuationBudget({
  chainState: params.chainState,
  config: params.config,
  sessionKey: params.sessionKey,
});
if (budgetCheck) {
  params.log?.(
    `[continuation:work-rejected] ${budgetCheck} for ${params.sessionKey}: ${params.chainState.currentChainCount}/${params.config.maxChainLength}`,
  );
  return { scheduled: false, capped: true, chainState: params.chainState };
}
```

The same snippet shows the durable enqueue path (`enqueuePendingWork(...)`) occurs later, after this early return, so a `chain-capped` result does not create a pending continuation work row and cannot arm a wake timer.

`source/scheduler-test-snippet.txt` contains the existing unit test for the exact boundary predicate:

```ts
expect(
  checkContinuationBudget({
    chainState: { ...baseChain, currentChainCount: 10 },
    config: { ...config, maxChainLength: 10 },
    sessionKey: "agent:main:test",
  }),
).toBe("chain-capped");
```

## Direct harness

Harness file: `harness/scheduler-boundary-harness.mjs`

The harness imports `scheduleContinuationWork` from the `bca2b0b` worktree and calls it with:

- `currentChainCount: 200`
- `maxChainLength: 200`
- `delaySeconds: 0`
- synthetic session: `agent:main:rcw6-harness-boundary`

Harness output (`harness/scheduler-boundary-harness.log`):

```json
{
  "result": {
    "scheduled": false,
    "capped": true,
    "chainState": {
      "currentChainCount": 200,
      "chainStartedAt": 1783193300000,
      "accumulatedChainTokens": 0,
      "chainId": "rcw6-harness-boundary-chain"
    }
  },
  "logs": [
    "[continuation:work-rejected] chain-capped for agent:main:rcw6-harness-boundary: 200/200"
  ]
}
```

The harness exits nonzero unless all of these are true:

- `result.scheduled === false`
- `result.capped === true`
- `result.chainState.currentChainCount === 200`
- log contains both `[continuation:work-rejected]` and `chain-capped`

It exited successfully.

## No durable enqueue / no wake

This proof’s no-enqueue/no-wake claim is source-structural, not a live DB mutation claim:

- `checkContinuationBudget(...)` returns `"chain-capped"` when `currentChainCount >= maxChainLength`.
- `scheduleContinuationWork(...)` returns immediately with `{ scheduled:false, capped:true, chainState }` when `budgetCheck` is non-null.
- The durable enqueue path and timer arm occur later in the function after the early return.
- The direct harness result was the early-return shape above.

Therefore the capped boundary does not create a durable continuation row and cannot deliver a wake.

## Excluded/non-proof context

`non-proof/work-dispatch-chain-cap-test-dirty.log` records an attempted focused run of an existing work-dispatch partial-success test. It failed on bca2b0b because the selected harness did not deliver the earlier valid elections (`turnGrants` was empty). That log is preserved only as excluded/non-proof context and is not used to support this PASS.

A second attempted scheduler-test invocation used the wrong Vitest path filter and produced `No test files found`; that path-mismatch log is also preserved only as excluded/non-proof context.

## Verdict

PASS. At deployed/candidate source `bca2b0b`, the continue_work scheduler checks `currentChainCount >= maxChainLength` before durable enqueue/wake scheduling. A direct harness at `currentChainCount=200/maxChainLength=200` returned `scheduled:false,capped:true`, preserved chain count, and logged `work-rejected chain-capped`.
