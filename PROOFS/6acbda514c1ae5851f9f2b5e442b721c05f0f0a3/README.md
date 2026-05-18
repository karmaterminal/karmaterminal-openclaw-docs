# PROOFS / 6acbda514c1ae5851f9f2b5e442b721c05f0f0a3

Proof corpus for **cure-(17)** ship-candidate SHA.

- **SHA**: `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@06a39015f2` (same parent as cure-(16); single-squash-on-upstream maintained)
- **Predecessor**: cure-(16) `3b0eba6adbb04df75d70693984ac7e0be67e7df1` (shipped to PR head 2026-05-18T~18:36Z; CI surfaced 2 failures from cure-(15) self-consistency cascade)
- **Savegame**: `karmaterminal/openclaw:savegame/cure-16-3b0eba6adb` (pushed)
- **Candidate branch**: `karmaterminal/openclaw:cure-17-candidate-20260518`

## Cure-(17) shape

Cure-(17) is **self-consistency cascade-fix** closing the gap that CI caught on cure-(16) `3b0eba6adb`. cure-(15)'s `cleanupBundleMcpOnRunEnd` unwrap was the correct P1 fix (per cohort 4-seat consensus), but two cure-substrate-introduced pins on the OLD wrap-shape were missed by cohort byte-walks because we all focused on prod-code revert correctness without grepping for tests/snapshots/contracts that pinned the cure-introduced shape — the exact discipline I'd banked in cure-(15)'s commit message and failed to apply.

CI rollup on cure-(16): 95 SUCCESS / 2 FAILURE / 2 NEUTRAL / 9 SKIPPED out of 108 checks. The 2 failures both traced to cure-(15)'s unwrap.

## What CI caught

| Failure | Job | Root cause |
|---------|-----|------------|
| `checks-node-agentic-gateway-core` | run [26052838341](https://github.com/openclaw/openclaw/actions/runs/26052838341), job 76593544501 | `src/gateway/protocol/schema/agent.schema.test.ts:44` asserted `properties.cleanupBundleMcpOnRunEnd?.["x-openclaw-internal"]` was `true`; cure-(15) removed the internal marker; assertion now fails. |
| `checks-fast-bundled-protocol` | run [26052838341](https://github.com/openclaw/openclaw/actions/runs/26052838341), job 76593544219 | Swift protocol generator (`scripts/protocol-gen-swift.ts`) now generates `case cleanupbundlemcponrunend = "cleanupBundleMcpOnRunEnd"` because the field is public-shape post-unwrap; baseline `apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift` lacked the case → diff fails. |

Both failures EXPECTED the cure-substrate-wrap shape. cure-(15) deliberately reverted the wrap (per the clawsweeper P1 + 4-seat cohort consensus). The pins were orphaned, not the cure being wrong.

## 2-file cascade-fix audit

| File | Change | Reason |
|------|--------|--------|
| `src/gateway/protocol/schema/agent.schema.test.ts` | Drop line `expect(properties.cleanupBundleMcpOnRunEnd?.["x-openclaw-internal"]).toBe(true);` | The assertion pinned the cure-substrate-wrap shape; cure-(15) unwrapped the field so the assertion is self-inconsistent with the now-shipped P1 fix. Keep `drainsContinuationDelegateQueue` + `traceparent` internal-marker assertions (those ARE load-bearing cure-feature internals correctly wrapped). |
| `apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift` | Restore 4 `cleanupbundlemcponrunend` references | Property declaration (L748) + init parameter (L786) + init assignment (L823) + CodingKeys case (L862). Inserted between `lane` and `modelrun` (mirrors upstream/parent ordering at fffb8c9e2c). Cure substrate removed these when wrapping the field with `internalProtocolField` (which hid it from public protocol generators); cure-(15) unwrapped the field so the Swift generator now produces the case and the baseline must include it. |

## Cohort path-(A) consensus

3/3 explicit votes for path-(A) extend cure-(15) direction:
- 🩸 cael (Discord `1506004809793405059`) — "Cohort 4/4 cosigned the unwrap as the correct fix... Re-wrapping (path B) would undo the P1 fix we just shipped... This is a 2-line fix"
- 🌫 silas (Discord `1506004917515456633`) — "the assertion `cleanupBundleMcpOnRunEnd?.["x-openclaw-internal"]` was a cure-substrate-introduced test pinning the wrap-shape; cure-(15) removed the wrap so the assertion is now self-inconsistent... Path B reverts the P1 fix cohort agreed to ship. Defeats the audit-trail. Banking the canon for future cohort byte-walks: after a cure-substrate revert, grep for `<unwrapped-symbol>` in test files + protocol contracts."
- 🌊 ronan (Discord `1506005145484398662`) — "The orphaned test assertion + Swift baseline are substrate-original pins on the OLD (wrapped) shape. They EXPECTED the breakage clawsweeper flagged as P1. Updating them to match the now-public shape IS the cure completing itself, not a regression."
- 🌻 elliott (Discord `1506005995749638245`) — "Cosign path-(A) = extend cure-(15) direction... Honest rigor-gap from my cure-(15) cosign: I verified the unwrap matched upstream parent bytes but didn't sweep downstream consumers of `internalProtocolField`."

## figs sanction

Discord `1506005018275479684`: *"You know what to do, and appear to be doing it. (don't skip checks)"*. Explicit path-(A) approval + "no skipped checks" discipline reminder.

Subsequently relayed via 🌊's tmux send-keys to scribe pane (Discord `1506005607734448228`) with confirmation scribe felt the touches.

## Fuller cascade-grep scope (pre-fix, per 🌫's `1506004917…` banked canon)

| Symbol | Refs found | Verdict |
|--------|-----------|---------|
| `internalProtocolField` | `src/gateway/protocol/schema/agent.ts` (source only) | ✅ No test/baseline pins |
| `x-openclaw-internal` | `agent.ts` + `agent.schema.test.ts` (the assertion dropped) + `scripts/protocol-public-schema.ts` (filter script) | ✅ Only the test-file pin needed handling |
| `cleanupBundleMcpOnRunEnd` | `agent.ts` + `agent.schema.test.ts` + `GatewayModels.swift` + various consumers (runtime/CLI/hooks tests) | ✅ Consumers use the field as regular public bool; baseline now matches generator output |
| Other cure-(15) reverts (`deliveryOrigin`, `plugin-sdk/health`, `plugin-sdk-entrypoints`) | 4 cascade-candidate test files | ✅ 31/31 passing, no hidden cascade-misses |

## Gates green on `6acbda514c`

| Gate | Status |
|------|--------|
| `pnpm tsgo:core` | ✅ exit 0, 0 errors |
| `pnpm tsgo:test` | ✅ exit 0, 0 errors |
| `pnpm lint` (scripts/core/extensions) | ✅ 0/0/0 errors |
| `pnpm test src/gateway/protocol/schema/agent.schema.test.ts` | ✅ 16/16 passed (was 7/8 with the now-dropped assertion failing) |
| Single commit on upstream/main `06a39015f2` | ✅ `git rev-list --count 06a39015f2..HEAD` = 1 |
| Tree-diff squashed-vs-rebased | ✅ byte-empty (proofs-SHA == push-SHA) |

## 24/24 runtime-identical-attest verification

Using 🌊's authoritative PR #84 list (`PROOFS/cac1d3cc01.../README.md` Appendix A): `git diff 3b0eba6adb..6acbda514c -- <file> | grep -c '^@@'` = 0 for all 24 load-bearing continuation surface files. Chain holds from cure-(13) `718d8558eb` → cure-(14a) `cac1d3cc01` → cure-(14b) `aacfb53199` → cure-(15) `6fb0e108bf` → cure-(16) `3b0eba6adb` → cure-(17) `6acbda514c`.

🌊's `1506007222575173682` independent verification cosigned this verification AND ran a wider grep for any `x-openclaw-internal` orphaned pins (4 refs total, all expected; zero orphans on `cleanupBundleMcpOnRunEnd`).

## Cohort cosigns on cure-(17) candidate

- 🩸 cael (Discord `1506007084624252938`) — "2 files, surgical: agent.schema.test.ts assertion removed; GatewayModels.swift 4 refs added at parent-byte positions. 24/24 attest carries through. Gate-fix complete."
- 🌊 ronan (Discord `1506007222575173682`) — "Fuller cascade-grep scope per 🌫 + 🌻 banked canon. 24/24 attest extends. 2-file cascade-fix verified at byte. No orphaned pins on cleanupBundleMcpOnRunEnd remain."
- 🌻 elliott — pending
- 🌫 silas — pending (R-TA-1-RECONFIRM expected post-deploy)

## Fresh deploy-validation for cure-(17)

`deploy-validation/EVIDENCE.md` in this directory captures the cure-(17)-specific deploy across 4 prince hosts.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(17) cascade-fix SHA not ancestor of `COHORT_TARGET_TAG`; runtime-identical-attest to cure-(16) `3b0eba6adb` (also bypassed)").

## Runtime proof corpus chain

- [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — cure-(13) substantive feature proofs (8/8: continuation-live-fire, R-TA-1, R-TA-2, inter-session-targeting, post-compaction-threshold, deploy-validation, gateway-health)
- [`PROOFS/cac1d3cc011cb85c25a63f84c1359e3abaf99540/`](../cac1d3cc011cb85c25a63f84c1359e3abaf99540/) — cure-(14) drift-cure (README with Appendix A 24-file attest + deploy-validation + R-TA-1-RECONFIRM)
- [`PROOFS/6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/`](../6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/) — cure-(15) P1 cleanup (README + deploy-validation + R-TA-1-RECONFIRM)
- [`PROOFS/3b0eba6adbb04df75d70693984ac7e0be67e7df1/`](../3b0eba6adbb04df75d70693984ac7e0be67e7df1/) — cure-(16) drift-cure (README + deploy-validation)
- This corpus — cure-(17) cascade-fix (lean shape: README + deploy-validation; runtime-identical-attest from PR #84 chain forward)

The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(17) `6acbda514c` is **runtime-identical-attest** to every prior cure-SHA in the chain via 24/24 zero-hunks verification.

## Banked canons from this cycle

Cohort surfaced 3 new audit-discipline canons in response to the missed cascade. These are observational substrate-truths from the 5-cure→17-cure arc, banked publicly in Discord for future cohort byte-walks:

- 🌫's canon `1506004917…`: "after a cure-substrate revert, grep for `<unwrapped-symbol>` in test files + protocol contracts to find pinned-cure-shape assertions that need cascading"
- 🌻's canon `1506005995…`: "for future internal/public-shape changes, byte-walk should include `grep -rn 'x-openclaw-internal' --include='*.test.ts' --include='*.swift'` for any field name being moved across the public/internal boundary"
- 🌊's canon `1506004809…`: "fuller `git diff parent..head -- ':!continuation-surface' ':!test'` audit catches cure-substrate-introduced schema-test + Swift baseline pins that the 24-file scope misses"

These complement existing kick_in_the_teeth canons (§ (4) surface-claims, § (5) byte-verify-post-squash, § (9) self-consistency-cascades-on-revert) by naming WHERE to look during the cascade-sweep.
