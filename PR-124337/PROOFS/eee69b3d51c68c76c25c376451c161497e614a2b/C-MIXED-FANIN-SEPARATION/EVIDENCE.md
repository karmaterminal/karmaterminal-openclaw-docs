# C - mixed fan-in separation

State: `pass`.

Run [32652334564](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32652334564)
executed this row on `emeric-nuc` from
`2026-08-23T17:12:47.774Z` through `2026-08-23T17:12:47.881Z`.
Nonce: `7bbdfad3-80e1-4625-876d-21bed04bf4a5`.

The installed checkout and build-info commit both matched exact composite
`6e6da7bba079b0fc50d134b96657cda683985837`. Three mixed capable+legacy
fan-in cancellations left both durable rows pending at attempts `0`, with no
last error or failure reason. In the same process and SQLite database, a
separate poison row terminalized at attempts `2` with
`retry-limit-exceeded` / `turn-abandoned`, and its follower completed.

Artifacts:

- [`receipt.json`](receipt.json)
- [`identity.json`](identity.json)
- [`durable-state.json`](durable-state.json)
- [`journal.log`](journal.log)
