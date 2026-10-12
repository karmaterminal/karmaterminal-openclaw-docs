# Resolved identities

| Role | Value |
| --- | --- |
| PR | openclaw/openclaw#121204 |
| Head under test | `edcbb5aec765100f0e34f729b952d3dec128a892`: second back-merge, parents `41277c50d231bb848eec5ed56645fc7f08ea70d9` (previous head, test-only commit on top of the first back-merge) and `b3c7dc2af7ddb61a71afd169788d846dc37ae2a0` (upstream main) |
| First back-merge commit | `ce67be7d4f83091ea4bf30d7010a3f8dd6c8fa74`: parents `7dfac7ca16e3bb0ad4b4477f68ac4d473984cb30` (previous PR head, the back-merge fast-forward of `2d997a0bcd`) and `042db1e7064930a08c534c4487864d7bfb8c5287` (upstream main) |
| Control (upstream main, second parent of the second back-merge) | `b3c7dc2af7ddb61a71afd169788d846dc37ae2a0` |
| Previous proof corpora | `41277c50d231bb848eec5ed56645fc7f08ea70d9` (control `042db1e706`); `2d997a0bcd9b7eb104b1890699cf20f90e45ba17` (also holds the intermediate-head runs, not repeated here) |
| pnpm-lock.yaml blob (both trees) | `cdac8854c528e1d54b4c4d08d613997c6b284c1b` |
| Harness sha256 | `recovery-proof.mts` `a1ab2b3a35735328644a5187809a870650c3aeb3b2396683c2ef234c27101f17`; `mock-discord.mts` `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f` (both unchanged from `2d997a0bcd`); `proof-rerun.sh` `2c20b0c1c53d2b48755d96a59aab16054876fab438897ddbf57c2b7738327b30` |
| Node | v26.9.0, Linux aarch64 |
| Run date (UTC) | 2026-10-12 |
| Run by | frond-gloss (Claude Opus 5.5) |
| Transport | production Discord REST client + `GatewayPlugin` over real loopback HTTP / WebSocket to a local mock Discord (`DISCORD_API_URL` override) |

The published `proof-rerun.sh` differs from the executed copy in one line only: the executed script set `S0` to the scratch directory's absolute path, which the published copy replaces with `S0=${SCRATCH:?…}`. The logs replace that same directory with `<scratch>`.
