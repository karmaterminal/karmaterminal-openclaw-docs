# ClawSweeper direct proof digest -- a7ef03177e0f42831a087521e6eb7720102d6be1

Purpose: give ClawSweeper and maintainers a short path through the **current** proof corpus for
`openclaw/openclaw#85651`, without following superseded attempts or older caveat chains.

**If you are reading the digest at `PROOFS/1cc8f4e3d617ef6f173283ef83d7b739a4995734/`, it is stale.**
That corpus is July's and is retained only as the static baseline (see "Static evidence baseline" below).
This file supersedes it for candidate verdicts.

## Current corpus state

- PR-presentation head: `a7ef03177e0f42831a087521e6eb7720102d6be1`
- Rollup: **33 proof rows run -- 26 pass / 7 partial / 0 fail / 0 missing** (plus `PREFLIGHT`, unclassified)
- Denominator: the broader row set is 38. `R-CW-5`, `R-CW-5A`, `R-CW-6`, `R-CW-6A` are
  **orchestration-required and excluded from `--live-suite` by design, not dropped**, so 34 is the
  runnable set and 33 of it carries a verdict.
- Manifest: [`proofs-manifest.json`](./proofs-manifest.json)
- Row board: [`README.md`](./README.md)
- Source run: `project81-k6-proof` run `31367303220`, seat `cael`

Reading rule: the `EVIDENCE.md` files linked from here are the row verdicts. Every claim in each one
carries a `file:field` citation back to a raw artefact in the same directory. Older issue bodies
describe prior templates or superseded attempts; they are provenance, not the current verdict.

## Runtime provenance -- read this before judging the SHA binding

The corpus is published under the **presentation SHA** `a7ef03177e0f42831a087521e6eb7720102d6be1`,
because that is what the upstream PR presents.

The runtime actually executed on the seat was the **composite**
`2e72b665229bac6c41388d10a6b979b86750211b`, whose parents are:

- `c868194997d0a61de2e648580afdf40e0d0b34b9` -- continuation
- `6f276fa24da8174cd97a029ce9e47f2141032c8a` -- ingress fix, upstream PR openclaw/openclaw#121204

The ingress fix is **not yet merged upstream** and must not be conflated with the continuation
feature, so the composite SHA is recorded as ancillary provenance on every row rather than used as
the publication directory. The composite commit does not exist on the presentation branch, so
publishing under it would have produced a corpus no reviewer could locate from the PR.

This is stated because it is the kind of detail that looks like sleight of hand if discovered later
rather than declared up front.

## Static evidence baseline

Several rows (`static-corpus-row-validator.js` and four row-specific readers) load **prior** evidence
as a comparison baseline, resolved via `index.static_evidence_sha || index.current_sha`.

That field is pinned to `1cc8f4e3d617ef6f173283ef83d7b739a4995734`, the last corpus carrying the
baseline in the layout those scenarios read. Each row records `carriedFrom`, so the provenance is
explicit in the artefact rather than implied. The baseline supplies **no candidate verdict**.

Historical note, because it explains a large apparent regression in the record: before that field
was pinned, five consecutive live-suite runs reported 13 failing rows (9 x exit 99, 4 x exit 107).
All 13 failed for one reason -- the bound corpus held run artefacts and **zero** `EVIDENCE.md`, so
every static-corpus row resolved a non-existent path and reported all checks false. It was one
missing binding, not thirteen product regressions.

## Rows carrying an honest limit (7 partial)

None of these are failures, and none are silent. Each row's `EVIDENCE.md` states its limit.

| Row | State | Direct proof text |
|---|---|---|
| R-CD-2 | partial | [`R-CD-2/cael-dgx/EVIDENCE.md`](./R-CD-2/cael-dgx/EVIDENCE.md) |
| R-CD-4 | partial | [`R-CD-4/cael-dgx/EVIDENCE.md`](./R-CD-4/cael-dgx/EVIDENCE.md) |
| R-CD-CHAINED-DEPTH-2 | partial | [`R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md`](./R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md) |
| R-CD-MODEL-TOOL | partial | [`R-CD-MODEL-TOOL/cael-dgx/EVIDENCE.md`](./R-CD-MODEL-TOOL/cael-dgx/EVIDENCE.md) |
| R-CD-TOKEN | partial | [`R-CD-TOKEN/cael-dgx/EVIDENCE.md`](./R-CD-TOKEN/cael-dgx/EVIDENCE.md) |
| R-CW-3 | partial | [`R-CW-3/cael-dgx/EVIDENCE.md`](./R-CW-3/cael-dgx/EVIDENCE.md) |
| R-RC-2 | partial | [`R-RC-2/cael-dgx/EVIDENCE.md`](./R-RC-2/cael-dgx/EVIDENCE.md) |

The dominant shape among the `R-CD-*` partials is a missing delegate-return receipt
(`return_in_target: false`, `return_in_parent: false`) -- the dispatch and child completion are
observed, the return leg is not. That is recorded as a limit rather than rounded up to a pass.

## What changed since the previous digest

- Trace-receipt debt is **cleared**. The prior corpus recorded `continuation-trace-correlation` and
  `tempo-trace-json` as owed because the seat had no `diagnostics-otel` and never exported the
  `openclaw.tool.execution` span carrying `gen_ai.tool.name`. That plugin is now installed on the
  proof seat, and `R-OBS-2` reports the span present: 46 spans, 1 root, 0 orphans.
- Corpus is bound to the presenting SHA rather than an ancestor, so no transposition rule is needed
  to accept it.
- 0 rows fail.
