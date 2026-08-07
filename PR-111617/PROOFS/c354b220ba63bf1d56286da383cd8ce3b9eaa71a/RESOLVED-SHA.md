# Resolved SHA and provenance

| Identity | Exact value |
| --- | --- |
| Deployed candidate | `c354b220ba63bf1d56286da383cd8ce3b9eaa71a` |
| Build string | `OpenClaw 2026.7.2 (c354b22)` |
| Fixed assembly testbed | `ceaf8cba72c48914acd1baf8b6796b5f35fc5f1e` |
| PR #111617 upstream head | `e984f33901598f3017161850adcbc884ed8b5b86` |
| PR #111617 applied commit | `beedc34e3f38135335a595cbc45dae3aaaef2626` |
| PR #111617 stable patch ID | `8237f3fcda1f826e40660aed33ebc12e9b9a2a53` |
| PR #111616 applied commit | `f9e54d68bbc1587549152b169b0fc6b7ef560360` |
| PR #112013 applied/candidate head | `c354b220ba63bf1d56286da383cd8ce3b9eaa71a` |
| Candidate deployment workflow | `karmaterminal/openclaw-bootstrap` run `29859630214` |
| Exact assembly restore workflow | `karmaterminal/openclaw-bootstrap` run `29861596727` |
| Candidate gateway state | active, zero restarts, exact checkout `c354b220...` |
| Restored gateway state | active, zero restarts, exact checkout `ceaf8cba...` |

The three micro-PR patches were applied atomically with their upstream stable
patch IDs preserved. This corpus resolves behavior at the exact combined
runtime SHA and separately binds the PR #111617 source head, applied commit,
and stable patch ID.
