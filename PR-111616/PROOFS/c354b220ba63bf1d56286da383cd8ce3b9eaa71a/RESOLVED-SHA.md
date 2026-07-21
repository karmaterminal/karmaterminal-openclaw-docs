# Resolved SHA and provenance

| Identity | Exact value |
| --- | --- |
| Deployed candidate | `c354b220ba63bf1d56286da383cd8ce3b9eaa71a` |
| Build string | `OpenClaw 2026.7.2 (c354b22)` |
| Fixed assembly testbed | `ceaf8cba72c48914acd1baf8b6796b5f35fc5f1e` |
| PR #111616 upstream head | `3c40b70ee7c7a2151c7365b0471cacc34ae1da35` |
| PR #111616 applied commit | `f9e54d68bbc1587549152b169b0fc6b7ef560360` |
| PR #111616 stable patch ID | `e7541e4a27ed3a36729b7ebf05c69d9dbb075b38` |
| PR #111617 applied commit | `beedc34e3f38135335a595cbc45dae3aaaef2626` |
| PR #112013 applied/candidate head | `c354b220ba63bf1d56286da383cd8ce3b9eaa71a` |
| Candidate deployment workflow | `karmaterminal/openclaw-bootstrap` run `29859630214` |
| Exact assembly restore workflow | `karmaterminal/openclaw-bootstrap` run `29861596727` |
| Candidate gateway state | active, zero restarts, exact checkout `c354b220...` |
| Restored gateway state | active, zero restarts, exact checkout `ceaf8cba...` |

The three micro-PR patches were applied atomically with their upstream stable
patch IDs preserved. This corpus resolves behavior at the exact combined
runtime SHA and separately binds the PR #111616 source head, applied commit,
and stable patch ID.
