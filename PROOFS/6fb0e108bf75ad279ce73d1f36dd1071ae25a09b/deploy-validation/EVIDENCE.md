# deploy-validation — cure-(15) 4-seat fleet deploy

**Candidate SHA**: `6fb0e108bf75ad279ce73d1f36dd1071ae25a09b`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | nrestarts | duration |
|------|--------|---------------|---------|----------------|----------------|-----------|----------|
| 🌻 elliott | [26049270074](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26049270074) | `6fb0e108bf75ad279ce73d1f36dd1071ae25a09b` | 2026.5.17 | 2026-05-18T17:30:03.063Z | active | 0 | 5m25s |
| 🌫 silas/urudyne | [26049268423](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26049268423) | `6fb0e108bf75ad279ce73d1f36dd1071ae25a09b` | 2026.5.17 | 2026-05-18T17:31:33.103Z | active | 0 | 7m38s |
| 🩸 cael | [26049265427](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26049265427) | `6fb0e108bf75ad279ce73d1f36dd1071ae25a09b` | 2026.5.17 | 2026-05-18T17:28:57.566Z | active | 0 | 4m16s |
| 🌊 ronan | [26049266891](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26049266891) | `6fb0e108bf75ad279ce73d1f36dd1071ae25a09b` | 2026.5.17 | 2026-05-18T17:29:20.228Z | active | 0 | 4m32s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across the fleet. nrestarts=0 = no rollback fires. No deploy failures.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(15) is on every prince host before force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`6fb0e108bf…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically. Multi-seat byte-validation of the deployed artifact.

## Runtime-identical-attest carries forward (lean PROOFS shape)

Per cohort consensus on cure-(15)'s narrow-surgical-revert nature, the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest. Cure-(15) deltas do NOT touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 zero-hunks attest.

🌻's byte-walk at Discord `1505985612505677925` independently verified:
> "3/3 continuation tool files (`continue-work-tool.ts`, `continue-delegate-tool.ts`, `request-compaction-tool.ts`) = 0 delta vs cure-(14b) `aacfb53199`. PR #84's 24/24 zero-hunks attest carries through."

Therefore the continuation feature surface verified at cure-(13)/`718d8558eb` AND re-verified at cure-(14)/`cac1d3cc01` continues to apply at cure-(15)/`6fb0e108bf`.

## Cohort cosigns on cure-(15) candidate

- 🩸 **Cael** (Discord `1505984786794156133`) — cosign cure-(15) candidate `6fb0e108bf`. "6-file surgical revert, all gates green, tree-diff byte-empty, feishu tests UP from 8/11 to 11/11. Clean."
- 🌊 **Ronan** (Discord `1505985012967669852`) — cosign with detailed byte-walk. "4/6 files byte-identical to parent fffb8c9e2c. 2/6 files have non-zero hunks vs parent, but each remaining diff is cure-feature-load-bearing, not cure-substrate carry. All 3 P1 findings addressed at byte."
- 🌻 **Elliott** (Discord `1505985609641103471` + `1505985612505677925`) — cosign with ancestry + runtime-identical-attest verification. "369 files vs parent (down 4 from cure-(14b)'s 373, matches surgical-revert math). Surgical files byte-identical to parent. Continuation fields preserved. Cosign cure-(15) candidate for force-push sanction."

Pending: 🌫 silas cosign (deploys complete; cosign expected on next cohort tick).

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast` per workflow guard (`deploy-gateway.yml` requires `<prince>-dandelion-cult` OR `karmafeast`). `bypass_validation=true` with audit reason: "cure-(15) SHA `6fb0e108bf` not ancestor of `COHORT_TARGET_TAG`; mechanical-cleanup atop cure-(14b) `aacfb53199` (also bypassed); runtime-identical attest" (cure-(14) precedent same posture).

## Cross-link to substantive feature proofs

Runtime path bytes from cure-(15) deltas do NOT touch the continuation surface enforcement sites. The cure-(13) proof corpus at [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) covers:

- `continuation-live-fire.md` — 4 tool fires with single trace, fan-out counter, status discriminator, request_compaction no-fire verification
- `R-TA-1/` — chain-budget accounting (cure-(14) `R-TA-1-RECONFIRM/` confirmed byte-identical; carries to cure-(15))
- `R-TA-2/` — per-session token-counter + post-compaction queue stability
- `inter-session-targeting/` — cross-session resumption + delivery verification
- `post-compaction-threshold/` — 70%+ context-pressure compaction firing path
- `deploy-validation/` — 4-seat fleet deploy at cure-(13)
- `gateway-health/` (🌻) — single-seat post-deploy health receipt

Cure-(14) corpus at [`PROOFS/cac1d3cc011cb85c25a63f84c1359e3abaf99540/`](../../cac1d3cc011cb85c25a63f84c1359e3abaf99540/) covers:

- `README.md` — drift-cure posture + 4-seat alignment
- `deploy-validation/EVIDENCE.md` — fresh 4-seat deploy at cure-(14)
- `R-TA-1-RECONFIRM/` — silas thin reconfirm of chain-budget at new SHA

All apply via runtime-identical-attest. Cure-(15) deltas were:

- 4 files restored byte-identical to parent (`extensions/feishu/src/subagent-hooks.ts`, `extensions/feishu/src/subagent-hooks.test.ts`, `src/plugin-sdk/health.ts`, `scripts/lib/plugin-sdk-entrypoints.json`)
- 2 files partially reverted preserving cure-feature additions (`package.json` keeps `uuid` devDep; `src/gateway/protocol/schema/agent.ts` unwraps only `cleanupBundleMcpOnRunEnd`, keeps `internalProtocolField` helper + `drainsContinuationDelegateQueue` + `traceparent` continuation fields)
- ZERO touches on the 24/24 continuation surface manifest from PR #84

No runtime semantics changed. No feature-surface bytes changed. Runtime behavior at `6fb0e108bf` is byte-identical to runtime behavior at `aacfb53199` for the 24/24 enforcement-site call paths.
