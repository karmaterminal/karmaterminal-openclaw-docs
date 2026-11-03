# R-CW-6: pass at `08c37a1562`

The max-chain boundary uses a disposable exact-candidate runtime fixture; continue_work is intentionally not externally invocable through the gateway loopback.

- **Verdict:** fixture `PASS-candidate`, exit 0; every check true (reviewed by frond-scribe).
- **Identity:** candidate `08c37a15621790d8bd20ebdaa42d16a65b4059c3` (clean detached checkout, clean afterwards); docs/harness `860bd4ec2a8aac2c0442fc3bcdea9aba087d3b19`; pnpm 12.15.0 from the candidate's pin, in a fresh frozen-lockfile disposable install, removed afterwards.
- **Run:** ronan, `fixtures-08c37a15-20261029T213429Z`, the same command and surfaces as at P' (see `tools/k6-proofs/docs/` for the row's method).
- **Receipts:** `fixture-ronan/` (the fixture's declared files plus the runner's JSON stdout). frond-scribe scanned them: no private paths and no credential-shaped strings.

The P' (`8ba08c76d8`) fire was PASS too; it is a historical diagnostic and is not carried.
