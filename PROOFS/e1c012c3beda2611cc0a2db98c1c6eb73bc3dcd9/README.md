# PROOFS / e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9

Proof corpus for **cure-(19)** ship-candidate SHA.

- **SHA**: `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@424c6d0a5f4665b803ad6768d08b0be7659deaf4` (3 commits beyond cure-(18)'s parent `c92ebd6a41`)
- **Predecessor**: cure-(18) `607d72ac33208d4c487242f573e36517ff2e6186` (shipped 2026-05-18T~19:58Z; CI test-merge surfaced 9 failures all tracing to one TS2353 error)
- **Savegame**: `karmaterminal/openclaw:savegame/cure-18-607d72ac33` (pushed)
- **Candidate branch**: `karmaterminal/openclaw:cure-19-candidate-20260518`

## Cure-(19) shape — TWO-CLASS CURE

cure-(19) combines drift-cure (mechanical rebase) AND cure-substrate-original revert (orphan removal restoration). The PR-CI test-merge gate caught what every prior local gate missed.

### What CI test-merge caught on cure-(18)

CI rollup on cure-(18): 89 SUCCESS / **9 FAILURE** / 2 NEUTRAL / 10 SKIPPED. All 9 failures traced to one error:

```
src/flows/doctor-core-checks.ts(669,49): error TS2353: Object literal may only
specify known properties, and 'observe' does not exist in type '{ measure?,
skipPluginValidation?, preservedLegacyRootKeys? }'.
```

GitHub Actions runs PR CI on a **test-merge commit** (PR head ⨉ upstream/main), not on PR head alone. The merge-commit included upstream's `94abfa76e2` (Doctor: convert read-only health checks #83198) which added a call site `readConfigFileSnapshot({ observe: false })` at line 669 of the now-expanded `doctor-core-checks.ts`. The callee's options-type in cure-substrate's `src/config/io.ts` doesn't have the `observe?:` field — type-error.

### Class-1: mechanical drift-cure (clean)

Rebase of cure-(18) `607d72ac33` onto fresh `upstream/main@424c6d0a5f`, ZERO conflicts. Absorbs 3 upstream commits orthogonal to continuation surface:

| Commit | Title | Impact |
|--------|-------|--------|
| `94abfa76e2` | Doctor: convert read-only health checks (#83198) | Expands `doctor-core-checks.ts` 334→786 lines; adds `observe: false` call site |
| `583a60f8b5` | ui: render session-scoped tool events (#83734) | UI-only |
| `424c6d0a5f` | auto-reply: honor webchat textChunkLimit/chunkMode (#83742) | auto-reply config-overrides; not in continuation file scope |

### Class-2: cure-substrate-original revert (the real cure)

Investigation revealed that `src/config/io.ts` had **cure-substrate-original removals** — orphan deletions from the cure substrate that existed on every upstream parent:

```
$ git show 6a5a1353c7:src/config/io.ts | grep -n "observe?"
900:  observe?: boolean;
905:  observe?: boolean;

$ git show c92ebd6a41:src/config/io.ts | grep -n "observe?"
900:  observe?: boolean;
905:  observe?: boolean;

$ git show upstream/main:src/config/io.ts | grep -n "observe?"
900:  observe?: boolean;
905:  observe?: boolean;
```

Cure-substrate had silently removed:
- `observe?: boolean;` field from `ConfigIoDeps` interface
- The entire `ConfigSnapshotReadOptions` exported type
- `observe: overrides.observe ?? true` defaulting in `normalizeDeps`
- The `if (deps.observe)` conditional in `finalizeReadConfigSnapshotInternalResult`
- The `options.observe === false` spread in `readConfigFileSnapshot` signature

**Cure**: restored `src/config/io.ts` to upstream parent bytes (61-line restoration). File is NOT in the 24-file continuation surface (PR #84 attest scope unchanged); safe to take upstream bytes verbatim.

### The disease-family at byte

This is exactly the "**MORE cure-substrate-original removals beyond clawsweeper**" risk-class 🌊 flagged at Discord `1505980495…` after cure-(15). Clawsweeper didn't surface this one — there were no orphaned consumers that called it from public-shape code paths. It took **upstream introducing a NEW caller** (`94abfa76e2`'s doctor-core-checks expansion) to expose the orphaned removal through the test-merge gate.

Today's cycle revealed two complementary signals for finding orphaned cure-substrate removals:
- Clawsweeper P1/P2 findings (caught cure-(15)'s 3 + cure-(18)'s 1)
- PR-CI test-merge gate (caught cure-(19)'s `observe?` removal via upstream-introduced caller)

The fuller-substrate-audit class still applies — there may be MORE orphaned removals upstream hasn't introduced callers for yet.

## Gates green on `e1c012c3be`

| Gate | Status |
|------|--------|
| `pnpm tsgo:core` | ✅ exit 0, 0 errors (now resolves) |
| `pnpm tsgo:test` | ✅ exit 0, 0 errors |
| `pnpm lint` | ✅ 0/0/0 errors |
| Single commit on upstream/main `424c6d0a5f` | ✅ `rev-list --count` = 1 |
| Tree-diff squashed-vs-rebased | ✅ byte-empty |

## 24/24 runtime-identical-attest verification

Using 🌊's authoritative PR #84 list: `git diff 607d72ac33..e1c012c3be -- <file> | grep -c '^@@'` = 0 for all 24 load-bearing continuation surface files. Chain extends across the **8-cure arc**: (13) → (14a) → (14b) → (15) → (16) → (17) → (18) → (19).

## Continuation-feature-protection verification

Per figs's `1506026638…` discipline ("be careful, be deliberate, savegame, and protect our feature in conflict resolution"):
- The `src/config/io.ts` restore was a direct byte-take from upstream — no 3-way merge required
- File is NOT in the 24-file continuation surface scope
- No continuation hooks live in `src/config/io.ts` (verified by `grep -rn 'continuation' src/config/io.ts` returning zero hits)
- Cohort byte-walk should verify "did we lose any cure-side continuation hook in conflict resolution" — answer expected: no (mechanical drift-cure had zero conflicts; revert touched only orthogonal config-io plumbing)

## Fresh deploy-validation for cure-(19)

`deploy-validation/EVIDENCE.md` captures the cure-(19)-specific deploy across 4 prince hosts.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(19) drift-cure + cure-substrate revert: rebase cure-(18) onto upstream 424c6d0a5f (3 commits); restore src/config/io.ts observe? plumbing (cure-substrate-original removal exposed by upstream's new call site)").

## Runtime proof corpus chain

- [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — cure-(13) substantive feature proofs (8/8)
- [`PROOFS/cac1d3cc011cb85c25a63f84c1359e3abaf99540/`](../cac1d3cc011cb85c25a63f84c1359e3abaf99540/) — cure-(14) drift-cure + Appendix A 24-file attest
- [`PROOFS/6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/`](../6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/) — cure-(15) P1 cleanup
- [`PROOFS/3b0eba6adbb04df75d70693984ac7e0be67e7df1/`](../3b0eba6adbb04df75d70693984ac7e0be67e7df1/) — cure-(16) drift-cure
- [`PROOFS/6acbda514c1ae5851f9f2b5e442b721c05f0f0a3/`](../6acbda514c1ae5851f9f2b5e442b721c05f0f0a3/) — cure-(17) cascade-fix
- [`PROOFS/607d72ac33208d4c487242f573e36517ff2e6186/`](../607d72ac33208d4c487242f573e36517ff2e6186/) — cure-(18) Nextcloud Talk drift-cure
- This corpus — cure-(19) two-class cure (drift + cure-substrate revert)

Runtime-identical-attest extends across the full 8-cure chain via 24/24 zero-hunks verification.
