# Resolved SHA and provenance

| Identity | Exact value |
| --- | --- |
| Deployed candidate | `c354b220ba63bf1d56286da383cd8ce3b9eaa71a` |
| Build string | `OpenClaw 2026.7.2 (c354b22)` |
| Fixed assembly testbed | `ceaf8cba72c48914acd1baf8b6796b5f35fc5f1e` |
| PR #112013 upstream head | `5ab2aa8a87d03ebcc2b8e96dc125af6569c8daa6` |
| PR #112013 applied/candidate commit | `c354b220ba63bf1d56286da383cd8ce3b9eaa71a` |
| PR #112013 stable patch ID | `3d424d8368129a70ac2d6ab381b8e3c3dd9e9634` |
| PR #111616 applied commit | `f9e54d68bbc1587549152b169b0fc6b7ef560360` |
| PR #111617 applied commit | `beedc34e3f38135335a595cbc45dae3aaaef2626` |
| Candidate deployment workflow | `karmaterminal/openclaw-bootstrap` run `29859630214` |
| Exact assembly restore workflow | `karmaterminal/openclaw-bootstrap` run `29861596727` |
| Candidate gateway state | active, zero restarts, exact checkout `c354b220...` |
| Restored gateway state | active, zero restarts, exact checkout `ceaf8cba...` |

The three micro-PR patches were applied atomically with their upstream stable
patch IDs preserved. This corpus resolves behavior at the exact combined
runtime SHA and separately binds the PR #112013 source head, applied commit,
and stable patch ID.
