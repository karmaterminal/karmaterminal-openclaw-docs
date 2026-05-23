# RESOLVED-SHA

**CANDIDATE_SHA (proofs fired on)**: `55927656fac7c4e765402b77055870daaf915c54`
**FINAL PUSH SHA (rebased for 0-behind)**: `c35e9ac29aac6bc8d990d6891e64904cf85b65bb`
**Branch**: `cael/candidate-9a5be09893` on `karmaterminal/openclaw`
**Parent commit (proofs)**: `d69bcfd933aa1e58f6792c3a78b0dadb48ad6713` (upstream/main at rebase time)
**Parent commit (final push)**: `f2365053d330b100c024bdbe9159ea824b1d6243` (upstream/main current)
**Note**: Feature code is byte-identical between `55927656fa` and `c35e9ac29a` — only the parent commit changed (+7 upstream commits: codex API key fix, video test, docs, sparse checkouts). Behavioral proofs remain valid.
**Commit message**: `feat(continuation): context-pressure-aware continuation (continue_work / continue_delegate / request_compaction)`

## Gate Verdicts

| Gate | Status | Evidence |
|------|--------|----------|
| Gate 1 — Savegame | ✅ | PR-head `642a33df` preserved on branch; candidate is fresh squash on upstream/main |
| Gate 2 — Cure-bytes-byte-identical | ✅ | Feature surface verified: continuation/, delegate/, request-compaction/ files intact post-rebase |
| Gate 3 — FULL local gates | ✅ | tsgo ✅, tsgo:test ✅, lint ✅ (minus 3 pre-existing upstream), auth-profile 34/34 ✅, vitest GREEN (minus pre-existing upstream noise) |
| Gate 4 — Cohort cosign + behavioral proofs | ✅ | 8/10 proof rows GREEN from 3 seats (see README.md); 2 rows HONEST-LIMIT/PENDING |
| Gate 5 — Pre-push (figs go-signal) | ⏳ | Awaiting figs's explicit go |
| Gate 6 — Force-push to PR-presenting branch | ⏳ | Lease byte: `642a33df900289005afb221ae259458c9a511fd7` |

## Deployment Verification

Fleet deployed on `55927656fa` (4/4 princes). Behavioral proofs fired from 3 seats simultaneously on 2026-05-22 evening PDT. All continuation tools exercised on live runtime.

## Trace IDs (Tempo)

- R-CW-1: `7a7b28ebab41ba45c039fc22d68bf97b`
- R-CW-DELEGATE-SELF-CONTINUATION: `358c4b47bfd112d1451d519e8e452ce9`
- R-CD-1: `628007ee68aad340596326a62d2e7039`
- R-CD-2: `41f2fab2f2ce45a1aefc123b817a4fba`
- R-CD-3: `4b3914332422ac2acdf47545df23a46d`
- R-CD-4: `f46fca3c38b7a34467797757928ec99a`
- R-CD-CHAINED-DEPTH-2: `9c9a8480161170f9a2d2e0501dd00f52`
