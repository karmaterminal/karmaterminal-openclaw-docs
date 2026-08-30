# A: genuine abandonment ceiling

**Signed verdict: PASS.**

The exact Discord transport accepted a payload-bearing head and same-channel
follower. Eight genuine reply-lane `onAbandoned` callbacks produced durable
attempt observations `1, 2, 3, 4, 5, 6, 7`, then one failed row at terminal
observation eight. The dead letter is `retry-limit-exceeded` /
`turn-abandoned`, retains the original payload, and has no active claim.

The poison head was admitted at `10000`, before the same-lane follower at
`10001`. The head was dead-lettered exactly once at `1277001`; the follower
then reached `completed` strictly later at `1277002` with no claim owner. After
both database owners closed, a replacement Discord handler reopened the same
stores. The canonical ingress rows and session row were identical,
`replayed_ids` was empty, and differing SQLite file hashes were not treated as
semantic state changes.

| Evidence | Path |
| --- | --- |
| Signed row receipt | [`receipt.json`](receipt.json) |
| Closed-store projection | [`durable-state.json`](durable-state.json) |
| Reopen projection | [`restart-state.json`](restart-state.json) |
| Discord preflight/process observations | [`transport.json`](transport.json) |
| Public-safe payload binding | [`payload-projection.json`](payload-projection.json) |
| Signature key | [`../signing-public-key.json`](../signing-public-key.json) |
