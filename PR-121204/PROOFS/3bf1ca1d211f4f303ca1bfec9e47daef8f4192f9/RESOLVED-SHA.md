# Resolved identities

| Identity | Full SHA | Role |
| --- | --- | --- |
| Accepted feature source | `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` | Behavior and corpus identity |
| Installed execution composite | `6e6da7bba079b0fc50d134b96657cda683985837` | Rune execution context |
| Hybrid-CI workflow head | `ee5182f6954d8f38e94c8baeb339d96172419f3a` | Workflow implementation for run `32649941654` |

The accepted source is not an ancestor of the composite. The composite carries
reviewed replays plus later treatments, so exact-source claims require
row-specific byte and assertion mapping rather than ancestry.

For every row, the installed checkout and runtime build-info commit both
resolved to the exact composite. Rune did not move an OpenClaw branch and this
corpus does not claim source-SHA execution on Rune.
