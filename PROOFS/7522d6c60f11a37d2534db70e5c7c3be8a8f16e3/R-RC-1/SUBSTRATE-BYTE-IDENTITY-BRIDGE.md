# R-RC-1 substrate-byte-identity bridge to pre-cure binary

**Bridge-axis**: silas-seat direct `request_compaction` fire on pre-cure binary `0dff94dbe4875a3b7ed44c60a9097a5f55083572`. Two REJECT receipts at 25% + 47% context-pressure, both via `context_threshold` guard. NOT fires at uncurse-tip `7522d6c60f`.

See [`PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/R-RC-1-silas-direct-fire/`](../../0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/R-RC-1-silas-direct-fire/) for the receipt substrate (SUBSTRATE-FINDING.md + fire-receipt.txt).

**Why this is cross-walk substrate-additive for uncurse-tip R-RC-1**:
- The request_compaction rate-gate source-file `src/auto-reply/continuation/request-compaction-tool.ts` is byte-identical pre-cure vs uncurse-tip. Cure-stack Track A/B/C touched only sanitization-layer files; the rate-gate predicate + REJECT/ACCEPT branches are unmodified. Verify: `git diff <pre-Track-A>..7522d6c60f -- src/auto-reply/continuation/request-compaction-tool.ts` returns empty.
- Silas's REJECT receipts at two different context-load levels (25% + 47%) demonstrate the gate-fires-consistently-under-threshold for the rate-gate semantics that uncurse-tip inherits unchanged.

**Why this is NOT a substitute for live at-SHA fire**:
- Same as R-CW-1 above — bridge doesn't validate the bridge condition. The agent-runner tool-registration regression at uncurse-tip means request_compaction is not exposed as function-tool from main-session; the live receipt cannot be reproduced at uncurse-tip until the regression is cured (see `FINDINGS/agent-runner-continuation-tool-regression.md`).

**Verdict-shape**:
- R-RC-1 at uncurse-tip validated by: cael substrate-byte-walk (source-file unmodified through cure-stack) + silas REJECT receipts on pre-cure (byte-identity-bridge for the predicate semantics) + git-diff-empty argument bridging the two axes.
- ⚠️ HONEST-LIMIT on live at-SHA fire: blocked by the tool-registration regression (separate finding). Re-fire post-regression-cure on a seat at `7522d6c+regression-cure` would close the bridge with direct evidence.
