# Cohort 2026-06-01 PROOFS-cycle bridge-fires from silas-seat on pre-cure binary

**Cohort context**: 2026-06-01 PROOFS-cycle drove deploys of uncurse-tip `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3` to 4-of-5 prince-seats (cael DGX Spark ARM64, ronan DGX Spark ARM64, emeric NUC, elliott sunflower — all SUCCESS). 🌫 silas-seat (lothric, Intel i9-14900KS Raptor Lake-Refresh hybrid) FAILED 3x at the deploy.sh `tsdown` step — V8 SIGILL + SIGSEGV + Go-tsgo SIGSEGV across multiple retry-attempts, even with `NODE_OPTIONS=--no-maglev` runner-env cure. Lothric multi-layer Raptor-Lake-build-pipeline-incompatibility on uncurse-tip; sat the PROOFS-cycle on pre-cure binary `0dff94dbe4875a3b7ed44c60a9097a5f55083572`.

**Bridge-fires substrate-class**: 🌫 silas DID fire `continue_work` and `request_compaction` live at silas-seat during the PROOFS-cycle window — but on the pre-cure binary `0dff94d`, not on uncurse-tip. These receipts validate pre-cure binary's tool-surface + rate-gate semantics, NOT uncurse-tip's.

**Why this matters for the `7522d6c60f` corpus**:
- The `7522d6c60f` PROOFS corpus had these silas-on-pre-cure fires folded as "second-validation-axis" or "cohort-cross-prince substrate" — that was substrate-CONTAMINATION (figs caught at byte: msg `1511188370`).
- The PROOFS-set for `7522d6c60f` was promoted to ✅ PROVEN partly on the basis of these cross-SHA fires; that promotion was substrate-confused.
- This README + the bridge-fires files cleanly re-locate silas's receipts to their actual SHA (`0dff94d`) and frame them as **byte-identity-bridge axis** for uncurse-tip's rate-gate validation — NOT live-fire receipts at uncurse-tip.

**Byte-identity-bridge argument** (separately stated in `PROOFS/7522d6c60f.../R-RC-1.SUBSTRATE-BYTE-IDENTITY-BRIDGE.md`):
- `git diff <pre-Track-A>..7522d6c60f -- src/auto-reply/continuation/request-compaction-tool.ts` returns empty.
- Cure-stack Track A + Track B + Track C touched only outbound channel-monitor sanitization paths; the rate-gate substrate is unmodified.
- Therefore the silas-on-pre-cure REJECT receipts validate the rate-gate semantics that uncurse-tip inherits unchanged. This is substrate-bridge evidence, not direct-at-SHA evidence.

**Per-row substrate-class**:
- `R-CW-1-silas-direct-fire/silas-seat-direct-fire.md` — silas's continue_work direct-fire receipts at silas-seat on `0dff94d`. Substrate-bridge for uncurse-tip's continue_work substrate.
- `R-RC-1-silas-direct-fire/` — silas's two REJECT receipts at 25% + 47% context-pressure (Discord msgs `1511136699` + second-fire `d18397c`) at silas-seat on `0dff94d`. Substrate-bridge for uncurse-tip's request_compaction REJECT-path substrate.

**Cohort substrate-receipts**:
- figs catch: msg `1511188370` "This proofs set is invalid, mixed SHA"
- ronan converge: msg `1511188556`
- cael cure-driver: msg `1511188671`

