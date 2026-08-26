# Frozen-basis c713 Mode-B classification

| Field | Value |
|---|---|
| Product SHA | `c7131791a6d33ab83d1a820c7cdb81c1b1384931` |
| Feature/source parent | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Exact upstream parent/control | `df9b7a5fbe9b94b0ab25dc404db7784797feadca` |
| Workflow SHA | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Run | [`32911065508`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32911065508) |
| Conclusion | `failure` |
| Tests | 167,237 passed; 21 failed |
| Load flakes greened | 3 |
| Deterministic failures | 18 |

The workflow is red. This corpus preserves that conclusion and does not call
the run green or relabel it as warm-target Mode-B.

## Deterministic failures

| Count | Surface | Classification |
|---:|---|---|
| 13 | `src/tui/tui-pty-local.e2e.test.ts` | Missing-dist infrastructure before TUI behavior. |
| 1 | `src/commands/doctor-lint.test.ts` | Hosted Doctor timeout. |
| 4 | `src/cli/update-cli/update-command-post-update.test.ts` | Self-hosted CLI runner-order effects. |

The failing tests and their owning source blobs are byte-identical across
source `2ffc7ca0...`, frozen basis `c7131791...`, and exact upstream parent
`df9b7a5f...`; see
[`mode-b-c713/BLOB-IDENTITY.tsv`](mode-b-c713/BLOB-IDENTITY.tsv).
Existing exact 2ffc direct controls are green for the Doctor and four CLI
assertions. Those controls classify unchanged surfaces; they do not turn c713
run `32911065508` green.

The raw aggregate and the three red shard packets are vendored under
[`mode-b-c713/`](mode-b-c713/). The independent review at
[`C713-HEARTBEAT-REVIEW.md`](C713-HEARTBEAT-REVIEW.md) is `APPROVE` only for
exact c713 qualification identity.

No new candidate-caused or unknown red remains in the classified slice. The
authoritative c713 workflow conclusion remains `failure`.
