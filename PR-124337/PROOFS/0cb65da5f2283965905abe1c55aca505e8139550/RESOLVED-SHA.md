# Resolved identities

| Identity | Exact value |
| --- | --- |
| PR #124337 head (executed) | `0cb65da5f2283965905abe1c55aca505e8139550` |
| Back-merge commit | `8853b1ae51cd0487058e0913a550e981a120fba1`: parents `51631e61a238de75ae0207af541b341e6edeac0e` (previous PR head) and `042db1e7064930a08c534c4487864d7bfb8c5287` (upstream main) |
| Test-only follow-ups | `c6cfd25c543583970d086473bdacedfeaf87b353` (import path for upstream's moved dispatch fixtures); `0cb65da5f2283965905abe1c55aca505e8139550` (slack test mocks spread the real modules, for the mock-export ratchet) |
| Control: upstream `openclaw/openclaw` main, second parent of the back-merge (executed) | `042db1e7064930a08c534c4487864d7bfb8c5287` |
| Fork safe branch carrying the head | `karmaterminal/openclaw` `gloss/124337-backmerge-20261011` |
| Previous PR head, preserved as `savegame/20261011T221630Z/pr-124337-pre-backmerge-51631e61a2` | `51631e61a238de75ae0207af541b341e6edeac0e` |
| Previous proof corpus | `b2d5e48e5b59da6d1d29b2bfb7b2af51aee58f0a` |
| pnpm-lock.yaml blob (both trees) | `cdac8854c528e1d54b4c4d08d613997c6b284c1b` |
| Harness sha256 | `boundary-proof.mts` `d433fe2787c514931d48462f06242160c111d4bfde6aedfe942191e49e261645` (unchanged); `proof-rerun.sh` `2fc7b5f8d622502762d22f6491cb41530e5ee44f100de36762fa7b184d2877a7` |
| Node / platform | v26.9.0, Linux aarch64 |
| Run date (UTC) | 2026-10-11, by frond-gloss (Claude Opus 5.5) |

Only `0cb65da5f2`, executed directly, is credited. **No composite or cherry-picked variant is credited.** Tracking: karmaterminal/openclaw#1419.

The published `proof-rerun.sh` differs from the executed copy in one line only: the executed script set `S0` to the scratch directory's absolute path, which the published copy replaces with `S0=${SCRATCH:?…}`. The logs replace that same directory with `<scratch>`.
