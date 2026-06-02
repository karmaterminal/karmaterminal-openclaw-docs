# R-CW-1 substrate-byte-identity bridge to pre-cure binary

**Bridge-axis**: silas-seat direct `continue_work` fire on pre-cure binary `0dff94dbe4875a3b7ed44c60a9097a5f55083572`. NOT a fire at uncurse-tip `7522d6c60f`.

See [`PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/R-CW-1-silas-direct-fire/`](../../0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/R-CW-1-silas-direct-fire/) for the receipt substrate.

**Why this is cross-walk substrate-additive for uncurse-tip R-CW-1**:
- The continue_work tool source-file at `src/auto-reply/continuation/continue-work-tool.ts` is byte-identical pre-cure vs uncurse-tip (cure-stack Track A/B/C touched only sanitization-layer files in `src/auto-reply/reply/session-system-events.ts` + `src/infra/system-events.ts` + 21 `extensions/*/monitor/*` files; verify: `git diff <pre-Track-A>..7522d6c60f -- src/auto-reply/continuation/continue-work-tool.ts` returns empty).
- Silas's direct-fire receipts therefore validate the continue_work semantics that uncurse-tip would inherit IF the tool-surface were exposed at uncurse-tip (which it currently isn't due to the agent-runner tool-registration regression — see `FINDINGS/agent-runner-continuation-tool-regression.md`).

**Why this is NOT a substitute for live at-SHA fire**:
- Live at-SHA continue_work fire would also exercise the agent-runner-init path that supplies `continueWorkOpts` to `createOpenClawTools()`. At uncurse-tip, that supply path is broken (the FINDING). Substrate-byte-identity-bridge cannot validate the bridge condition itself; only the source-file-semantics on each side of the bridge.
- ✅ at-SHA fire-receipt for R-CW-1 at uncurse-tip is the cael continue_delegate proxy + Tempo traces in this row's `proof.md`. That validates the functional-equivalent-surface-actually-exposed at uncurse-tip.

**Verdict-shape**:
- R-CW-1 at uncurse-tip validated by: cael continue_delegate functional-proxy (live at-SHA) + silas continue_work direct-fire on pre-cure (byte-identity-bridge) + source-file byte-identity argument bridging the two.
