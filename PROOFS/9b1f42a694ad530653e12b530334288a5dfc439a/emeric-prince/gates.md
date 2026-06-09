# gates 3a-3f + cure-bytes 4a (deployed `9b1f42a694`)

**gate-3b typecheck (tsgo) ✅ GREEN — zero TS2352.** Ran tsgo on `test/tsconfig/tsconfig.extensions.test.json` (incl. slack `prepare.test.ts`) on `9b1f42a694` = zero TS2352.

**TS2352 1872-vs-2079 settled at the compiler-byte:** the first-round gate-3b HONEST-LIMIT (slack `prepare.test.ts` TS2352) is green-fixed on `9b1f42a694`:
- Line 2079 (literal-key seed `{ "agent:main:main": ... }`): `as unknown as Record<string, SessionEntry>` — the fix (was bare on `09153e9f12`; that bare-literal cast was figs's CI error on the stale SHA).
- Line 1872 (computed-key seed `{ [threadKeys.sessionKey]: ... }`): bare `as Record` — but tsgo does NOT strict-check through a computed index-signature → 1872 does NOT trigger TS2352. Compiler-confirmed (tsgo = zero TS2352 on the head).

**cure-bytes 4a ✅** count-0 + 2×-rotation: `run.ts` `compactionFailureContext` = 0 (Form B upstream-faithful removal restores the 2× rotation); the 2×-rotation assertions present + passing (the count-form direction-check).
