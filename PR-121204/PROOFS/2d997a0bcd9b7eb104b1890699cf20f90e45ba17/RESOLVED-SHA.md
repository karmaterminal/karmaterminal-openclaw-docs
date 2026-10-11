# Resolved identities

| Role | Value |
| --- | --- |
| PR | openclaw/openclaw#121204 |
| Head under test | `2d997a0bcd9b7eb104b1890699cf20f90e45ba17` |
| Control (series merge base, upstream main at rebase) | `ca43d19197888f3d42237b4425f08a473779266f` |
| Intermediate heads | scenario C: `fbef5fda32fd284fb6dc8b19f20c6f778c77bf09`, `08d7a0292cac17ad21a24ce1ff173b8ee31d6342`; scenario D: `cdef5a1d956ac04f9b006c9295ed1e4ea9131e77` |
| pnpm-lock.yaml blob (all five trees) | `eb9be2e161593e0cf28bd1337cd9453f9c37d3eb` |
| Harness sha256 | `recovery-proof.mts` `a1ab2b3a35735328644a5187809a870650c3aeb3b2396683c2ef234c27101f17`; `mock-discord.mts` `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f`; `run-all.sh` `15f89d1f4e33329cd9c1af50b882f4e1581771847a3b7cd914d4af900219c86d` |
| Node | v26.9.0 |
| Run date (UTC) | 2026-10-06 |
| Transport | production Discord REST client + `GatewayPlugin` over real loopback HTTP / WebSocket to a local mock Discord (`DISCORD_API_URL` override) |
