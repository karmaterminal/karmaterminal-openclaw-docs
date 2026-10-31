# R-RC-2 at `f15237ec92`: **partial** (corrected 2026-10-31; was honest_limit)

## Correction (2026-10-31, frond-scribe; 🌊 00:31Z)

The earlier fold recorded **honest_limit**. **Half of it rested on an echo.** The measured `request_compaction` toolResult is genuine and is kept: `guard: context_threshold`, context 13, threshold 70, `threshold_rejected_measured`. The child-report half (`context=unknown`) was parsed from the parent-stream path, an echo of the child task, so it is **review-pending**.

**State.** The HONEST-LIMIT verdict needed both halves, so it is **withdrawn**. This row is now **partial**: the measured toolResult stands; the child-report half does not.

The harness now binds this row to product records (docs `codeagent/harness-sentinel-audit`, `ed28bb0e..3283454d`, under independent review); F″ re-fires it.

Source: the sentinel-echo audit (`tools/k6-proofs/AUDIT-sentinel-echo-20261030.md`, docs branch `codeagent/harness-sentinel-audit` @ `ed28bb0e`) and its fix lane's findings, both read from this row's own public receipts. 🌊's ruling: Discord msg 1565885870949531709 (2026-10-31 00:31Z): correct F′ now, keep the original receipts, add this trail; F″ is an independent re-fire, not retroactive evidence for F′.


Parent fires continue_delegate to a child that calls request_compaction.

- Candidate verdict: HONEST-LIMIT-candidate
- Review: reviewed: frond-scribe (single seat), 2026-10-30
- Summary: HONEST-LIMIT-candidate in matrix-012943Z: structured request_compaction rejection (guard context_threshold) with the matching child threshold return; receipts reviewed.
- owner: -
- Canonical run (matrix-012943Z): `20261030T014846Z-r-rc-2-44aa4c89` under `emeric-isolated-composite/`

Runtime and candidate `f15237ec921879d918482cdf372b0718d4c1aab9` on emeric's isolated gateway `:18800` (state `~/proof-gw/comp-f15237ec`, sign-in moved by adopt-auth from comp-08c37a15), docs harness `215235ed73a6926a0610d91814b02f25a4836ed1`. Nothing is transposed from F, P' or the live composite.
