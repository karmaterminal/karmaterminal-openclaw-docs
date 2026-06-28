# R-CW-5 — cost-cap exhaustion dispatch-time reject — ronan-dgx

**Seat:** `ronan-dgx`
**Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`
**Disposition:** ✅ **PASS** — source/test-only proof; no live continuation/delegate/compaction fire and no temporary gateway config mutation.

## What this row tests

`R-CW-5` is the continuation cost-cap boundary: when a continuation chain's accumulated token count exceeds `agents.defaults.continuation.costCapTokens`, queued delegates must be rejected at dispatch time instead of extending the chain and burning more tokens.

This filing intentionally uses the safe static lane requested for Project 81 continuation: exact-SHA source bytes plus deterministic unit tests. It does **not** claim a live low-cap induction, a gateway restart/restore receipt, or live runtime timing behavior.

## Source byte

`cost-cap-source-and-test-byte.txt` captures the exact deployed SHA source around the budget guard.

`src/auto-reply/continuation/scheduler.ts` implements the budget predicate:

```ts
if (config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens) {
  log.info(
    `[continuation] Chain cost ${chainState.accumulatedChainTokens}/${config.costCapTokens} — capped for session ${sessionKey}`,
  );
  return "cost-capped";
}
```

The comparison is intentionally strict-greater-than: `accumulatedChainTokens === costCapTokens` is still allowed; `accumulatedChainTokens > costCapTokens` returns `"cost-capped"`.

`src/auto-reply/continuation/delegate-dispatch.ts` consumes that predicate before spawning queued delegates. On `cost-capped`, it marks the delegate disabled with `cap.cost`, emits a cost-cap reason (`cost cap exceeded (<tokens> > <cap>)`), and leaves dispatch instead of spawning.

## Test receipt

Narrow test command run in a clean detached OpenClaw worktree at the exact candidate SHA:

```bash
cd /tmp/oc-p81-static-2723dbee783c113cae70e4fb63a4cff9f55402e3
pnpm exec vitest run src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts --pool=forks --maxWorkers=1 --no-fileParallelism --reporter=verbose
```

Result from `cost-cap-test.log` / `cost-cap-test-summary.txt`:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

The five passing tests pin the acceptance surface:

- `allows dispatch when accumulatedChainTokens is 1 below costCapTokens`
- `rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1`
- `rejects all remaining queued delegates once cost cap is crossed`
- `marks TaskFlow records as failed for cost-cap-rejected delegates`
- `rejects at exact boundary (accumulatedChainTokens === costCapTokens is NOT over)` — despite the historical test name, this asserts exact-boundary is **not** over-cap and dispatch is allowed.

## Supporting artifact checksums

`source-test-evidence.json` records the artifact byte sizes and sha256s for:

- `cost-cap-source-and-test-byte.txt`
- `cost-cap-test.log`
- `cost-cap-test-summary.txt`

## Verdict

✅ **PASS** — at deployed SHA `2723dbee783c113cae70e4fb63a4cff9f55402e3`, the continuation dispatcher has a source-level `accumulatedChainTokens > costCapTokens` guard that returns `cost-capped`; the delegate dispatcher consumes that guard as a dispatch-time rejection; and the dedicated cost-cap exhaustion test suite passes `5/5`, covering under-cap allow, over-cap reject, cascade rejection, TaskFlow failed-state side effect, and exact-boundary strictness. No live proof fire or config mutation was used.
