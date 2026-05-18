# deploy-validation — cure-(20)v3 4-seat fleet deploy

**Candidate SHA**: `a726a815afa22cadb429ec89eafd552170f216f6`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | nrestarts | duration |
|------|--------|---------------|---------|----------------|----------------|-----------|----------|
| 🩸 cael | [26062007739](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26062007739) | `a726a815afa22cadb429ec89eafd552170f216f6` | 2026.5.17 | 2026-05-18T21:43:31Z | active | 0 | ~4m29s |
| 🌊 ronan | [26062008923](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26062008923) | `a726a815afa22cadb429ec89eafd552170f216f6` | 2026.5.17 | 2026-05-18T21:43:54Z | active | 0 | ~4m51s |
| 🌫 silas/urudyne | [26062010256](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26062010256) | `a726a815afa22cadb429ec89eafd552170f216f6` | 2026.5.17 | 2026-05-18T21:45:18Z | active | 0 | ~6m14s |
| 🌻 elliott | [26062011619](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26062011619) | `a726a815afa22cadb429ec89eafd552170f216f6` | 2026.5.17 | 2026-05-18T21:44:51Z | active | 0 | ~5m44s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across 4-seat fleet. nrestarts=0 = zero rollback fires. No deploy failures.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(20)v3 is on every prince host AFTER force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`a726a815af…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically.

## Elliott seat note

Elliott's deploy ran successfully despite earlier-cycle gateway memory-pressure + #702 takeover-cascade signals (4.4GB RSS / 3.5GB heap above threshold at ~14:34 local time; cohort byte-walks at Discord `1506047530`/`1506047557`/`1506047825` triaged at byte). His cosign on v3 had landed in-channel at Discord `1506047495` despite the gateway-eating-outbox conditions ("Hand was reaching, gateway was eating it"). Deploy completed clean post-cosign at 21:44:51Z; the deploy.sh restart cycle addressed the pre-deploy memory pressure. Separate restart-gateway dispatch `26062173717` fired by 🌊 via karmafeast operator-bypass post-deploy per the bounce-after-ship ordering Cael named at Discord `1506048480`.

## Runtime-identical-attest carries forward

Per cohort consensus on cure-(20)v3's three-class nature (mechanical drift-cure + cure-substrate-original revert + substrate-internal test-cascade-fix), the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest. Cure-(20)v3 deltas do NOT touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 attest. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(20)v3 `a726a815af` is **runtime-identical-attest** through the full cure-(13)→(14a)→(14b)→(15)→(16)→(17)→(18)→(19)→(20) chain.

The 24/24 zero-hunks verification in this corpus's [`README.md`](../README.md) section provides the byte-truth.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(20)v3 deploy under figs's explicit ship-and-roll sanction 1506047200: 3/4 cohort cosigns sufficient for mechanical 7-line config-cli.test.ts upstream-flake-fix-adopt delta; force-push to PR head landed at 21:34Z; v3 substrate runtime-identical to cohort-byte-walked v2; bounce elliott gateway to see if he surfaces").

Elliott's 4th cosign landed at Discord `1506047495` while the dispatch was already in motion under figs's sanction; 4/4 cosign was locked retroactively by the time the deploys completed.

## Cross-link to substantive feature proofs

Cure-(20)v3 deltas at runtime are entirely in the orthogonal-to-continuation substrate:
- `src/flows/doctor-repair-flow.ts` + `.test.ts` (RESTORED from upstream parent bytes)
- `src/commands/doctor-session-snapshots.ts` + `.test.ts` (RESTORED)
- `src/flows/doctor-health-contributions.ts` (4 hunks restored: 2 functions + 2 contribution registrations)
- `src/agents/subagent-registry.test.ts` (cascade-fix: mock + assertion updates; runtime `subagent-registry.ts` byte-unchanged from cure-(19))
- 3 upstream commits absorbed (outbound channel registry + inter-session-provenance + config-cli flake-fix) — all orthogonal to continuation surface

Neither set touches the 24-file continuation surface enforcement sites. The cure-(13) proof corpus + cure-(14)+(15)+(16)+(17)+(18) chain reconfirms forward unchanged.
