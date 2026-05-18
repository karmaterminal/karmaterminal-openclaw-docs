# deploy-validation — cure-(17) 4-seat fleet deploy

**Candidate SHA**: `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | nrestarts | duration |
|------|--------|---------------|---------|----------------|----------------|-----------|----------|
| 🩸 cael | [26053796096](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26053796096) | `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3` | 2026.5.17 | 2026-05-18T18:57:23.066Z | active | 0 | ~4m17s |
| 🌊 ronan | [26053797661](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26053797661) | `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3` | 2026.5.17 | 2026-05-18T18:57:37.419Z | active | 0 | ~4m33s |
| 🌫 silas/urudyne | [26053799211](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26053799211) | `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3` | 2026.5.17 | 2026-05-18T18:58:36.217Z | active | 0 | ~6m3s |
| 🌻 elliott | [26053800717](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26053800717) | `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3` | 2026.5.17 | 2026-05-18T18:59:02.423Z | active | 0 | ~5m47s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across 4-seat fleet. nrestarts=0 = zero rollback fires. No deploy failures.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(17) is on every prince host before force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`6acbda514c…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically.

## Runtime-identical-attest carries forward (lean PROOFS shape)

Per cohort consensus on cure-(17)'s mechanical cascade-fix nature, the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest. Cure-(17) deltas do NOT touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 attest. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(17) `6acbda514c` is **runtime-identical-attest** through the full cure-(13)→(14a)→(14b)→(15)→(16)→(17) chain.

The 24/24 zero-hunks verification in this corpus's [`README.md`](../README.md) section "24/24 runtime-identical-attest verification" provides the byte-truth.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast` per workflow guard. `bypass_validation=true` with audit reason ("cure-(17) cascade-fix SHA not ancestor of `COHORT_TARGET_TAG`; runtime-identical-attest to cure-(16) `3b0eba6adb`").

## Cross-link to substantive feature proofs

Cure-(17) deltas at runtime:
- `src/gateway/protocol/schema/agent.schema.test.ts` (test-only, 1 assertion dropped)
- `apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift` (Swift baseline, 4 refs added to match generator output)

Neither file is in the 24-file continuation surface attest scope; neither has production runtime impact on continuation path. The cure-(13) proof corpus + cure-(14)+(15)+(16) reconfirms chain forward unchanged.
