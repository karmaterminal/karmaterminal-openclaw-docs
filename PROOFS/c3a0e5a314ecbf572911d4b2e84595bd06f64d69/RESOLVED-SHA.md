# Resolved SHA and gates

| Identity | Value |
|---|---|
| Pure continuation / PR-presentation | `c3a0e5a314ecbf572911d4b2e84595bd06f64d69` |
| Runtime composite | `46f4d2115700d574501bb3c4763abf6b2ba977fe` |
| Proof harness | `51a6f65b625d3dbe347f44df19c914acdd2bc488` |
| Frozen upstream | `4589d8514ce189b4adb8f0cf20b2a23ae92902d5` |
| Primary proof run | [32231533500](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32231533500) |
| Supplemental trace run | [32230009131](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32230009131) |
| Fleet CI | [32209969307](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32209969307) |

## Gate receipts

- Gate 2 feature-core receipt is preserved under `gates/gate-2-feature-cores.log`.
- Gate 2.5 enumerated 1,940 upstream-changed test/support files and 97 candidate intersections; the repaired focused surface passed 103/103 and `pnpm check` passed.
- Gate 2.7 classified 905 files: 596 GENUINE, 283 SAFE-NEW, 26 reviewed MIXED-CLOBBER, 0 FROZEN-STALE, 0 unresolved.
- Exact fleet CI recorded 157,772 passing tests. Its sole deterministic IPv6 portal-proxy failure reproduced identically on candidate, frozen upstream, and current upstream and is classified inherited upstream-class.
- Assembly and PR-presentation were advanced by ordinary fast-forward only.
