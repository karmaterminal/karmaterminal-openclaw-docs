# A - genuine abandonment

State: `pass`.

Run [32652334564](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32652334564)
executed this row on `emeric-nuc` from
`2026-08-23T17:12:47.512Z` through `2026-08-23T17:12:47.670Z`.
Nonce: `a77318fd-0698-4dce-a4d2-512b6504881e`.

The installed checkout and build-info commit both matched exact composite
`6e6da7bba079b0fc50d134b96657cda683985837`. Genuine abandonment entered at
attempts `0`, `1`, and `2`. The durable SQLite projection records the head as
failed with attempts `2`, last error `turn-abandoned`, failure reason
`retry-limit-exceeded`, and payload retained. The follower is completed with
no surviving pending or claimed row.

Artifacts:

- [`receipt.json`](receipt.json)
- [`identity.json`](identity.json)
- [`durable-state.json`](durable-state.json)
- [`journal.log`](journal.log)
