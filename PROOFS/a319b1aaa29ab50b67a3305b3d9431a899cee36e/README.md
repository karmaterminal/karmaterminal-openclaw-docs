# PROOFS/a319b1aaa29ab50b67a3305b3d9431a899cee36e — continuation corpus (2026-09-20)

**Status: STATIC GATES ONLY. No live behavioral row was fired at this SHA.** This corpus is
published so the presented SHA has an honest, machine-readable evidence record — not to claim
acceptance. Read `RESOLVED-SHA.md` first; it states the limit that bounds everything here.

## Identity

| field | value |
|---|---|
| presented product SHA | `a319b1aaa29ab50b67a3305b3d9431a899cee36e` |
| prior presented SHA | `3821eaef72677c78f450ae9956cb582a22ba4cba` |
| upstream parent absorbed | `41ee7fb2422bd7a0eea18f744dbfe075c9614db9` |
| fleet runtime at publication | `1baff536afa549fea75660403c453bbd265352c0` |
| `exact_product_runtime` | **false** |
| presented ↔ runtime | **divergent siblings**, merge-base `3821eaef72` |
| seat used for static gates | ronan (aarch64, DGX) |

## Why there are no live rows

The fast-forward of the presentation ref this cycle moved the presented SHA **484 commits** past the
point where it and the fleet composite diverged. `13,956` files differ between the runtime and the
presented SHA; `1,280` of them are production files under `src/gateway/` and `src/agents/`.

A live row fired against the fleet as deployed would be evidence about `1baff536af`, not about this
SHA. Recording such a row here as PASS — or even as PARTIAL — would be a false attribution. So every
behavioral row is marked `not_fired_at_this_sha`.

**What unblocks them:** a redeploy onto a runtime that has `a319b1aaa29ab50b67a3305b3d9431a899cee36e` as a git ancestor. That is
figs-gated and has not happened. Once it has, the rows below are fired per
`RUNBOOKS/PROOF-CORPUS-METHOD.md` and this corpus is amended in place.

## What IS proven at this SHA

| gate | verdict |
|---|---|
| `pnpm tsgo:core` | **PASS** rc=0 |
| `pnpm lint` — oxlint core, extensions, scripts | **PASS** rc=0, first fully clean lint on this lane |
| Gate 2.7 upstream-content-preservation | **PASS** — 841 files, 0 FROZEN-STALE, 0 MIXED-CLOBBER |
| mergeable against `upstream/main` | **PASS** — `merge-tree` rc=0, upstream fully absorbed |
| fast-forward safety gate (6 checks) | **PASS** — pure ff, 0 commits lost |
| `vitest` gateway maintenance + close + delegate-artifacts | **PASS** 123/123 |
| `vitest` text_end reconciliation | **FAIL** 6/47 — `openclaw#1350`, pre-existing, not an absorb regression |

Receipts are the real stdout of the real runs, in `gates/` and `mergeability/`.

## Behavioral rows — all awaiting a redeploy

Carried forward from the `3821eaef72` corpus row set. Prior evidence for these rows lives at
`PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba/` and is **not** transposed here; see
`TRANSPOSED-FROM.md` for why.

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

1. **No live row at this SHA.** Stated above; this is the dominant limit.
2. **One known red.** `openclaw#1350`, streamed-text offset/fencing contract, 6 failing assertions.
   Not hidden, not weakened, not marked as anything other than FAIL.
3. **Static gates were run on one seat** (ronan, aarch64). They are deterministic toolchain gates,
   not host-sensitive behavior, but they are single-seat.
4. **This corpus does not supersede the published board** at
   `7cb9d71f622250bedbf565e327bd7d7b9d90b567`.
