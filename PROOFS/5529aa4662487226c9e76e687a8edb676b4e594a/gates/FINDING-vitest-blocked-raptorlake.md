# Gate 3g (vitest) — BLOCKED on raptor-lake seat (silas/lothric, i9-14900KS)

**Status: BLOCKED (seat-local, NOT a candidate defect on 5529aa4662).**

## Byte-verified finding (2026-06-13, Silas)

The full vitest gate **cannot complete on this seat** due to a V8 JIT (maglev) miscompile
on Intel raptor-lake (i9-14900KS) silicon. This is a host-hardware/toolchain issue, not a
defect in candidate `5529aa4662487226c9e76e687a8edb676b4e594a`.

### What was tried and the byte-result

1. **node v25.9.0 (nvm, PATH default) + `--no-maglev` wrapper** → workers still SIGSEGV
   (the `--no-maglev` flag reaches the primary vitest node via `run-vitest.mjs:125`, but
   NOT the fork-pool workers spawned via `process.execPath` at lines 717/950).

2. **node v26.1.0 (system /usr/bin/node) via PATH-prepend** → **workers STILL SIGSEGV.**
   - Single-file smoke (`connect-error-details.test.ts`, 15 tests, `--maxWorkers=2`) = PASS,
     exit 0. **This was a FALSE POSITIVE** — the small workload never reached the JIT-load
     threshold that trips the miscompile.
   - Full suite (`pnpm test --run --maxWorkers=4`) = **EXIT 139 (SIGSEGV)** at
     `vitest.unit-fast.config.ts`, ~27s in. coredumpctl confirms the crashed worker PIDs
     (2031290/2031280/2031268) all ran `/usr/bin/node` = **v26.1.0**.
   - Confirms TOOLS.md prior finding: maglev miscompiles on raptor-lake at **BOTH** v25.9.0
     **AND** v26.1.0. It is not a stale-node problem.

3. **Collateral**: the uncapped-enough worker storm co-crashed the gateway itself
   (PID 2029567, SIGILL, `/usr/bin/node --no-maglev … gateway`) → forced restart. The heavy
   gate must NOT be reflexively relaunched on this silicon.

### The actual fix (config-PR, not a worktree hack)

`--no-maglev` (and likely `--no-opt` / `--jitless` for turbofan residual) must be delivered
to the **fork-pool workers' `execArgv`**, via `poolOptions.forks.execArgv` in the shared
vitest config (`test/vitest/vitest.shared.config.ts`). It CANNOT be delivered by:
- CLI flag: `--poolOptions.forks.maxForks`/`execArgv` → `CACError: Unknown option` (not a flat CLI flag).
- `NODE_OPTIONS=--no-maglev` → rejected by node ("not allowed in NODE_OPTIONS"), both v25 and v26.

This is a proper raptor-lake-gated PR to the fleet-shared config. The vitest proof-row for
this candidate is **deferrable to a non-raptor seat** (any ARM64 DGX or x86 non-raptor host),
where it runs clean without the JIT workaround.

### Evidence
- `gate-3g-vitest-full-v26.log` — the v26 run, ending in `exited by signal SIGSEGV`.
- coredumpctl (host silas, 2026-06-12 23:00:59–23:01:01 PDT): three `/usr/bin/node` SIGSEGV dumps.
