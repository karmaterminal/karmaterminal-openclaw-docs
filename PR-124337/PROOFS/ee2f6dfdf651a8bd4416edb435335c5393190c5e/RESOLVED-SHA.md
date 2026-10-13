# Resolved identities

| Identity | Exact value |
| --- | --- |
| Safe-branch candidate (executed) | `ee2f6dfdf651a8bd4416edb435335c5393190c5e`: six commits on `0cb65da5f2283965905abe1c55aca505e8139550` (`e682f7cc17fdbc34f299b6703e11aa23d90c120c`, `7cab4e61ebdd02f2ba425cff6682615496b48417`, `2b67393ddd938d0d472f319bb97d058c3f34a6fa`, `5c214fa2a44209073085f750317762df03ff78a4`, `cd45f79821c23499bc3e7735453a131976c6a880`, `ee2f6dfdf651a8bd4416edb435335c5393190c5e`). Upstream #124337 pointed at `e682f7cc17fdbc34f299b6703e11aa23d90c120c` when this ran |
| Back-merge commit | `8853b1ae51cd0487058e0913a550e981a120fba1`: parents `51631e61a238de75ae0207af541b341e6edeac0e` (previous PR head) and `042db1e7064930a08c534c4487864d7bfb8c5287` (upstream main) |
| Test-only follow-ups | `c6cfd25c543583970d086473bdacedfeaf87b353` (import path for upstream's moved dispatch fixtures); `0cb65da5f2283965905abe1c55aca505e8139550` (slack test mocks spread the real modules, for the mock-export ratchet) |
| Control: upstream `openclaw/openclaw` main, second parent of the back-merge (executed) | `042db1e7064930a08c534c4487864d7bfb8c5287` |
| Fork safe branch carrying the head | `karmaterminal/openclaw` `gloss/124337-backmerge-20261011` |
| Previous PR head, preserved as `savegame/20261011T221630Z/pr-124337-pre-backmerge-51631e61a2` | `51631e61a238de75ae0207af541b341e6edeac0e` |
| Previous proof corpora | `0cb65da5f2283965905abe1c55aca505e8139550`; `b2d5e48e5b59da6d1d29b2bfb7b2af51aee58f0a` |
| pnpm-lock.yaml blob (both trees) | `cdac8854c528e1d54b4c4d08d613997c6b284c1b` |
| Harness sha256 | `boundary-proof.mts` `d433fe2787c514931d48462f06242160c111d4bfde6aedfe942191e49e261645` (unchanged); `proof-rerun.sh` `f433bee0eb70d4d8b9e60db1431c6b9f39347babc35b46d4f2225d8c6c2f3b9e` |
| Node / platform | v26.9.0, Linux aarch64 |
| Run date (UTC) | 2026-10-13, by frond-gloss (Claude Opus 5.5) |

Only `ee2f6dfdf6`, executed directly, is credited. **No composite or cherry-picked variant is credited.** Tracking: karmaterminal/openclaw#1419.

The published `proof-rerun.sh` differs from the executed copy in one line only: the executed script set `S0` to the scratch directory's absolute path, which the published copy replaces with `S0=${SCRATCH:?…}`. The logs contain no scratch path.
