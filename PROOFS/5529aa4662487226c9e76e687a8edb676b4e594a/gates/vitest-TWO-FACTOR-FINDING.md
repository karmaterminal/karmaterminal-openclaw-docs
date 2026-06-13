# vitest seat-block: TWO-FACTOR finding (refined 2026-06-12 23:18)

The earlier "seat-blocked by raptor-lake worker-maglev" verdict was HALF the story.
Tested figs's Vite-cache-corruption hypothesis as a discriminator. Complete byte:

## Factor 1: Vite cache corruption (low-load / isolated)
- The `unit-fast` shard SIGILL'd on v26. After `rm -rf node_modules/.vite`:
  isolated run (`--config vitest.unit-fast.config.ts --no-file-parallelism`)
  **PASSED — 1086 files / 10563 tests / exit=0 / 0 crash signals.**
- So a stale `.vite` cache (mismatched pre-bundled artifacts, e.g. after a v3
  `-march=x86-64-v3` recompile or prior runs) caused the isolated SIGILL.
- FIX: clear `node_modules/.vite` before running. (figs's catch.)

## Factor 2: maglev JIT under heavy parallel load (high-load / full run)
- The FULL 89-shard parallel run (parallelism 4, clean cache, v26): unit-fast
  **SIGSEGV'd again (exit 139).** Same shard that passed clean in isolation.
- So under heavy concurrent JIT pressure (many parallel workers), V8 maglev
  still miscompiles → worker SIGSEGV, even with a clean cache.
- FIX: `--no-maglev` in the vitest fork-pool worker execArgv (GH #998).

## Net
- Low-load (shard-by-shard, clean cache): runs clean on the raptor seat.
- High-load (full parallel run): needs #998's worker-maglev fix.
- Both factors are real, at different load levels. Neither alone is the whole story.
- Authoritative full-vitest green remains frond-scribe's non-raptor CI.
- node version: v25.9.0 SIGSEGV's earlier/differently (gateway-methods) — v25-specific
  maglev path; v26 is the cleaner base but still needs --no-maglev under parallel load.

## Discipline note
The full-parallel-run verdict is the byte (final exit/signal), not the per-shard
green lines that scroll before it. Verified by the final SIGSEGV + exit=139.
