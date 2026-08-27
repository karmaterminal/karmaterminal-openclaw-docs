# Method

## Source execution

The copied source corpus used the repository's sanctioned `pnpm test` entrypoint
and isolated temporary SQLite state. Its exact immutable identities remain:

- behavior source:
  `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9`;
- installed/runtime execution composite:
  `6e6da7bba079b0fc50d134b96657cda683985837`;
- seat and date: Rune, 2026-08-23;
- harness SHA-256:
  `368650f8f97583038cd0a9beec2488fbe67574b12a4d8df514a595a583b8f344`.

The two source-isolating rows import production queue/drain and Discord monitor
surfaces, operate on the real durable SQLite table, and stop at the adoption
callback. The watchdog row remains explicitly composite-dependent.

## Transposition

No behavior row was fired for this operation. Git object identity and diffs were
used to walk:

```text
3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9
  -> 5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938
  -> 2745d7617c16fbb7650c4a2fe0065ef82c1a46ff
  -> ba0f670a0959a9eeeb0b28ace59d3838079998b7
```

The merge's second parent is exact floor
`6ae89b5a8ed6a1bdbd0d9b7639fc8162afbb7578`. `git show
--remerge-diff` identified exactly two content conflicts and exposed their
resolved bytes. A 24-path blob walk separated unchanged proof-owner bytes from
reviewed follow-up and upstream test/helper changes.

At review time, upstream `main` was
`71d4a8c3e305c623aa3ffe92696eec18f116cfc6`; GitHub merge ref
`975c1c4ec06be37c4cb3736506584427d7552c02` had parents current main and
`ba0f670a`, and its tree
`67edb2ab085c46af1b8632a8aecca44022178db8` exactly matched a fresh
`git merge-tree --write-tree` result.

## Evidence classes

- Copied source row receipts retain their original execution authority.
- Copied causal RED/GREEN logs prove the production-shaped stale-ambient
  fixture failed before the repair and passed after it; they are historical
  controls, not target execution.
- Mode-B run `33033099410` is exact-target build/static/test evidence. Its
  aggregate failure is retained and classified rather than painted green.

GitNexus was unavailable in this lane. No semantic-graph claim is made; the
receipt relies on Git ancestry, blob IDs, remerge diff, merge-tree equality,
source test receipts, and exact-target Mode-B artifacts.
