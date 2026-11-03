# R-CW-TOKEN at `f15237ec92`: **missing** (corrected 2026-10-31; was pass)

## Correction (2026-10-31, frond-scribe; 🌊 00:31Z)

The earlier fold recorded **pass**. **That rested on an echo.** `TOKEN-HOP2-DONE` was matched 160 ms after the hop-1 work-wake in the journal, too soon for hop 2's model turn. The matched byte was the work-wake echo of the spawn task, not hop 2's reply. The wake itself fired.

**State.** There is no authoritative receipt that hop 2 ran and returned, so this row is now **missing**. No verdict is raised.

The harness now binds this row to product records (docs `codeagent/harness-sentinel-audit`, `ed28bb0e..3283454d`, under independent review); F″ re-fires it.

Source: the sentinel-echo audit (`tools/k6-proofs/AUDIT-sentinel-echo-20261030.md`, docs branch `codeagent/harness-sentinel-audit` @ `ed28bb0e`) and its fix lane's findings, both read from this row's own public receipts. 🌊's ruling: Discord msg 1565885870949531709 (2026-10-31 00:31Z): correct F′ now, keep the original receipts, add this trail; F″ is an independent re-fire, not retroactive evidence for F′.


Bracket/token CONTINUE_WORK path: lightContext subagent emits bare CONTINUE_WORK token at end-of-turn, hop-2 drives.

- Candidate verdict: PASS-candidate
- Review: reviewed: frond-scribe (single seat), 2026-10-30
- Summary: PASS-candidate with complete receipts in matrix-012943Z.
- owner: -
- Canonical run (matrix-012943Z): `20261030T014725Z-r-cw-token-44aa4c89` under `emeric-isolated-composite/`

Runtime and candidate `f15237ec921879d918482cdf372b0718d4c1aab9` on emeric's isolated gateway `:18800` (state `~/proof-gw/comp-f15237ec`, sign-in moved by adopt-auth from comp-08c37a15), docs harness `215235ed73a6926a0610d91814b02f25a4836ed1`. Nothing is transposed from F, P' or the live composite.
