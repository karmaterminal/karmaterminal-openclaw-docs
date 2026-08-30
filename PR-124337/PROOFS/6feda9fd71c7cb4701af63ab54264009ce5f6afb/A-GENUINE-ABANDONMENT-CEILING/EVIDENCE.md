# A: genuine abandonment ceiling

**Signed verdict: PASS.**

The exact Discord transport accepted a payload-bearing head and same-channel
follower. Eight genuine reply-lane `onAbandoned` callbacks produced durable
attempt observations `1, 2, 3, 4, 5, 6, 7`, then one failed row at terminal
observation eight. The dead letter is `retry-limit-exceeded` /
`turn-abandoned`, retains the original payload, and has no active claim.

The same-lane follower then reached `completed` with no claim owner. After both
database owners closed, a replacement Discord handler reopened the same stores.
The ingress rows and session row were identical, and `replayed_ids` was empty.

| Evidence | Path |
| --- | --- |
| Signed row receipt | [`receipt.json`](receipt.json) |
| Closed-store projection | [`durable-state.json`](durable-state.json) |
| Reopen projection | [`restart-state.json`](restart-state.json) |
| Discord preflight/process observations | [`transport.json`](transport.json) |
| Public-safe payload binding | [`payload-projection.json`](payload-projection.json) |
| Signature key | [`../signing-public-key.json`](../signing-public-key.json) |

