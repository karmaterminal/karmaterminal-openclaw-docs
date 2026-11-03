# Resolved identities

| Role | Value |
| --- | --- |
| PR | openclaw/openclaw#121204 |
| Head under test | `cdef5a1d956ac04f9b006c9295ed1e4ea9131e77` |
| Control (series merge base, upstream main at rebase) | `ca43d19197888f3d42237b4425f08a473779266f` |
| Intermediate heads (scenario C only) | `fbef5fda32fd284fb6dc8b19f20c6f778c77bf09`, `08d7a0292cac17ad21a24ce1ff173b8ee31d6342` |
| pnpm-lock.yaml blob (all four trees) | `eb9be2e161593e0cf28bd1337cd9453f9c37d3eb` |
| Harness sha256 | `recovery-proof.mts` `b197703065ea94a6c33f4f5274031e0567708faf478ff2b88e9fefe7f2b17e42`; `mock-discord.mts` `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f`; `run-all.sh` `54079e3b465a222200c2c87357ec07656f75fe10728e8a633cf742a28900a792` |
| Node | v26.9.0 |
| Run date (UTC) | 2026-10-06 |
| Transport | production Discord REST client + `GatewayPlugin` over real loopback HTTP / WebSocket to a local mock Discord (`DISCORD_API_URL` override) |
