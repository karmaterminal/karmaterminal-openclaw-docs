# PR 121204 proof corpus at `ba0f670a`

This is the self-contained proof entrypoint for protected PR head
`ba0f670a0959a9eeeb0b28ace59d3838079998b7`.

## Verdict boundary

This is a **full-copy ancestry/materiality transposition**, not a new live
exact-target behavior execution.

- Proof source `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` is a verified ancestor of
  previous head `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` and target
  `ba0f670a0959a9eeeb0b28ace59d3838079998b7`.
- All 18 source-corpus files have target-local counterparts. The row artifacts
  and harness remain byte-identical; target-facing prose and the manifest add
  the transposition boundary without changing source execution identities.
- Source execution remains attributed to installed/runtime composite
  `6e6da7bba079b0fc50d134b96657cda683985837` on Rune on 2026-08-23.
- Rows 1 and 2 remain source-isolating PASS receipts. The watchdog row remains
  composite-context-only and non-isolating.
- Exact-target Mode-B run `33033099410` is broad static/build/test evidence at
  `ba0f670a`; it is not relabeled as a live Discord behavior run.

## Start here

1. [manifest.json](manifest.json) — machine-readable corpus and verdicts.
2. [MATERIALITY.md](MATERIALITY.md) — ancestry, all 24 feature paths, conflict
   resolutions, current merge tree, focused controls, and limits.
3. [MODE-B-RECEIPT.json](MODE-B-RECEIPT.json) — exact-target aggregate and
   floor-identical failure classification.
4. [SOURCE-COPY-MAP.json](SOURCE-COPY-MAP.json) — source-to-target file map.
5. [ARTIFACTS.md](ARTIFACTS.md) — target-local artifact inventory.
6. [METHOD.md](METHOD.md) and [RESOLVED-SHA.md](RESOLVED-SHA.md).

## Behavioral rows

| Row | Source authority retained | Target statement |
| --- | --- | --- |
| [Stale direct-open vs fresh mention](STALE-DIRECT-OPEN/EVIDENCE.md) | PASS, exact-source isolating | Transposed; no new target fire |
| [Corrupt pending vs fresh addressed](CORRUPT-PENDING/EVIDENCE.md) | PASS, exact-source isolating for null payload | Transposed; no new target fire |
| [Watchdog recovery](WATCHDOG-REPAIR/EVIDENCE.md) | PASS on execution composite; non-isolating for source | Context only; not promoted |

No gateway, Discord, Signal, OpenClaw branch, upstream PR body, or upstream PR
comment was mutated to create this corpus.
