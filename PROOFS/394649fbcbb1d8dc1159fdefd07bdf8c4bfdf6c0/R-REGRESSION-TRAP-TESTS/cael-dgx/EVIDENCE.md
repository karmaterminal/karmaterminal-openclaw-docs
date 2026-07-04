# R-REGRESSION-TRAP-TESTS — continuation sibling-surface regression trap tests (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/232

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Source checkout: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Seat: Cael / `cael-dgx`  
Build receipt: `OpenClaw 2026.6.11 (bca2b0b)`  
Verdict: ✅ PASS

## Scenario

Run the continuation sibling-surface regression trap tests on the exact deployed proof SHA. These tests lock the sibling continuation tool option/registration/misconfiguration surfaces together so a future cure cannot cover one sibling (`continue_work`, `continue_delegate`, `request_compaction`) while silently dropping another.

This is the same trap shape as the prior #196 row, refreshed for `bca2b0b89ab886bf23a10e4983926f6b374b3188`.

## Command

```bash
cd /tmp/oc-proofs-234-bca2b0b/openclaw-src
node scripts/run-vitest.mjs run \
  src/agents/tools/continuation-inventory-opts.test.ts \
  src/agents/openclaw-tools.continuation-registration.test.ts \
  src/agents/tools/continuation-tools-registration.test.ts \
  src/agents/openclaw-tools.continuation-misconfig-warn.test.ts
```

## Observed

Raw output is preserved in `regression-trap.log`. Summary:

```text
[test] starting test/vitest/vitest.unit-fast.config.ts
✓ src/agents/tools/continuation-inventory-opts.test.ts (5 tests)
Test Files 1 passed (1)\nTests      5 passed (5)

[test] starting test/vitest/vitest.agents.config.ts
✓ src/agents/openclaw-tools.continuation-misconfig-warn.test.ts (6 tests)
✓ src/agents/openclaw-tools.continuation-registration.test.ts (7 tests)
✓ src/agents/tools/continuation-tools-registration.test.ts (13 tests)
Test Files 3 passed (3)
Tests      26 passed (26)

[test] passed 2 Vitest shards in 18.95s
```

Total: **31/31 PASS**, two Vitest shards, process exit code 0.

## Supporting receipts

- `source-git-status.txt` — source checkout SHA/status at `bca2b0b89ab886bf23a10e4983926f6b374b3188`.
- `runtime-version.txt` — deployed runtime build receipt.
- `test-inventory.txt` — test file existence and test inventory receipt.
- `regression-trap.log` — raw command output showing 5/5 inventory opts plus 26/26 registration/misconfig trap tests.

## Tempo / live-fire note

No Tempo trace is included because this row is intentionally source/test evidence. It runs regression tests; it does not fire live continuation/delegate/compaction behavior.

## Verdict

✅ PASS. The deployed `bca2b0b` byte has continuation inventory/registration/misconfig warning coverage across sibling continuation tools. No half-symmetric regression is present in this trap set.
