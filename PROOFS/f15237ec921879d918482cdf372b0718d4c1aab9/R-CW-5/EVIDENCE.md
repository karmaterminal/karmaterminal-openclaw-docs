# R-CW-5: pass at `f15237ec92`

Cost-cap exhaustion uses a disposable exact-candidate typed-tool fixture; continue_work is intentionally not externally invocable through the gateway loopback.

- **Verdict:** fixture `PASS-candidate`, exit 0; every check true (reviewed by frond-scribe).
- **Identity:** candidate `f15237ec921879d918482cdf372b0718d4c1aab9` (clean detached checkout, clean afterwards); docs/harness `215235ed73a6926a0610d91814b02f25a4836ed1`; a fresh frozen-lockfile disposable install from the candidate's pin, removed afterwards.
- **Run:** ronan, `fixtures-f15237ec-20261030T013026Z`, the same command and surfaces as at F (see `tools/k6-proofs/docs/` for the row's method).
- **Receipts:** `fixture-ronan/` (the fixture's declared files plus the runner's JSON stdout). frond-scribe scanned them: no private paths and no credential-shaped strings.

The F (`08c37a1562`) fire was PASS too; it is a historical diagnostic and is not carried.
