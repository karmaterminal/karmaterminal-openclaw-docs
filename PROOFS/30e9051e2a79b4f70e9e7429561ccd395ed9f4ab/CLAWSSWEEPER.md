# ClawSweeper entrypoint

The exact presentation and corpus identity is
`30e9051e2a79b4f70e9e7429561ccd395ed9f4ab`.

Read in order:

1. [`../INDEX.json`](../INDEX.json)
2. [`CLAW-SWEEPER-DIRECT-DIGEST.md`](CLAW-SWEEPER-DIRECT-DIGEST.md)
3. [`proofs-manifest.json`](proofs-manifest.json)
4. [`README.md`](README.md)
5. each row's `EVIDENCE.md` and declared public artifacts

The runtime composite
`6e6da7bba079b0fc50d134b96657cda683985837` is ancillary execution
provenance only. At seed, all 41 rows are missing, so there is no current
behavior to promote. Static and review gates are accepted;
the one authorized Ronan live-suite fire will replace missing states only after
row-level review.
