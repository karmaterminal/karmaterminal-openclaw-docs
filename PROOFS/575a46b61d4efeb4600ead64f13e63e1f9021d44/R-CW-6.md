# R-CW-6 — continue_work maxChainLength boundary at `575a46b61d4efeb4600ead64f13e63e1f9021d44`

**Verdict:** PASS
**Source SHA under test:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
**Host:** `rune`
**Date:** 2026-06-29 PDT
**Proof row:** `R-CW-6` (`continue_work` / max-chain boundary)
**Requested PR criteria source:** `gh pr view 183 --repo karmaterminal/openclaw`

## Criteria read

I first read `karmaterminal/openclaw` PR #183, per assignment. The PR is closed and titled:

> `feat(plugin-sdk/zk): v1 recipes — Lock, LeaderElection, Party, ReadWriteLock (#177)`

Its verification section records:

- `pnpm tsgo` clean
- `pnpm test src/plugin-sdk/zk*.test.ts` — `26/26 pass`
- `pnpm check` clean
- `pnpm plugin-sdk:api:gen`

For the specific `R-CW-6` row, the in-repo proof manifest defines the behavioral target as the `continue_work` chain cap boundary: pre-seed/exhaust `maxChainLength`, attempt the next `CONTINUE_WORK`, and verify the continuation is rejected at the cap without advancing the chain or emitting an accept-span.

## Harness

I used an isolated detached worktree at the requested source SHA:

```text
/tmp/openclaw-r-cw6-575
```

SHA confirmation:

```text
$ git rev-parse HEAD
575a46b61d4efeb4600ead64f13e63e1f9021d44

$ git show -s --format=%s HEAD
Merge remote-tracking branch 'origin/codeagent/1132-ci-red-cleanup' into frond-scribe/20260624/assembly-continuation-followons
```

The existing integration harness `src/auto-reply/reply/agent-runner.continuation-work-span.test.ts` directly pins the `R-CW-6` boundary. Its cap-path case pre-seeds a session entry at `continuationChainCount: 2` while the harness config uses `maxChainLength=2`, then drives a continuation wake whose response contains `CONTINUE_WORK:1`.

Relevant asserted behavior from the harness:

```ts
// Pre-seed at maxChainLength=2 — the next CONTINUE_WORK request
// hits chain-cap reject and MUST NOT emit `continuation.work`.
const seededEntry: SessionEntry = {
  sessionId: "session",
  updatedAt: Date.now(),
  continuationChainCount: 2, // already at maxChainLength
  continuationChainStartedAt: Date.now() - 20_000,
  continuationChainTokens: 200,
  continuationChainId: seededChainId,
};

runEmbeddedAgentMock.mockResolvedValueOnce({
  payloads: [{ text: "Step 3 attempts\nCONTINUE_WORK:1" }],
  meta: { agentMeta: { usage: { input: 1, output: 1 } } },
});
await runWorkTurn(run, sessionStore, "Step 3 attempts\nCONTINUE_WORK:1", true);

// No `continuation.work` span emitted — accept-only contract.
const workSpans = spans.filter((s) => s.name === "continuation.work");
expect(workSpans).toHaveLength(0);

// The chain-cap reject branch emits exactly one `continuation.disabled`
// span. Span carries `disabled.reason = cap.chain` and
// `signal.kind = bracket-work` (CONTINUE_WORK signal).
expect(spans).toHaveLength(1);
expect(spans[0]).toMatchObject({
  name: "continuation.disabled",
  attributes: {
    "disabled.reason": "cap.chain",
    "signal.kind": "bracket-work",
    "continuation.disabled": true,
    "chain.id": seededChainId,
  },
});
```

Runner code anchor at this SHA:

```ts
const currentChainCount = activeSessionEntry?.continuationChainCount ?? 0;
const allocatedChainHop = currentChainCount + pendingDelegateCount(sessionKey);

if (allocatedChainHop >= maxChainLength) {
  defaultRuntime.log(
    `Continuation chain capped at ${maxChainLength} for session ${sessionKey}`,
  );
  enqueueSystemEvent(
    `[continuation] Bracket continuation rejected: chain length ${maxChainLength} reached.`,
    { sessionKey, trusted: true },
  );
  emitContinuationDisabledSpan({
    chainId: activeSessionEntry?.continuationChainId,
    chainStepRemaining: Math.max(0, maxChainLength - allocatedChainHop),
    disabledReason: "cap.chain",
    signalKind: isDelegate ? "bracket-delegate" : "bracket-work",
    delegateDelivery,
    delegateMode,
    log: defaultRuntime.log,
  });
}
```

## Verification run

First attempt used Jest-style `--runInBand`; Vitest rejected that option, so I re-ran with the repository's supported single-worker environment override.

Passing command:

```text
OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test src/auto-reply/reply/agent-runner.continuation-work-span.test.ts
```

Passing output:

```text
✓ auto-reply src/auto-reply/reply/agent-runner.continuation-work-span.test.ts (8 tests) 7411ms

Test Files  1 passed (1)
Tests       8 passed (8)
Start at    18:11:07
Duration    13.61s (transform 4.92s, setup 259ms, import 5.83s, tests 7.41s, environment 0ms)
[test] passed 1 Vitest shard in 17.03s
```

## Why this proves R-CW-6

The cap-path test exercises the exact boundary condition:

1. The session is already at the configured chain cap (`continuationChainCount=2`, `maxChainLength=2`).
2. The agent emits another same-session continuation signal (`CONTINUE_WORK:1`) from a continuation wake.
3. The runner rejects the continuation at the `maxChainLength` boundary.
4. The chain does **not** advance: no `continuation.work` accept span is emitted.
5. The rejection is observable as exactly one `continuation.disabled` span with `disabled.reason="cap.chain"`, `signal.kind="bracket-work"`, and the existing `chain.id` preserved.

That is the R-CW-6 acceptance criterion: the `continue_work` runaway leash trips at max-chain depth and emits the reject signal instead of scheduling another wake.
