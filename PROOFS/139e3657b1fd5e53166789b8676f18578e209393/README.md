# PROOFS/139e3657b1fd5e53166789b8676f18578e209393 — continuation corpus (2026-09-21)

**Status: STATIC GATES ONLY. No live behavioral row was fired at this SHA.**
Read `RESOLVED-SHA.md` first; it states the limit that bounds everything here.

This is the head that upstream PR `openclaw/openclaw#129388` presents after the
second fast-forward of this lane.

## Identity

| field | value |
|---|---|
| presented product SHA | `139e3657b1fd5e53166789b8676f18578e209393` |
| prior presented SHA | `a319b1aaa29ab50b67a3305b3d9431a899cee36e` |
| upstream base absorbed | `715077a3befb5bb1239a8b0ebb52980e957ad316` |
| upstream `main` at publication | 175 commits ahead |
| fleet runtime at publication | `1baff536afa549fea75660403c453bbd265352c0` |
| `exact_product_runtime` | **false** |
| mergeable against current upstream | **false** |
| seat used for static gates | ronan (aarch64, DGX) |

## What IS proven at this SHA

| gate | verdict |
|---|---|
| `pnpm tsgo:core` | **pass** rc=0 |
| Gate 2.7 vs the absorbed base `715077a3be` | **pass** — 0 FROZEN-STALE, 0 MIXED-CLOBBER |
| `vitest` rollback-custody regressions | **pass** 10/10 |
| `vitest` delivery-queue + session-delivery | **pass** 124/124 |
| `vitest` gateway maintenance + close + delegate-artifacts | **pass** 123/123 |
| `vitest` production-boundary + spawn-cleanup | 28/30 — two tracked reds |
| diff vs the absorbed base | 839 files — **no growth** over the 841 previously presented |
| worktree at publication | 0 tracked changes, 0 untracked, no detritus |

Receipts are the real stdout of the real runs, under `gates/` and
`mergeability/`. The tree at this SHA is byte-identical to `43371a0fd4`
(both tree `eabea1f74119a777c9ff92b5b0f4d394d514f4fa`), so those receipts apply
verbatim.

## What is NOT proven, stated plainly

1. **No live behavioral row.** The fleet serves composite `1baff536af`, which is
   a *divergent sibling* of this SHA — merge-base `3821eaef72`, neither an
   ancestor of the other. A live fire on the fleet as deployed would be evidence
   about the composite, so all 38 rows are `not_fired_at_this_sha`, not PASS and
   not PARTIAL. **Unblocked by a redeploy onto a runtime that has this SHA as an
   ancestor** — and note that redeploy now also carries the **schema 21 → 22**
   migration (`migrateTranscriptFtsRowSchema`), so it wants migration-success
   and rollback-compatibility receipts of its own.
2. **Not mergeable against current upstream.** 175 commits behind; a fifth absorb
   is required. This does not affect what is proven *at* this SHA.
3. **Two tracked reds**, neither hidden nor softened: `openclaw#1356`
   (order-dependent operator-revoked cleanup) and `openclaw#1350`
   (streamed-text offset/fencing).

## Behavioral rows — all awaiting a redeploy

Row set carried forward from the `3821eaef72` corpus. Prior evidence lives at
`PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba/` and is **not** transposed
here; see `TRANSPOSED-FROM.md`.

| row | verdict at this SHA | prior corpus |
|---|---|---|
| `R-CD-1` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-1) |
| `R-CD-2` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-2) |
| `R-CD-3` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-3) |
| `R-CD-4` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-4) |
| `R-CD-CHAINED-DEPTH-2` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-CHAINED-DEPTH-2) |
| `R-CD-COLLECTION-ON-COLLAPSE` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-COLLECTION-ON-COLLAPSE) |
| `R-CD-MODEL-CHAINED-ALT` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-MODEL-CHAINED-ALT) |
| `R-CD-MODEL-DEFAULT` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-MODEL-DEFAULT) |
| `R-CD-MODEL-TOKEN` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-MODEL-TOKEN) |
| `R-CD-MODEL-TOOL` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-MODEL-TOOL) |
| `R-CD-RETURN-COVENANT-AUTHORITY` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-RETURN-COVENANT-AUTHORITY) |
| `R-CD-RETURN-OVERLAP` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-RETURN-OVERLAP) |
| `R-CD-SILENT` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-SILENT) |
| `R-CD-TOKEN` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CD-TOKEN) |
| `R-CONFIG-DEFAULTS` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CONFIG-DEFAULTS) |
| `R-CONFIG-INTERSESSION` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CONFIG-INTERSESSION) |
| `R-CW-1` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-1) |
| `R-CW-2` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-2) |
| `R-CW-3` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-3) |
| `R-CW-4` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-4) |
| `R-CW-5` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-5) |
| `R-CW-5A` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-5A) |
| `R-CW-6` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-6) |
| `R-CW-6A` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-6A) |
| `R-CW-7` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-7) |
| `R-CW-DELEGATE-CHILD-LIVE` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-DELEGATE-CHILD-LIVE) |
| `R-CW-DELEGATE-SELF-CONTINUATION` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-DELEGATE-SELF-CONTINUATION) |
| `R-CW-DELEGATE-TOKEN` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-DELEGATE-TOKEN) |
| `R-CW-MULTI` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-MULTI) |
| `R-CW-MULTI-COLLAPSE` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-MULTI-COLLAPSE) |
| `R-CW-TOKEN` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-CW-TOKEN) |
| `R-OBS-1` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-OBS-1) |
| `R-OBS-2` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-OBS-2) |
| `R-OBS-STATUS` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-OBS-STATUS) |
| `R-RC-1` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-RC-1) |
| `R-RC-2` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-RC-2) |
| `R-REGRESSION-TRAP-TESTS` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-REGRESSION-TRAP-TESTS) |
| `R-TRACE-REDACTION-1121` | `not_fired_at_this_sha` | [3821eaef72](../3821eaef72677c78f450ae9956cb582a22ba4cba/R-TRACE-REDACTION-1121) |

## Honest limits

1. **No live row at this SHA.** The dominant limit.
2. **Two known reds**, both tracked with reproducers.
3. **Static gates ran on one seat** (ronan, aarch64). Deterministic toolchain
   gates, not host-sensitive behaviour, but single-seat.
4. **This corpus does not supersede the published board** at
   `7cb9d71f622250bedbf565e327bd7d7b9d90b567`.
