# PROOFS / 6fb0e108bf75ad279ce73d1f36dd1071ae25a09b

Proof corpus for **cure-(15)** ship-candidate SHA.

- **SHA**: `6fb0e108bf75ad279ce73d1f36dd1071ae25a09b`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@fffb8c9e2c` (unchanged from cure-(14))
- **Predecessor**: cure-(14b) `aacfb53199b6f9e5e49070f2dda95beb0cf58f12` (shipped to PR head 2026-05-18T16:35Z)
- **Savegame**: `savegame/cure-14b-aacfb53199` (local; pushable on figs's call)

## Cure-(15) shape

Cure-(15) is **narrow surgical revert** of 3 cure-substrate-original carry-forwards flagged P1 by clawsweeper bot and independently confirmed by 4-seat cohort byte-walk (Silas + Ronan + Cael + Elliott, Discord `1505978…`-area + `1505979915…` byte-correction). None of the 3 P1s touch the load-bearing continuation feature surface.

## Cohort-validated drift diagnosis

Initial framing (mine, `1505979160…`) was: "upstream evolved while cure didn't carry." 🌊's byte-correction at `1505979915…` / `1505979916…` / `1505979918…` re-framed the substrate-truth: these are **cure-substrate-original removals/wrappings** from older continuation-feature lineage (`3a37573434`-era), not upstream evolutions we missed. Parent `fffb8c9e2c` and current `upstream/main` are byte-identical on these 3 files; only cure-(14b) diverged.

**Why diagnosis matters**: we're auditing our own substrate (carry-forward from earlier continuation iterations) rather than chasing upstream drift. The fix shape is the same (take parent/upstream bytes); the cohort mental model is different. 🌻's cosign at `1505980190…` aligned.

## 6-file surgical revert audit

| File | Direction | Reason |
|------|-----------|--------|
| `extensions/feishu/src/subagent-hooks.ts` | take parent | Cure removed `deliveryOrigin` field from `FeishuSubagentSpawningResult` + the `resolveFeishuDeliveryOrigin(...)` call site. Continuation has no business altering feishu delivery routing. |
| `extensions/feishu/src/subagent-hooks.test.ts` | take parent | Cure also modified 3 test expectations to match the removed-shape. Test self-consistency requires reverting alongside the prod-code restore. |
| `src/plugin-sdk/health.ts` | take parent | File was silently deleted in cure substrate; parent has it as a substantive plugin-SDK barrel re-exporting health-check + doctor-lint flow APIs (7 named exports + 8 type re-exports). Restored byte-identical (hash `8b9532e318f569ec1fa9eb00b1c9c9cb9e1fc5f0` matches parent). |
| `scripts/lib/plugin-sdk-entrypoints.json` | take parent | Cure dropped `"health"` from entrypoint list. Restored to match the package-export entry. |
| `package.json` | partial revert | Restore `./plugin-sdk/health` subpath export entry. `"uuid": "14.0.0"` devDep addition is cure-feature-load-bearing — kept. |
| `src/gateway/protocol/schema/agent.ts` | partial revert | Unwrap `cleanupBundleMcpOnRunEnd` from `internalProtocolField(...)` back to bare `Type.Optional(Type.Boolean())` with original "backward-compatible no-op" comment. `internalProtocolField` helper + `drainsContinuationDelegateQueue` + `traceparent` continuation-feature additions preserved. |

## 4-seat cohort byte-walk confirmation

- 🌫 silas (`1505978143…`) — confirmed all 3 P1 findings byte-real vs upstream
- 🌊 ronan (`1505978451…` + byte-correction `1505979915…`) — confirmed real; **re-framed diagnosis** to substrate-original carry-forward
- 🩸 cael (`1505978754…` + `1505980016…`) — confirmed all 3 real; vote `1505980183…` for immediate execution
- 🌻 elliott (`1505979737…` + `1505980190…`) — confirmed real on `aacfb53199` vs upstream `324a95db8b`; cosigned 🌊's substrate-original framing

Plus figs's Microsoft P0 visibility surface (`1505978671…` / `1505978762…`): PR #79925 listed as P0 XL in BradGroux's MS Project Lobster tracker PR #74163 — maintainer attention pending; time-to-merge matters.

## Gates green on `6fb0e108bf`

| Gate | Status |
|------|--------|
| `pnpm tsgo:core` | ✅ exit 0, 0 errors |
| `pnpm tsgo:test` | ✅ exit 0, 0 errors |
| `pnpm lint` (scripts/core/extensions) | ✅ 0/0/0 errors |
| feishu hooks vitest (`extensions/feishu/src/subagent-hooks.test.ts`) | ✅ 11/11 passed (was 8/11 with cure-substrate-test; revert→11/11) |
| gateway protocol vitest (`src/gateway/protocol/index.test.ts`) | ✅ passed |
| lint-suppressions vitest (`test/scripts/lint-suppressions.test.ts`) | ✅ passed |
| package-manifest contract test | ✅ passed |
| extension-runtime-dependencies contract test | ✅ passed (413/413 contract tests across both) |
| Tree-diff cure-(15) squashed vs unsquashed | ✅ byte-empty (proofs-SHA == push-SHA invariant satisfied) |

## Feature surface delta vs cure-(14b)

| | cure-(14b) | cure-(15) |
|---|---|---|
| Files changed vs parent | 373 | 369 (-4: 2 feishu files + health.ts + entrypoints.json now byte-identical to parent) |
| Continuation feature surface | identical | identical |
| Runtime behavior | identical | identical |
| Mergeability vs current upstream/main | CLEAN/MERGEABLE | CLEAN/MERGEABLE (expected) |

## Runtime-identical-attest carries forward

Cure-(15) deltas do **NOT** touch any of the 24/24 load-bearing continuation surface files identified in 🌊's `karmaterminal-openclaw-docs` PR #84 zero-hunks attest. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(15) `6fb0e108bf` is **runtime-identical-attest** to cure-(13) `718d8558eb` and cure-(14) `cac1d3cc01`.

**See [PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) for the substantive feature proofs** (corpus 8/8: METHOD/README/continuation-live-fire/R-TA-1/R-TA-2/inter-session-targeting/post-compaction-threshold/deploy-validation/gateway-health).

**See [PROOFS/cac1d3cc011cb85c25a63f84c1359e3abaf99540/](../cac1d3cc011cb85c25a63f84c1359e3abaf99540/) for the cure-(14) drift-cure corpus** (README + deploy-validation + R-TA-1-RECONFIRM).

## Fresh deploy-validation for cure-(15)

`deploy-validation/EVIDENCE.md` in this directory captures the cure-(15)-specific deploy across 4 prince hosts: substrate that `6fb0e108bf` is on every prince runtime + gateway active.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast` per workflow guard (deploy-gateway.yml requires `<prince>-dandelion-cult` OR `karmafeast`). `bypass_validation=true` with audit reason (cure SHA not ancestor of `COHORT_TARGET_TAG`; cure-(14) precedent same posture).
