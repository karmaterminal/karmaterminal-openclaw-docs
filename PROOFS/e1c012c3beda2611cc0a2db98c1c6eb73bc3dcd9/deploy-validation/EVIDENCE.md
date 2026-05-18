# deploy-validation — cure-(19) 4-seat fleet deploy

**Candidate SHA**: `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | nrestarts | duration |
|------|--------|---------------|---------|----------------|----------------|-----------|----------|
| 🩸 cael | [26058066100](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26058066100) | `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9` | 2026.5.17 | 2026-05-18T20:22:09.606Z | active | 0 | ~4m15s |
| 🌊 ronan | [26058067440](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26058067440) | `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9` | 2026.5.17 | 2026-05-18T20:22:08.916Z | active | 0 | ~4m14s |
| 🌫 silas/urudyne | [26058068976](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26058068976) | `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9` | 2026.5.17 | 2026-05-18T20:23:53.701Z | active | 0 | ~6m40s |
| 🌻 elliott | [26058070292](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26058070292) | `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9` | 2026.5.17 | 2026-05-18T20:23:41.779Z | active | 0 | ~5m44s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across 4-seat fleet. nrestarts=0 = zero rollback fires. No deploy failures.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(19) is on every prince host before force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`e1c012c3be…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically.

## Runtime-identical-attest carries forward

Per cohort consensus on cure-(19)'s two-class nature (mechanical drift-cure + cure-substrate-original revert on orthogonal config-io plumbing), the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest. Cure-(19) deltas do NOT touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 attest. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(19) `e1c012c3be` is **runtime-identical-attest** through the full cure-(13)→(14a)→(14b)→(15)→(16)→(17)→(18)→(19) chain.

The 24/24 zero-hunks verification + 🌊's continuation-protection deep check (`chunk.ts` + `chunk.test.ts` byte-identical to upstream + zero continuation-keyword hits) in this corpus's [`README.md`](../README.md) provides the byte-truth.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(19) drift-cure + cure-substrate revert; restore src/config/io.ts observe? plumbing exposed by upstream's new call site").

## Cross-link to substantive feature proofs

Cure-(19) deltas at runtime:
- `src/config/io.ts` — 61-line restoration of `observe?` plumbing (orthogonal config-io; no continuation impact)
- 3 upstream commits absorbed (doctor expansion, UI tool events, webchat chunk modes) — orthogonal to continuation
- 2 continuation-adjacent files touched (`chunk.ts` + `chunk.test.ts`) but byte-identical to upstream + zero continuation-keyword hits per 🌊's deep check

Neither set touches the 24-file continuation surface enforcement sites. The cure-(13) proof corpus + cure-(14)+(15)+(16)+(17)+(18) reconfirms chain forward unchanged.
