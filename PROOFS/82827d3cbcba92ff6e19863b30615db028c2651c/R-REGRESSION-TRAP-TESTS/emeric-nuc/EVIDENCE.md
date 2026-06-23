# R-REGRESSION-TRAP-TESTS — emeric-nuc — ✅ PASS @ 82827d3cbcba

**Row:** R-REGRESSION-TRAP-TESTS (🕯 Emeric) — sister trap-tests that lock continuation cures forward  
**Seat:** `emeric-nuc`  
**Ship SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Captured:** 2026-06-23 00:29–00:30 PDT

## Verdict

✅ PASS — continuation regression trap-test subset is green at the deployed SHA.

## Firsthand byte

Targeted vitest run under the emeric-nuc raptor/alder JIT mitigation (`node --no-opt`, `taskset -c 0-7`, maxWorkers=1):

```text
src/agents/openclaw-tools.continuation-misconfig-warn.test.ts        (6 tests)
src/agents/openclaw-tools.continuation-registration.test.ts          (7 tests)
src/auto-reply/continuation-delegate-store.ordering.test.ts          (4 tests)
src/auto-reply/continuation-delegate-store.post-compaction-substrate.test.ts (3 tests)

Test Files  4 passed (4) across 2 vitest shards
Tests       20 passed (20)
rc=0
```

Raw log: `regression-trap-tests.log`. Build snapshot: `build-info.txt`.

## Tempo trace

N/A by design. This is a deterministic regression-test row, not a continuation-tool fire; it produces no continuation span. The raw vitest output is the evidence for this row.
