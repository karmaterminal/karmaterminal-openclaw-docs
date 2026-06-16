# R-REGRESSION-TRAP-TESTS — sister-trap-tests lock the cure going-forward

**Owner:** 🕯 Emeric | **Seat:** emeric-nuc (i7-12700H Alder-Lake, CachyOS) | **SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed, OpenClaw 2026.6.2 (077b261)) | **Verdict: ✅ PASS**

## Scenario

The half-symmetric-cure-class trap (figs 2026-06-03, *"it's frightening how we keep losing things"*):
a cure ships for one tool but not the sibling sharing the same plumbing (e.g. `continueWorkOpts`
cured but `requestCompactionOpts` missed at spawn-init). These sister-trap-tests lock all
continuation-tool opts/registration surfaces in parallel, on the exact deployed ship-SHA, so a
future change can't reintroduce a half-symmetric gap silently.

## Method

vitest test-logic on the exact deployed-SHA code, via the sanctioned `scripts/run-vitest.mjs`
runner (which defaults to `--no-maglev` — required: this is an Alder-Lake seat in the raptor/alder
maglev-SIGSEGV class; the runner's `resolveVitestNodeArgs` default keeps the JIT off so the run
is a true test-result, not a silicon artifact). Seat confirmed on the deployed bytes:
`openclaw --version` → `OpenClaw 2026.6.2 (077b261)`, `git rev-parse HEAD` → `077b261dd820`.

```bash
node scripts/run-vitest.mjs run \
  src/agents/tools/continuation-inventory-opts.test.ts \
  src/agents/openclaw-tools.continuation-registration.test.ts \
  src/agents/tools/continuation-tools-registration.test.ts \
  src/agents/openclaw-tools.continuation-misconfig-warn.test.ts
```

## Observed (raw in `regression-trap.log`)

- `src/agents/tools/continuation-inventory-opts.test.ts` — **5/5 PASS** (3ms)
  (continue_work / continue_delegate / request_compaction opts present + symmetric at inventory)
- `src/agents/openclaw-tools.continuation-registration.test.ts` — **7/7 PASS** (480ms)
- `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` — **6/6 PASS** (503ms)
- `src/agents/tools/continuation-tools-registration.test.ts` — **13/13 PASS** (1303ms)
  (registration parity across all three continuation tools + the misconfig-warn surface)

```
Test Files  1 passed (1)   Tests  5 passed (5)
Test Files  3 passed (3)   Tests 26 passed (26)
[test] passed 2 Vitest shards in 18.23s   (process exit code 0)
```

**Total: 31/31 PASS**, both shards, exit 0. Zero SIGSEGV/SIGILL — the `--no-maglev` runner held
clean on the Alder-Lake seat (the silicon-safety per the seat's documented maglev hazard).

## Verdict

✅ **PASS** — all continuation-tool sibling-surfaces (opts inventory + registration parity +
misconfig-warn) covered in parallel on the deployed runtime `077b261dd8`. No half-symmetric gap:
if a future change cures one continuation tool's opts/registration but not its siblings, one of
these 31 assertions breaks. The cure is locked going-forward on the shipped tip.

## Artifacts

- `regression-trap.log` — raw vitest output, both shards, 31/31 PASS, exit 0, on the deployed SHA
