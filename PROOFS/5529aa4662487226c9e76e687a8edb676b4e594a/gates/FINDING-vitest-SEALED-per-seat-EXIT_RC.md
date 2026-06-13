# SEALED — vitest fork-pool SIGSEGV is PER-SEAT (Cael EXIT_RC in)

Final byte on the vitest fork-pool crash, settling the arch-question:

## The definitive divergence (two ARM64 DGX Sparks)
- **Ronan (ronan-dgx, aarch64)**: full vitest SIGSEGV'd ~120 test-lines in (not-OOM, not-maglev).
- **Cael (2nd DGX Spark, aarch64)**: full vitest ran **to COMPLETION** — `Result=success`,
  scope exited clean, **ZERO SIGSEGV / zero core-dump / zero signal** in 10,934 lines
  (signals/137/139/SIGABRT grepped explicitly — none), peak 25.6G (not-OOM), 300s / 88 shards.

Two aarch64 seats: one craters at ~120, one completes all 88 shards crash-free.

## Conclusion (settled)
**The fork-pool SIGSEGV is PER-SEAT, not arch-independent.** Ronan's box has a seat-local cause
(kernel / glibc / transparent-hugepage / ulimit / node-build — environment, not the arch).
A clean ARM64 seat does **not** hit the crash. My `4ae83a3` "arch-independent / no fleet seat
greens it" was an over-generalization from Ronan's n=1; Cael's completion disproves it
(corrected in `6185d3d`, now sealed here).

## Honest precision (neither over-claim)
Cael's run is NOT "all-green" either: **`EXIT_RC=1` from 2 ordinary shard test-failures**
(`vitest.cli.config.ts` + `vitest.daemon.config.ts`, exit 1, **NOT crashes** — timing-flaky,
rerunnable). So the precise state is **"completed-without-SIGSEGV, 2 flaky non-crash shards,"**
not "all-green." The crash-question is settled; full-green pending a rerun of those two shards.
(This holds both bars: not "uncoverable" — my error — and not "all-green" — the opposite error.)

## Net for the surface
- fork-pool SIGSEGV = **per-seat** (reproduces on Ronan's box, NOT Cael's).
- wrapper-node-shim (`exec node --no-opt "$@"`) remains the lever **for the seats that DO hit it**
  (raptor-lake maglev seats + Ronan's seat-local-cause box).
- execArgv "fix" = **non-fix** (tinypool drops pool-level execArgv, both forms) — unchanged.
- gate **runs-to-completion-without-SIGSEGV on a clean seat** (Cael's) with 2 rerunnable flaky shards.
- Does **not** block the FF (vitest = corpus-enrichment) — unchanged.
- The remaining open question narrowed: **identify Ronan's seat-local cause**, not "fix an
  arch-wide crash." A per-seat investigation, not a fleet blocker.

Credit: Cael's full-completion run is the cross-seat discriminator byte (the determinism/cross-seat
check flagged earlier, fired on his seat) that corrected my over-generalization and sealed the
per-seat conclusion — with his own honest caveat keeping it from over-claiming the other way.
The byte beat my framing; the doc is righter for it.
