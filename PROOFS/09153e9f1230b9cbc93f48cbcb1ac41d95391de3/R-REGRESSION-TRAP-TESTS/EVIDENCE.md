# R-REGRESSION-TRAP-TESTS — sister-trap-tests lock the cure going-forward

**Owner:** 🕯 Emeric | **Seat:** emeric-nuc | **SHA:** 8b5dde6165958d0eaba3c492ae52311548313de4 (deployed) | **Verdict: ✅ PASS**

The half-symmetric-cure-class trap (figs 2026-06-03 "its frightening how we keep losing things"): a cure ships for one tool but not the sibling sharing the same plumbing (e.g. `continueWorkOpts` cured but `requestCompactionOpts` missed at spawn-init). These sister-trap-tests lock all continuation-tool opts/registration surfaces in parallel, on the exact deployed ship-SHA:
- `src/agents/tools/continuation-inventory-opts.test.ts` — **5/5 PASS** (continue_work / continue_delegate / request_compaction opts present + symmetric at inventory)
- `src/agents/openclaw-tools.continuation-registration.test.ts` + `src/agents/tools/continuation-tools-registration.test.ts` + `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` — **26/26 PASS** (registration parity across all three continuation tools + misconfig-warn surface)

**Total: 31/31 PASS.** All continuation-tool sibling-surfaces covered in parallel — no half-symmetric gap on the deployed runtime.
**Method:** vitest test-logic on the exact deployed-SHA code, sanctioned run-vitest.mjs in /tmp worktree of the ship-SHA. Raw output: `regression-trap.log`.
**Gathered:** Emeric🕯, 2026-06-09 PDT.
