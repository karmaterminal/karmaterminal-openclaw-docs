# Resolved identities

| Identity | Exact value |
| --- | --- |
| Docs base requested for this lane | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` |
| Proof corpus source | `4ff99f7e5c149d90214a3df932f9d5adb438b835` |
| Previous PR head | `d81272c117ef7a2ac765450d682309a941d58463` |
| Protected target PR head | `eee69b3d51c68c76c25c376451c161497e614a2b` |
| Target first parent | `d81272c117ef7a2ac765450d682309a941d58463` |
| Target second parent / exact pinned floor | `6ae89b5a8ed6a1bdbd0d9b7639fc8162afbb7578` |
| Review-time GitHub merge tree | `8934a1d2dae2e8b6f298a52f0d16e556e9e26d90` |
| Merge-tree first parent at creation | `71d4a8c3e305c623aa3ffe92696eec18f116cfc6` |
| Merge-tree second parent | `eee69b3d51c68c76c25c376451c161497e614a2b` |
| Live execution composite | `6e6da7bba079b0fc50d134b96657cda683985837` |
| Proof harness docs seed | `3aeb17c1b3ec55af2aee787702aa6923f06a266b` |
| Proof workflow authority | `6dd6c3a7712c8ae02937a29054525b2ddacb89c1` |
| Original behavioral run | `32652334564` |
| Current-head Mode-B | `33032456154` |
| Exact-floor control | `33033875064` |

GitHub reported the PR base as the pinned floor while the generated merge tree
was created against then-current upstream `71d4a8c3`. Upstream `main` advanced
again during review. The merge-tree receipt is therefore a review-time
snapshot, not a permanent exact-target execution identity.

Ancestry checks reported `ahead` for source to previous, previous to target,
and floor to target. The target commit object independently confirms the
required parent order.
