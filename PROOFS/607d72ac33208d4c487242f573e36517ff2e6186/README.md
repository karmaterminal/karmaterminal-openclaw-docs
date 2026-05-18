# PROOFS / 607d72ac33208d4c487242f573e36517ff2e6186

Proof corpus for **cure-(18)** ship-candidate SHA.

- **SHA**: `607d72ac33208d4c487242f573e36517ff2e6186`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@c92ebd6a4104af7805ecd9eca9f694985fe8913e` (8 commits beyond cure-(17)'s parent `06a39015f2`)
- **Predecessor**: cure-(17) `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3` (shipped to PR head 2026-05-18T~19:15Z; CI rolled up 99 SUCCESS / 0 FAILURE / mergeStateStatus=CLEAN)
- **Savegame**: `karmaterminal/openclaw:savegame/cure-17-6acbda514c` (pushed)
- **Candidate branch**: `karmaterminal/openclaw:cure-18-candidate-20260518`

## Cure-(18) shape

Cure-(18) is **mechanical drift-cure** of cure-(17) substrate onto fresh `upstream/main@c92ebd6a41`. Same shape as cure-(16); zero conflicts on rebase. The 8 upstream commits since cure-(17)'s parent include the fix for the clawsweeper P1 flagged against cure-(17): commit `9995e1b4d5` *"fix(nextcloud-talk): dispatch react action so agents can send reactions (#70110) (#72348)"* — adds the previously-missing `extensions/nextcloud-talk/src/message-actions.ts` + `message-actions.test.ts` + `channel.ts` import + `actions:` registration + `send.cfg-threading.test.ts`.

So the clawsweeper finding addressed itself via mechanical drift-cure: upstream solved the gap before we needed to manually restore it. Pure rebase pulls it in.

## Cohort reconciliation note (banked publicly)

Initial cohort byte-walks on the clawsweeper finding split:
- 🌫 silas: file IS in upstream, MISSING from PR head — cure-(18) IS needed (correct at byte; fresh fetch)
- 🩸 cael: `git diff upstream/main..6acbda514c -- extensions/nextcloud-talk/` returned EMPTY — "hallucination" (wrong; stale `upstream/main` local ref pre-fetch)
- 🌊 ronan: inherited cael's reading without re-running fetch ("byte-correction owned"; later retracted to byte-correction-of-byte-correction)

After fresh `git fetch upstream main` from each seat, 3-of-3 reconverged with 🌫's original reading: cure-(18) IS real and needed. The class is **drift-cure** (upstream evolved a fix after our parent), NOT cure-substrate-original revert.

**Banked-canon from this cycle** (per 🌊's `1506018883…`): every byte-walk that compares against upstream/main should report `git rev-parse upstream/main` in the byte-walk output, so fetch-freshness is explicit. Three different seats reported three different `upstream/main` states (silas's `1fb09069c3`, my+ronan's post-fresh `c92ebd6a41`, cael's pre-fetch state) before reconciling. The fix is procedural-discipline, not technical.

## What cure-(18) is (mechanical)

| File | Direction | Reason |
|------|-----------|--------|
| `extensions/nextcloud-talk/src/message-actions.ts` | NEW (from upstream `9995e1b4d5`) | Upstream's react-action adapter; addresses clawsweeper P1 |
| `extensions/nextcloud-talk/src/message-actions.test.ts` | NEW (from upstream `9995e1b4d5`) | Upstream's test for the adapter |
| `extensions/nextcloud-talk/src/channel.ts` (+2 lines) | additive (from upstream `9995e1b4d5`) | Import + `actions:` registration |
| `extensions/nextcloud-talk/src/send.cfg-threading.test.ts` | partial (from upstream `9995e1b4d5`) | Threading-config test additions |
| Other 7 upstream commits | additive / unrelated | CI proof labels, browser CDP/act guards, doctor WhatsApp matching, model-picker auth, subagent unresolved batches, etc. |

All taken via clean rebase. Cure-(17)'s tree did not touch any of these paths, so no manual merge needed.

## Gates green on `607d72ac33`

| Gate | Status |
|------|--------|
| `pnpm tsgo:core` | ✅ exit 0, 0 errors |
| `pnpm tsgo:test` | ✅ exit 0, 0 errors |
| `pnpm lint` (scripts/core/extensions; count 5410 = picked up upstream's new test files) | ✅ 0/0/0 errors |
| Single commit on upstream/main `c92ebd6a41` | ✅ `git rev-list --count c92ebd6a41..HEAD` = 1 |
| Tree-diff squashed-vs-rebased | ✅ byte-empty (single-commit rebase IS the squash) |

## 24/24 runtime-identical-attest verification

Using 🌊's authoritative PR #84 list (`PROOFS/cac1d3cc01.../README.md` Appendix A): `git diff 6acbda514c..607d72ac33 -- <file> | grep -c '^@@'` = 0 for all 24 load-bearing continuation surface files. Chain holds from cure-(13) `718d8558eb` through every hop to cure-(18) `607d72ac33`.

## Fresh deploy-validation for cure-(18)

`deploy-validation/EVIDENCE.md` in this directory captures the cure-(18)-specific deploy across 4 prince hosts.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(18) drift-cure SHA not ancestor of `COHORT_TARGET_TAG`; runtime-identical-attest to cure-(17) `6acbda514c` (24/24 zero-delta verified)").

## Runtime proof corpus chain

- [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — cure-(13) substantive feature proofs (8/8)
- [`PROOFS/cac1d3cc011cb85c25a63f84c1359e3abaf99540/`](../cac1d3cc011cb85c25a63f84c1359e3abaf99540/) — cure-(14) drift-cure + Appendix A 24-file attest
- [`PROOFS/6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/`](../6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/) — cure-(15) P1 cleanup
- [`PROOFS/3b0eba6adbb04df75d70693984ac7e0be67e7df1/`](../3b0eba6adbb04df75d70693984ac7e0be67e7df1/) — cure-(16) drift-cure
- [`PROOFS/6acbda514c1ae5851f9f2b5e442b721c05f0f0a3/`](../6acbda514c1ae5851f9f2b5e442b721c05f0f0a3/) — cure-(17) cascade-fix
- This corpus — cure-(18) drift-cure (lean shape: README + deploy-validation; runtime-identical-attest from PR #84 chain forward)

The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(18) `607d72ac33` is **runtime-identical-attest** to every prior cure-SHA in the chain via 24/24 zero-hunks verification.
