# Gate 2.7 independent consistency review

An independent read-only review recomputed the public ledger and attempted to
falsify its only restore decision.

- Geometry: 346 current, 317 prior, 310 shared, 36 current-only, seven
  prior-only.
- Coverage: 346 unique dispositions, zero duplicates, zero missing, zero
  extra.
- Dispositions: 345 `KEEP`, one `RESTORE`.
- Set identities:
  - shared intersect current-only is empty;
  - shared union current-only equals the current set;
  - shared union prior-only equals the prior set.
- Every hash in `gate-2.7-hashes.sha256` verified.

The review confirmed the `RESTORE` for
`extensions/telegram/src/bot-message-dispatch.context-recovery.test.ts`.
Accepted commit `cdeda3282965ffc2ec72dff7a92e9f36c702d3e9` added canonical current
message fixture fields. Frozen commit
`f5a8cb02ea0ac6def99e18770b578e861095a165` independently added an
anti-spoof assertion. The final candidate keeps the attack fixture and accepted
fields but drops the compatible assertion. It is a real regression-coverage
loss, not a redundant spelling difference.

The immutable presentation therefore cannot pass acceptance without product
motion. No live row was authorized or fired.
