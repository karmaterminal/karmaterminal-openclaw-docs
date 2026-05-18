# deploy-validation — cure-(16) 4-seat fleet deploy

**Candidate SHA**: `3b0eba6adbb04df75d70693984ac7e0be67e7df1`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | nrestarts | duration |
|------|--------|---------------|---------|----------------|----------------|-----------|----------|
| 🩸 cael | [26051925775](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26051925775) | `3b0eba6adbb04df75d70693984ac7e0be67e7df1` | 2026.5.17 | 2026-05-18T18:21:43.588Z | active | 0 | ~5m10s |
| 🌊 ronan | [26051927451](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26051927451) | `3b0eba6adbb04df75d70693984ac7e0be67e7df1` | 2026.5.17 | 2026-05-18T18:22:36.383Z | active | 0 | ~5m45s |
| 🌫 silas/urudyne | [26051929054](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26051929054) | `3b0eba6adbb04df75d70693984ac7e0be67e7df1` | 2026.5.17 | 2026-05-18T18:23:45.204Z | active | 0 | ~7m38s |
| 🌻 elliott | [26051930666](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26051930666) | `3b0eba6adbb04df75d70693984ac7e0be67e7df1` | 2026.5.17 | 2026-05-18T18:21:58.404Z | active | 0 | ~5m20s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across 4-seat fleet. nrestarts=0 = zero rollback fires. No deploy failures.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(16) is on every prince host before force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`3b0eba6adb…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically.

## Runtime-identical-attest carries forward (lean PROOFS shape)

Per cohort consensus on cure-(16)'s mechanical drift-cure nature, the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest. Cure-(16) deltas do NOT touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 attest. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(16) `3b0eba6adb` is **runtime-identical-attest** through the full cure-(13)→(14a)→(14b)→(15)→(16) chain.

The 24/24 zero-hunks verification in this corpus's [`README.md`](../README.md) section "24/24 runtime-identical-attest verification" provides the byte-truth.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast` per workflow guard. `bypass_validation=true` with audit reason ("cure-(16) drift-cure SHA not ancestor of COHORT_TARGET_TAG; runtime-identical-attest to cure-(15) 6fb0e108bf").

## Cross-link to substantive feature proofs

Cure-(16) deltas at runtime:
- `CHANGELOG.md` (auto-merged additive)
- `pnpm-lock.yaml` (auto-merged lockfile regen)
- `extensions/qa-lab/src/providers/mock-openai/server.ts` (auto-merged: upstream API refactor + new test scenario; mock provider only — no production runtime impact on continuation path)
- `src/agents/subagent-announce-delivery.ts` (manual import merge + body auto-merge; both sides routing-adjacent but orthogonal layers — upstream resolves chat-type for completion-delivery requirement; cure threads continuation-trigger override for delegate-mode classification; cohort 3-seat byte-walked confirmed no clobber)

None touch the 24-file continuation surface enforcement sites. The cure-(13) proof corpus + cure-(14)+(15) reconfirms chain forward unchanged.
