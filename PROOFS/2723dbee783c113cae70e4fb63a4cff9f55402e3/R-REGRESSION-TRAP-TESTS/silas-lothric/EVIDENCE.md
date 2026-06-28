# R-REGRESSION-TRAP-TESTS — sister trap tests on 2723dbee

**Owner:** 🌫 Silas | **Seat:** silas-lothric | **SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3` | **Verdict:** ✅ PASS

## Scenario

Run the continuation sibling-surface regression trap tests on the exact deployed proof SHA. These tests lock the continuation tool option/registration surfaces together so a future cure cannot cover one sibling (`continue_work`, `continue_delegate`, `request_compaction`) while silently dropping another.

## Command

```bash
cd /home/figs/flesh_beast_tmp/openclaw
node scripts/run-vitest.mjs run \
  src/agents/tools/continuation-inventory-opts.test.ts \
  src/agents/openclaw-tools.continuation-registration.test.ts \
  src/agents/tools/continuation-tools-registration.test.ts \
  src/agents/openclaw-tools.continuation-misconfig-warn.test.ts
```

## Observed

Runtime checkout byte-confirmed at `2723dbee783c113cae70e4fb63a4cff9f55402e3` before the run.

Raw output is preserved in `regression-trap.log`. Summary:

- `src/agents/tools/continuation-inventory-opts.test.ts` — 5/5 PASS
- `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` — 6/6 PASS
- `src/agents/openclaw-tools.continuation-registration.test.ts` — 7/7 PASS
- `src/agents/tools/continuation-tools-registration.test.ts` — 13/13 PASS

Total: **31/31 PASS**, two vitest shards, process exit code 0.

## Verdict

✅ PASS. The deployed `2723dbee` byte has continuation inventory/registration/misconfig warning coverage across the sibling continuation tools. No half-symmetric regression is present in this trap set.
