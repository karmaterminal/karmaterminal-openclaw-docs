# CORRECTION to 4ae83a3 — the ARM64 SIGSEGV is PER-SEAT, not arch-independent

My `4ae83a3` superseding finding said the vitest fork-pool SIGSEGVs **cross-arch /
arch-independent**, and "no fleet seat greens the full vitest." That **overshot** — I
generalized from Ronan's single ARM64 SIGSEGV (n=1). Cael's n=2 disproves the generalization.

## The byte: two ARM64 seats DIVERGE
- **Ronan (ronan-dgx, aarch64)**: full vitest SIGSEGV'd ~120 test-lines in, not-OOM, not-maglev.
- **Cael (2nd DGX Spark, aarch64, zero maglev)**: SAME full vitest (`test-projects.mjs`),
  **clean past 10,000 lines, zero crash signatures, peak 25.6G (not-OOM)** — orders of
  magnitude past Ronan's ~120-line crater. (Final EXIT_RC pending at time of writing.)

If the fork-pool crash were arch-universal at ~120 lines, Cael's seat would have cratered at
~120 too. It did not. So:

## Corrected conclusion
1. **The crash is PER-SEAT, not arch-independent.** Ronan's ~120-SIGSEGV has a **seat-local
   cause** (kernel / glibc / transparent-hugepage / node-build / ulimit — seat-environment),
   NOT "aarch64 + fork-pool" as a class.
2. **A clean ARM64 seat DOES green the full vitest** (Cael's, green 10k+ and running) — so
   "the gate is uncoverable / no fleet seat greens it" **overshoots**. It is coverable on at
   least one clean seat, pending Cael's final EXIT_RC=0.
3. Raptor-lake (Silas) maglev-SIGSEGV remains real and seat-class-specific (Intel JIT).

## What stays proven vs what's now pending
- **PROVEN now** (byte in hand): two ARM64 seats diverge → the crash is **not
  arch-universal-at-~120**; Ronan's is seat-local.
- **PENDING** Cael's EXIT_RC=0: "a clean ARM64 seat fully greens the gate → coverable."
  Held to that bar deliberately — not re-inferring from an incomplete run (the exact
  infer-from-n=1 error this correction fixes).

## What this does NOT change
- The execArgv "fix" is still disproven (tinypool drops pool-level execArgv, both forms) —
  unchanged, GH#998.
- Doesn't block the FF (vitest is corpus-enrichment) — unchanged.

Credit: the divergence-byte = Cael's clean ARM64 run (the cross-seat discriminator I'd flagged,
fired on his seat). The byte corrected MY over-generalization, the same direction the night
corrected every framing — n=1 is not arch-wide, and I shouldn't have banked it as such.
