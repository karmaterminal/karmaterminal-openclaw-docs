# Exact-target GATES receipt

| Field | Value |
|---|---|
| Final candidate | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Feature parent | `6b6f4db79ba5143f2a56e759abe111478bf6c8a5` |
| Ordinary upstream parent | `4da57168d3c1970419e93e59a91e65466518231b` |
| Merge base | `1ba243c88ed800986909bc50e4ce7b8139891b94` |
| Canonical GATES tooling | `karmaterminal/openclaw-bootstrap@342cc9c6d190e1ba57d9995d29e394c993a3e79b` |

## Exact receipts

- **Gate 2:** 40/40 primitive-core invariants; one exact-upstream projection;
  three tombstones; zero failures and zero empty patterns. Raw receipt:
  [`gate-2-feature-cores.log`](gate-2-feature-cores.log).
- **Gate 2.5:** 193 upstream-touched test files enumerated; the seven
  candidate-overlap files passed 656/656 assertions through their owning shard
  configs, serially. Raw receipt:
  [`gate-2.5-overlap-tests.log`](gate-2.5-overlap-tests.log).
- **Gate 2.7:** 948 files; 648 `GENUINE`; 300 `SAFE-NEW`; zero
  `FROZEN-STALE`; zero `MIXED-CLOBBER`; zero dropped lines. Raw receipt:
  [`gate-2.7-classification.tsv`](gate-2.7-classification.tsv).
- **Heartbeat conflict owner proof:** five files and 67 assertions green.
  Read-only review verdict `APPROVE`; no repository mutation. Receipt:
  [`HEARTBEAT-MERGE-REVIEW.md`](HEARTBEAT-MERGE-REVIEW.md).
- **Exact normal clone:** frozen install, production types, full test types,
  complete check, full build, and clean tracked tree. Receipt:
  [`NORMAL-CLONE.md`](NORMAL-CLONE.md).
- **Mode-B:** run
  [`32895790947`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32895790947)
  at workflow SHA `342cc9c6…`; 165,696 passed, 39 failed, nine load flakes
  greened, and 32 deterministic failures. The conclusion remains `failure`.
  Classification: [`MODE-B.md`](MODE-B.md).

These are exact pure-target gates. They do not convert historical live
execution on `37300f29…` into an exact-target claim. Descendant runtime
`a48c475b…` remains pending live proof.
