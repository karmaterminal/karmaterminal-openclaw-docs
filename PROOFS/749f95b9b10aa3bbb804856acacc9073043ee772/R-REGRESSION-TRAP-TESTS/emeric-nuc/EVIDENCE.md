# R-REGRESSION-TRAP-TESTS — emeric-nuc — ✅ PASS @ 749f95b9b10a

**Row:** R-REGRESSION-TRAP-TESTS (🕯 Emeric, canonical-owner — sister-trap-tests that lock-in the continuation cures going-forward)
**Seat:** emeric-nuc (Intel NUC i7-12700H, 64GB CachyOS x86_64)
**Deployed SHA:** `749f95b9b10a` (byte-confirmed firsthand: source-tree `git rev-parse HEAD` + `openclaw --version` = `OpenClaw 2026.6.9 (749f95b)`)
**Date:** 2026-06-21 ~11:14 PDT

## Verdict: ✅ PASS — continuation regression-trap-tests GREEN at the deployed SHA

The sister-trap-tests that substantively-lock-in the continuation cures (the half-symmetric-cure-class guard — cure ships for one tool but not the sibling sharing the same plumbing, e.g. `continueWorkOpts` cured but `requestCompactionOpts` missed) PASS clean on the deployed `749f95b` source tree.

## Byte (firsthand, this seat)

Targeted vitest run on the continuation trap-test surface, deployed tree `/home/figs/flesh_beast_tmp/openclaw` @ `749f95b9b10a`:

```
RUN  v4.1.8 /home/figs/flesh_beast_tmp/openclaw
·································
 Test Files  6 passed (6)
      Tests  33 passed (33)
   Duration  18.00s
[rc=0] — TRAP-TESTS GREEN (attempt 1)
```

Files covered:
- `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts`
- `src/agents/openclaw-tools.continuation-registration.test.ts`
- `src/auto-reply/continuation-delegate-store.ordering.test.ts`
- `src/auto-reply/continuation-delegate-store.post-compaction-substrate.test.ts`
(6 files / 33 tests total resolved by vitest's dependency-graph)

## Method note (raptor-lake-x86 vitest cure, per emeric-nuc TOOLS.md)

Ran under `node --no-opt` (kills maglev AND turbofan — the alder/raptor-lake JIT-miscompile SIGSEGV cure; `--no-maglev` alone leaves turbofan → identical residual) with `taskset -c 0-7`, plus a retry-on-SIGSEGV residual-absorber loop (3 attempts). First attempt was clean (rc=0) — no segfault on the targeted subset.

## Disposition
R-REGRESSION-TRAP-TESTS = ✅ PASS @ `749f95b9b10a`, emeric-nuc, byte-verified firsthand on the deployed source tree.
