# Resolved identities

| Role | Value |
| --- | --- |
| PR | openclaw/openclaw#121204 |
| Head under test | `3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6`: safe-branch candidate `gloss/121204-backmerge-20261011`, ten commits on top of the second back-merge `edcbb5aec765100f0e34f729b952d3dec128a892` (`a8eafa8d713a0fbce004ac883d7388d5c2556bd5`, `6f029b3c58a67404ef08e60f99bf38caa7b6d409`, `f908ece8734a29745858e9fbf8caaa93147b6f95`, `a05aa8f59632ed315dc2d376a0c42cc6f9a3ba5e`, `2b52673944bfaf209d1bdd70b1f3713c7ab40687`, `1a33c937265fbfbefeb5afd60efe01cb8b10d50c`, `2701bb9be029620fb04684893b40539f28d4ad46`, `f9ffb032bc2987c256fc51f1f58e7f566aab1371`, `1699740f30fadd23497d78fd4c45a7755bbc31f4`, `3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6`). Upstream #121204 pointed at `f9ffb032bc2987c256fc51f1f58e7f566aab1371` when this ran |
| Second back-merge commit | `edcbb5aec765100f0e34f729b952d3dec128a892`: parents `41277c50d231bb848eec5ed56645fc7f08ea70d9` (test-only commit on top of the first back-merge) and `b3c7dc2af7ddb61a71afd169788d846dc37ae2a0` (upstream main) |
| First back-merge commit | `ce67be7d4f83091ea4bf30d7010a3f8dd6c8fa74`: parents `7dfac7ca16e3bb0ad4b4477f68ac4d473984cb30` (previous PR head, the back-merge fast-forward of `2d997a0bcd`) and `042db1e7064930a08c534c4487864d7bfb8c5287` (upstream main) |
| Control (upstream main, second parent of the second back-merge) | `b3c7dc2af7ddb61a71afd169788d846dc37ae2a0` |
| Previous proof corpora | `edcbb5aec765100f0e34f729b952d3dec128a892` (same control); `41277c50d231bb848eec5ed56645fc7f08ea70d9` (control `042db1e706`); `2d997a0bcd9b7eb104b1890699cf20f90e45ba17` (also holds the intermediate-head runs, not repeated here) |
| pnpm-lock.yaml blob (both trees) | `cdac8854c528e1d54b4c4d08d613997c6b284c1b` |
| Harness sha256 | `recovery-proof.mts` `a1ab2b3a35735328644a5187809a870650c3aeb3b2396683c2ef234c27101f17`; `mock-discord.mts` `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f` (both unchanged from `2d997a0bcd`); `proof-rerun.sh` `49e18f781e35879b3cebaf9d6d79ae4c5c5e60d0e597577e656547ef9c31a26c` |
| Node | v26.9.0, Linux aarch64 |
| Run date (UTC) | 2026-10-12 |
| Run by | frond-gloss (Claude Opus 5.5) |
| Transport | production Discord REST client + `GatewayPlugin` over real loopback HTTP / WebSocket to a local mock Discord (`DISCORD_API_URL` override) |

The published `proof-rerun.sh` differs from the executed copy in one line only: the executed script set `S0` to the scratch directory's absolute path, which the published copy replaces with `S0=${SCRATCH:?…}`. The logs contain no scratch path.
