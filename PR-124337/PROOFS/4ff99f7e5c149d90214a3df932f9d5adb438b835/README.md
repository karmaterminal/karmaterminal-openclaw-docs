# PR #124337 exact-source proof corpus

This corpus is bound to accepted feature source
`4ff99f7e5c149d90214a3df932f9d5adb438b835`. The executing runtime is the
separately disclosed composite
`6e6da7bba079b0fc50d134b96657cda683985837`.

No row may claim that a prince ran the source SHA. Each live receipt must bind
both identities and verify the installed checkout plus `dist/build-info.json`
before executing.

## Verdict

**PASS.** Bootstrap run
[32652334564](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32652334564)
executed the corpus harness on Emeric. Before each row, the harness verified
that both the installed checkout and `dist/build-info.json` resolved to exact
composite `6e6da7bba079b0fc50d134b96657cda683985837`.

| Row | Contract | State |
| --- | --- | --- |
| `A-GENUINE-ABANDONMENT` | Genuine pre-adoption abandonment spent attempts `0,1,2`, terminalized as `retry-limit-exceeded` / `turn-abandoned`, retained its payload, and released the same-lane follower. | pass |
| `B-BUDGET-FREE-CANCELLATION` | Three explicit cancellations preserved attempts `1`, last-attempt `10000`, and `prior-proof-failure`; no failed or claimed row remained. | pass |
| `C-MIXED-FANIN-SEPARATION` | Three capable+legacy fan-in cancellations left both rows pending at attempts `0`; a separate genuine abandonment terminalized and its follower completed. | pass |

The folded artifacts contain public-safe receipts, bounded journals, raw
SQLite row projections, and hashes of the synthetic databases. They contain no
provider/channel credentials, message bodies, account identifiers, hostnames,
or private acquisition paths.

## Files

- [`METHOD.md`](METHOD.md)
- [`RESOLVED-SHA.md`](RESOLVED-SHA.md)
- [`SOURCE-COMPOSITE-NON-INTERFERENCE.md`](SOURCE-COMPOSITE-NON-INTERFERENCE.md)
- [`proofs-manifest.json`](proofs-manifest.json)
- [`harness.mjs`](harness.mjs)
- [`artifacts/run-32652334564/run-summary.json`](artifacts/run-32652334564/run-summary.json)
