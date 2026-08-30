# Mode-B run 33318993673

**Broad acceptance: FAIL.**

| Identity | Value |
| --- | --- |
| Product input | `6feda9fd71c7cb4701af63ab54264009ce5f6afb` |
| Workflow `headSha` | `d05778e6a96dd9a96946eff483e80c4d9ff9575e` |
| Workflow ref | `codeagent/124337-feac2430-routing-independent-review-20260829` |
| Run | `33318993673` |
| Window | `2026-08-30T15:12:34Z` to `2026-08-30T16:10:23Z` |
| Routing | 167/167 shards; 69/69 routed-job receipts valid |
| Tally | 179,809 passed; 25 failed; five load-flakes greened |
| Deterministic failures | 20 |

The unchanged workflow summaries are
[`artifacts/mode-b-33318993673/summary.md`](artifacts/mode-b-33318993673/summary.md)
and
[`artifacts/mode-b-33318993673/summary.json`](artifacts/mode-b-33318993673/summary.json).
They, not this digest, are the enumeration authority.

## Failure classification

| Shard | Deterministic failures | Failed test blob at candidate vs pinned upstream `43a7cb3c` | Candidate-delta intersection | Classification |
| --- | ---: | --- | --- | --- |
| `core-runtime-tui-pty` | 4 | equal for both failed files | none | inherited absorbed-upstream surface; broad-red |
| `agentic-plugins` | 1 | equal | none | inherited absorbed-upstream surface; broad-red |
| `agentic-gateway-core-runtime` | 2 | equal for both failed files | none; files did not exist at component base | introduced by absorbed upstream; broad-red |
| `core-tooling-5` | 6 | equal | none | inherited absorbed-upstream surface; broad-red |
| `core-tooling-7` | 5 | equal | none | inherited absorbed-upstream surface; broad-red |
| `agentic-gateway-methods` | 1 | equal | none | inherited absorbed-upstream surface; broad-red |
| `extension-telegram` | 1 | equal | none | inherited absorbed-upstream surface; broad-red |

The exact failed test blobs were compared at:

- candidate `6feda9fd71c7cb4701af63ab54264009ce5f6afb`;
- pinned absorbed upstream `43a7cb3c92c7b5b8d5ddd56d9d157c009e0c85e5`;
- pre-absorb component `eee69b3d51c68c76c25c376451c161497e614a2b`;
- component/upstream merge base
  `6ae89b5a8ed6a1bdbd0d9b7639fc8162afbb7578`.

All nine failed test files are byte-identical between candidate and pinned
absorbed upstream. None is among the candidate's 12 changed paths, which are
limited to shared channel ingress, Plugin SDK fan-in, three channel siblings,
their tests, and the lane journal. The two gateway tests are absent from the
pre-absorb component and merge base.

This is provenance classification, not an upstream baseline execution. No red
was repaired or waived, and the Mode-B gate remains failed. The exact transport
rows are independently supported because Mode-B's `channels`,
`extension-discord`, and `agentic-plugin-sdk` shards all passed, but those green
shards do not convert the broad result to acceptance.

