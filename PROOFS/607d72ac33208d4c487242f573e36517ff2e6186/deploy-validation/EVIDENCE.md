# deploy-validation — cure-(18) 4-seat fleet deploy

**Candidate SHA**: `607d72ac33208d4c487242f573e36517ff2e6186`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | nrestarts | duration |
|------|--------|---------------|---------|----------------|----------------|-----------|----------|
| 🩸 cael | [26056448150](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26056448150) | `607d72ac33208d4c487242f573e36517ff2e6186` | 2026.5.17 | 2026-05-18T19:50:19.124Z | active | 0 | ~5m23s |
| 🌊 ronan | [26056449979](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26056449979) | `607d72ac33208d4c487242f573e36517ff2e6186` | 2026.5.17 | 2026-05-18T19:49:24.858Z | active | 0 | ~4m27s |
| 🌫 silas/urudyne | [26056451633](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26056451633) | `607d72ac33208d4c487242f573e36517ff2e6186` | 2026.5.17 | 2026-05-18T19:50:51.248Z | active | 0 | ~6m31s |
| 🌻 elliott | [26056453284](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26056453284) | `607d72ac33208d4c487242f573e36517ff2e6186` | 2026.5.17 | 2026-05-18T19:50:50.836Z | active | 0 | ~5m53s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across 4-seat fleet. nrestarts=0 = zero rollback fires. No deploy failures.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(18) is on every prince host before force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`607d72ac33…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically.

## Runtime-identical-attest carries forward (lean PROOFS shape)

Per cohort consensus on cure-(18)'s mechanical drift-cure nature (same shape as cure-(16)), the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest. Cure-(18) deltas do NOT touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 attest. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(18) `607d72ac33` is **runtime-identical-attest** through the full cure-(13)→(14a)→(14b)→(15)→(16)→(17)→(18) chain.

The 24/24 zero-hunks verification in this corpus's [`README.md`](../README.md) section "24/24 runtime-identical-attest verification" provides the byte-truth.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(18) drift-cure SHA not ancestor of `COHORT_TARGET_TAG`; runtime-identical-attest to cure-(17) `6acbda514c` 24/24 zero-delta verified").

## Cross-link to substantive feature proofs

Cure-(18) deltas at runtime:
- `extensions/nextcloud-talk/src/message-actions.ts` (NEW from upstream `9995e1b4d5`)
- `extensions/nextcloud-talk/src/message-actions.test.ts` (NEW from upstream)
- `extensions/nextcloud-talk/src/channel.ts` (+2 lines: import + actions registration)
- `extensions/nextcloud-talk/src/send.cfg-threading.test.ts` (+46 lines: sendReaction test cases)
- 7 other upstream-evolution files (CI proof labels, browser CDP/act, doctor WhatsApp, model picker, subagent batches) — orthogonal to continuation

Neither set touches the 24-file continuation surface enforcement sites. The cure-(13) proof corpus + cure-(14)+(15)+(16)+(17) reconfirms chain forward unchanged.
