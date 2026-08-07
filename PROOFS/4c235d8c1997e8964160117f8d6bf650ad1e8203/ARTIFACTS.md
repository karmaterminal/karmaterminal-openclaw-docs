# Artifact index

No live proof artifacts are folded at seed time. Workflow artifacts must remain attached to their immutable Actions runs until reviewed and copied into the relevant row directory.

Deployment and readiness run IDs are recorded in `proofs-manifest.json::artifact_roots.fleet_readiness`.

At seed publication, Cael deploy `29696462712` is terminal exact-SHA ready and Ronan deploy `29696744833` is in progress. Remaining seat receipts are populated only after their serial deploy/readiness checks complete.

## Independent comparator bundles

- [`silas-lothric/comparator-20260719`](artifacts/silas-lothric/comparator-20260719/README.md) — complete 35-row exact-candidate comparator arm for runtime `4c235d8c1997e8964160117f8d6bf650ad1e8203` and docs authority `1303a03c2858fce82c235992b7ee06385e8e6304`. Independent rollup: 25 PASS, 9 PARTIAL, 1 HONEST_LIMIT, 0 FAIL. Canonical owners are preserved; the bundle does not overwrite or substitute for canonical row evidence.
