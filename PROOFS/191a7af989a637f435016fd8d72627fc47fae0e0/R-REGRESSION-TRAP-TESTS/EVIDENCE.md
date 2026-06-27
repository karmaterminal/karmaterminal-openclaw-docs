# R-REGRESSION-TRAP-TESTS — sister-trap-tests lock continuation tool surfaces

**Owner:** 🕯 Emeric  
**Seat:** emeric-nuc (i7-12700H Alder-Lake, CachyOS)  
**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0` (deployed, OpenClaw 2026.6.10 (`191a7af`))  
**Verdict:** ✅ PASS

## Scenario

The half-symmetric-cure-class trap: a cure ships for one continuation tool but not a sibling surface sharing the same plumbing. These tests lock continuation-tool opts/registration/misconfig-warning surfaces in parallel, on the exact deployed assembly SHA.

## Method

Executed in `/home/figs/flesh_beast_tmp/openclaw` at `191a7af989a637f435016fd8d72627fc47fae0e0` using the repository test runner with `node --no-opt` on this Alder-Lake seat:

```bash
node --no-opt scripts/run-vitest.mjs run \
  src/agents/tools/continuation-inventory-opts.test.ts \
  src/agents/openclaw-tools.continuation-registration.test.ts \
  src/agents/tools/continuation-tools-registration.test.ts \
  src/agents/openclaw-tools.continuation-misconfig-warn.test.ts
```

Runtime identity before the run:

```text
git rev-parse HEAD → 191a7af989a637f435016fd8d72627fc47fae0e0
node --no-opt dist/index.js --version → OpenClaw 2026.6.10 (191a7af)
```

## Observed

Raw output is saved in `regression-trap.log`.

Summary:

- `src/agents/tools/continuation-inventory-opts.test.ts` — **5/5 PASS**
- `src/agents/openclaw-tools.continuation-registration.test.ts` — **7/7 PASS**
- `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` — **6/6 PASS**
- `src/agents/tools/continuation-tools-registration.test.ts` — **13/13 PASS**

Totals:

```text
Test Files  1 passed (1)   Tests  5 passed (5)
Test Files  3 passed (3)   Tests  26 passed (26)
[test] passed 2 Vitest shards in 18.41s
```

Total assertions: **31/31 PASS**, exit code 0.

## Verdict

✅ **PASS** — continuation-tool sibling surfaces (opts inventory, tool registration parity, and misconfig-warning coverage) remain locked on deployed `191a7af989a637f435016fd8d72627fc47fae0e0`.

## Artifacts

- `regression-trap.log` — raw vitest output, 31/31 PASS, exit 0.
