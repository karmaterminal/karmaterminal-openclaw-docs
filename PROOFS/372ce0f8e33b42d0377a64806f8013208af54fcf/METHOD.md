# Method

## Frozen identities

| Identity | Value |
|---|---|
| Presentation, capture, ship, proof source | `372ce0f8e33b42d0377a64806f8013208af54fcf` |
| Runtime composite | `6e6da7bba079b0fc50d134b96657cda683985837` |
| Docs starting SHA / harness bytes | `5862caf39a3844a8ce3dd25def236a901ce9b316` |
| Frozen upstream | `8578b8f55cf77ddb161891b662a02f8c8c2a80ba` |
| Static comparison baseline | `1cc8f4e3d617ef6f173283ef83d7b739a4995734` |

## Seed procedure

1. Resolve `openclaw/openclaw#85651` and immutable
   `refs/pull/85651/head` to the presentation SHA.
2. Load the current remote runbooks, proof-corpus skills, docs `main`, index,
   manifest, method, README, SHA provenance, and ClawSweeper entrypoint.
3. Preserve `PR-121204/` and `PR-124337/` unchanged.
4. Compare the presentation and runtime composite directly, hash the dedicated
   continuation/tracing/diagnostics trees, and classify every adjacent changed
   path.
5. Reopen all 41 current catalog rows as `missing`.
6. Allocate each required row exactly once. Ronan owns the 33 behavioral
   live-suite rows; `PREFLIGHT` is the 34th runnable entry. Eight
   orchestration/construct rows remain explicitly allocated outside the
   live-suite.
7. Retain static evidence only as an explicit `carriedFrom` comparison
   baseline where the current scenario contract uses it.
8. Validate the docs harness, catalog, corpus, exact-SHA paths, allocation,
   shell syntax, public safety, and tracked-file boundary before publication.

## Live-fire rule

Only one `rows=live-suite` workflow dispatch is authorized, after:

- server docs `main` equals the published seed SHA;
- Ronan checkout and `dist/build-info.json` equal the runtime composite;
- at least 16 package dist roots and the root bundled diagnostics OTel plugin
  exist;
- the bundled plugin is enabled and loaded from `dist/extensions`;
- diagnostics OTel tracing, Tempo readiness, gateway, Discord transport, and
  disposable sessions are ready; and
- acceptance gates are not red.

A stopped or possibly consumed row remains consumed. Missing trace material is
recovered from the original run window without behavioral refire.

## Review and fold

Each row must bind presentation SHA, runtime composite, docs seed SHA, seat,
workflow, nonce, and disposable session. Both typed-tool and token/bracket
forms are required where the row contract says so. Trace-required rows must
have fixed-width nonzero IDs, distinct spans, same-trace topology, row/chain
correlation, and the originating tool span.

Raw private acquisition remains transient and untracked. Only reviewed,
redacted, public-safe receipts may enter this corpus.
