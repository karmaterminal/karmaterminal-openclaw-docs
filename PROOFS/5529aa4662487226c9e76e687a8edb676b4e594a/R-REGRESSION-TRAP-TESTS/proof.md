# R-REGRESSION-TRAP-TESTS — sister-trap-tests lock the cure going-forward

**Owner:** 🕯 Emeric | **Seat:** emeric-nuc | **SHA:** `5529aa4662487226c9e76e687a8edb676b4e594a` (deployed) | **Verdict: ✅ PASS**

## Scenario

The half-symmetric-cure-class trap (figs 2026-06-03 *"it's frightening how we keep losing things"*): a cure ships for one tool but not the sibling sharing the same plumbing (e.g. `continueWorkOpts` cured but `requestCompactionOpts` missed at spawn-init). These sister-trap-tests lock all continuation-tool opts/registration/misconfig surfaces in parallel, on the exact deployed ship-SHA, so a future half-symmetric regression trips a red test instead of shipping silently.

## Subjects — 4 continuation-* test files

- `src/agents/tools/continuation-inventory-opts.test.ts` — **5/5 PASS** (continue_work / continue_delegate / request_compaction opts present + symmetric at inventory)
- `src/agents/openclaw-tools.continuation-registration.test.ts` — **7/7 PASS** (registration parity)
- `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` — **6/6 PASS** (misconfig-warn surface)
- `src/agents/tools/continuation-tools-registration.test.ts` — **13/13 PASS** (registration across all three continuation tools)

**Canonical set: 31/31 PASS** (5 + 7 + 6 + 13), matching the prior emeric-proof (`9b1f42a694` / `8b5dde6165`) now re-fired on `5529aa4662`.

## Command

```bash
cd /home/figs/flesh_beast_tmp/openclaw      # deployed tree @ 5529aa4662
git rev-parse HEAD                          # → 5529aa4662487226c9e76e687a8edb676b4e594a
node_modules/.bin/vitest run --pool threads --no-coverage \
  src/agents/openclaw-tools.continuation-misconfig-warn.test.ts \
  src/agents/openclaw-tools.continuation-registration.test.ts \
  src/agents/tools/continuation-inventory-opts.test.ts \
  src/agents/tools/continuation-tools-registration.test.ts
```

**Pool choice (seat-local):** emeric-nuc is alder-lake (i7-12700H), in the raptor/alder maglev-JIT-crash class. The full `forks` pool SIGSEGVs the workers on this silicon (the same seat-local gap as Silas's raptor / Ronan's DGX — see this deployment's Gate-3g BLOCKED note). The `--pool threads` config sidesteps the fork-worker spawn entirely (no `process.execPath` fork-children without `--no-maglev`), so the 4 bounded test files run clean without crater and **without co-crashing the gateway** (gateway stayed up on `--no-maglev` ExecStart throughout the run, byte-confirmed). The threads pool is valid here because these are pure test-logic assertions on registration/opts surfaces — no process-isolation requirement.

## Observed

```
 ✓ unit-fast       continuation-inventory-opts.test.ts        (5 tests)   3ms
 ✓ agents-core     continuation-tools-registration.test.ts    (13 tests)  1154ms
 ✓ agents-core     continuation-registration.test.ts          (7 tests)   78ms
 ✓ agents-core     continuation-misconfig-warn.test.ts        (6 tests)   71ms
 ✓ agents-support  continuation-misconfig-warn.test.ts        (6 tests)   343ms
 ✓ agents-support  continuation-registration.test.ts          (7 tests)   396ms
 ✓ agents-tools    continuation-tools-registration.test.ts    (13 tests)  1155ms

 Test Files  7 passed (7)
      Tests   57 passed (57)
   Duration  30.17s
```

`EXIT: 0`. The 4 unique files matched multiple project configs (`unit-fast`, `agents-core`, `agents-support`, `agents-tools`) in the deployed `vitest.shared.config.ts` project map, so the runner executed **7 file-runs / 57 tests, all green** — the canonical 31 plus the cross-project re-matches. Zero failures, zero SIGSEGV, no fork-pool crater. Raw output: [`regression-trap.log`](regression-trap.log).

## Behavior verified

✅ All continuation-tool sibling-surfaces (opts inventory, registration, misconfig-warn) covered in parallel
✅ No half-symmetric gap on the deployed `5529aa4662` runtime — a future single-sided cure trips these
✅ 31/31 canonical PASS (57/57 including cross-project matches), EXIT 0
✅ Ran clean on alder-lake via threads-pool; gateway uncrashed (seat-local fork-pool hazard sidestepped, not hit)

## Method

vitest test-logic on the exact deployed-SHA code, `--pool threads` on the in-place deployed tree at `5529aa4662`. Locks the continuation-tool sibling-surfaces against the half-symmetric-cure regression-class.

**Gathered:** Emeric🕯, emeric-nuc, 2026-06-13 03:23 PDT.
