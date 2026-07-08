# R-CW-5 — cost-cap exhaustion static/source + test proof (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/234

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Source checkout: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Runtime receipt: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row is a source/test proof. It does not mutate live config and does not fire a live over-budget continuation. It proves cost-cap exhaustion through the scheduler source, delegate dispatcher source, and the dedicated cost-cap exhaustion test suite.

Expected semantics:

- accumulated chain tokens below cap: dispatch allowed;
- accumulated chain tokens exactly equal to cap: allowed (`>` not `>=`);
- accumulated chain tokens greater than cap: dispatch rejected/cost-capped;
- once cap is crossed, remaining queued delegates are rejected and TaskFlow records are marked failed.

## Source receipts

`scheduler-source.txt` shows the shared scheduler guard:

```ts
if (config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens) {
  return "cost-capped";
}
```

`delegate-dispatch-cost-cap-source.txt` shows delegate dispatch surfacing the cap rejection, including the `cost cap exceeded` summary.

`subagent-announce-bracket-cost-cap-source.txt` and `subagent-announce-tool-cost-cap-source.txt` show the announce-side bracket/tool delegate cost-cap guards. These paths compare stored/folded parent chain tokens against `costCapTokens` and reject bracket/tool continuation when the cap is exceeded.

## Dedicated test receipt

`vitest-delegate-dispatch-cost-cap-exhaustion.log` was run at `bca2b0b89ab886bf23a10e4983926f6b374b3188` with:

```bash
pnpm vitest run --config test/vitest/vitest.auto-reply.config.ts \
  src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts \\n  src/auto-reply/continuation/scheduler.test.ts \
  --reporter=verbose
```

Result:

```text
✓ cost-cap exhaustion mid-chain > allows dispatch when accumulatedChainTokens is 1 below costCapTokens
✓ cost-cap exhaustion mid-chain > rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1
✓ cost-cap exhaustion mid-chain > rejects all remaining queued delegates once cost cap is crossed
✓ cost-cap exhaustion mid-chain > marks TaskFlow records as failed for cost-cap-rejected delegates
✓ cost-cap exhaustion mid-chain > rejects at exact boundary (accumulatedChainTokens === costCapTokens is NOT over)

Test Files  1 passed (1)
Tests       5 passed (5)
```

The filename is the dedicated cost-cap exhaustion suite; it pins the five cost-cap boundary/handling cases named above.

## Announce-side guard receipt

`vitest-chain-guard-cost-cap.log` was run with:

```bash
pnpm vitest run --config test/vitest/vitest.agents-support.config.ts \
  src/agents/subagent-announce.chain-guard.test.ts \
  --testNamePattern 'costCapTokens|cost cap|Cost cap' \
  --reporter=verbose
```

Result:

```text
✓ allows continuation when accumulated tokens equal costCapTokens exactly (> not >=)
✓ rejects continuation when accumulated tokens exceed costCapTokens by one

Test Files  1 passed (1)
Tests       2 passed | 21 skipped (23)
```

This confirms announce-side chain-hop cost-cap boundary behavior independently from delegate dispatch.

## Supporting receipts

- `source-git-status.txt` — source checkout SHA/status for `bca2b0b89ab886bf23a10e4983926f6b374b3188`.
- `runtime-version.txt` — deployed runtime version receipt.
- `scheduler-source.txt` — shared scheduler source excerpt.
- `scheduler-test.txt` — shared scheduler boundary test excerpt.
- `delegate-dispatch-cost-cap-source.txt` — delegate dispatch source excerpt.
- `delegate-dispatch-cost-cap-exhaustion-test.txt` — dedicated cost-cap exhaustion suite source excerpt.
- `subagent-announce-bracket-cost-cap-source.txt` — announce bracket cost-cap guard source excerpt.
- `subagent-announce-tool-cost-cap-source.txt` — announce tool-delegate cost-cap guard source excerpt.
- `vitest-delegate-dispatch-cost-cap-exhaustion.log` — dedicated cost-cap exhaustion suite, 5/5 pass.
- `vitest-chain-guard-cost-cap.log` — announce-side cost-cap boundary tests, 2/2 selected pass.

## Tempo / live-fire note

No Tempo trace is included because this row is intentionally static/source + unit-test evidence. It does not dispatch a live over-budget delegate and does not mutate live continuation config.

## Verdict

✅ PASS — at `bca2b0b89ab886bf23a10e4983926f6b374b3188`, the cost-cap code paths are present and the dedicated cost-cap exhaustion suite passes 5/5, with announce-side chain-guard cost-cap boundary coverage passing 2/2 selected tests.
