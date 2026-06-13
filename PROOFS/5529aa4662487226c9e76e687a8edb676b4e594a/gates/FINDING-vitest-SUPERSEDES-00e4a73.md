# SUPERSEDES 00e4a73 — vitest fork-pool SIGSEGVs on BOTH arches; execArgv "fix" disproven

My earlier commit `00e4a73` ("fix = fork-worker execArgv config-PR, row deferrable to non-raptor seat")
is **now stale on two counts**, both disproven at the byte after it was written:

## 1. The execArgv "fix" does NOT propagate to tinypool workers (disproven, both forms)
Direct test — dump the worker's own `process.execArgv`:
- nested `poolOptions.forks.execArgv: ['--no-maglev']` (Vitest 3 form): DEPRECATED + ignored on vitest 4.
- top-level `forks: { execArgv: ['--no-maglev'] }` (Vitest 4 correct API, 0 deprecation warnings):
  worker dump → `HAS_NO_MAGLEV=false`. The flag is ABSENT.

Tinypool manages worker execArgv itself and drops the pool-level config **regardless of form**.
Emeric confirmed the identical byte on his (alder-lake) seat. So `forks.execArgv: ['--no-maglev']`
is a **NON-FIX** — do not file it as the cure. Recorded: GH karmaterminal/openclaw#998
(issuecomment-4697847176). Real lever = wrapper-node shim (`exec node --no-opt "$@"` as the
pool's node binary) or a custom pool runner — something that actually reaches worker spawn.

## 2. "Deferrable to a non-raptor seat" is disproven — ARM64 SIGSEGVs too
Ronan ran the full 3g vitest on his ARM64 (ronan-dgx, aarch64, zero maglev — aarch64 has no
maglev compiler at all). Result: **SIGSEGV (rc=1), ~120 test-lines in, NOT OOM** (26GB free /
107GB available, heap-33792 nowhere near ceiling), **NOT maglev** (no maglev on aarch64).
The build greened (rc=0, 128s); the vitest itself crashed.

So the fork-pool crash is **arch-independent** — it is NOT the raptor-lake maglev gap. The
"clean ARM64 seat will green the gate" assumption (leaned on all night) is FALSE.

## Honest current state of the full-vitest gate
The vitest fork-pool does **not cleanly pass on EITHER arch** under the current pool config:
- raptor-lake (i9/Silas): maglev-SIGSEGV early (v25 AND v26.1.0 both miscompile maglev on raptor;
  `00e4a73`'s v26-does-not-cure byte is correct — workers SIGSEGV exit 139, coredumpctl-confirmed).
- ARM64 (DGX/Ronan): different-signature SIGSEGV ~120 lines in, not-OOM, not-maglev.

Two readings, split by determinism (re-run discriminator, pending):
1. one broader tinypool fork-pool instability that maglev merely *worsens* on raptor; OR
2. a test that segfaults natively regardless of arch.

The build greening is real but it is **not the gate**. There is no clean seat in the fleet that
greens the full vitest under the current fork-pool. This does NOT block the FF (vitest is
corpus-enrichment, FF already landed) — but the gate is **NOT "covered."** Filing it as covered
would be the exact verdict-diverges-from-byte thing the cohort kept catching tonight.

Credit: execArgv-disproof = Emeric's catch + my v4-form confirm; ARM64-SIGSEGV = Ronan's run,
cashed honestly as a failure not a green. The byte corrected my own commit, both directions.
