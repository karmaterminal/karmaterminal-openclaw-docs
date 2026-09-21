# RESOLVED-SHA — a319b1aaa29ab50b67a3305b3d9431a899cee36e

| identity | value |
|---|---|
| presented / published SHA | `a319b1aaa29ab50b67a3305b3d9431a899cee36e` |
| prior presented SHA | `3821eaef72677c78f450ae9956cb582a22ba4cba` |
| fleet runtime SHA at publication | `1baff536afa549fea75660403c453bbd265352c0` (composite carrier) |
| `exact_product_runtime` | **false** |
| presented is ancestor of runtime | **false** |
| runtime is ancestor of presented | **false** |
| merge-base(presented, runtime) | `3821eaef72677c78f450ae9956cb582a22ba4cba` |
| upstream parent fully absorbed | `41ee7fb2422bd7a0eea18f744dbfe075c9614db9` |

Receipts: `mergeability/ancestry-and-mergeability.log`.

## The presented SHA and the fleet runtime are divergent siblings

This is the material change from the `3821eaef72` corpus and it is stated first because it bounds
everything else here.

At `3821eaef72` the presented SHA **was** a git ancestor of the composite the fleet served, and the
continuation surface between them was byte-identical, so live rows fired on the fleet were honest
evidence for the presented SHA.

That is no longer true. `a319b1aaa2` and `1baff536af` share `3821eaef72` as their merge-base and
neither is an ancestor of the other. The presented SHA is **484 commits** ahead of that merge-base
(three upstream absorbs); the composite is **4** commits ahead of it on a separate line.

| comparison | value |
|---|---|
| total files differing, runtime vs presented | **13,956** |
| production files differing under `src/gateway/` + `src/agents/` | **1,280** |
| production files differing under `src/auto-reply/continuation/` | **3** (`context-pressure.ts`, `post-compaction-staged-dispatch.ts`, `system-event-ownership.ts`) |

**Consequence, stated plainly: no live behavioral row fired on the fleet as currently deployed is
evidence for this SHA.** Live rows require a redeploy onto a runtime that has
`a319b1aaa29ab50b67a3305b3d9431a899cee36e` as an ancestor. That redeploy is figs-gated and has not
happened. Rows are therefore recorded here as `not_fired_at_this_sha`, not as PASS and not as
PARTIAL — a PARTIAL would imply partial evidence at this SHA, and there is none.

## Protected refs

| ref | value | note |
|---|---|---|
| `refs/heads/codeagent/85651-upstream-1ba243c8-gates` | `a319b1aaa29ab50b67a3305b3d9431a899cee36e` | **fast-forwarded this cycle**, figs-authorized |
| `refs/heads/ronan/20260916/p89-absorb-d8d7d53d` | `a319b1aaa29ab50b67a3305b3d9431a899cee36e` | assembly ref, PR target all cycle |
| composite `0b26a6a92d` | unchanged | never mutated |

The fast-forward was a **pure** fast-forward, not a forced update: `3821eaef72` is an ancestor of
`a319b1aaa2`, `0` commits were exclusive to the presentation ref, and `484` were added. Reversal
point `3821eaef72677c78f450ae9956cb582a22ba4cba` is recorded in the lane journal.

## Gate status at this SHA

| gate | verdict | receipt |
|---|---|---|
| `pnpm tsgo:core` | **PASS** rc=0, first try after the absorb | `gates/gate-tsgo-core.log` |
| `pnpm lint` (oxlint core + extensions + scripts) | **PASS** rc=0 — first fully clean lint on this lane | `gates/gate-pnpm-lint.log` |
| Gate 2.7 upstream-content-preservation | **PASS** — 841 files: 465 GENUINE / 376 SAFE-NEW / **0 FROZEN-STALE** / **0 MIXED-CLOBBER** | `gates/gate-2.7-classification.tsv` |
| mergeability vs `upstream/main` | **PASS** — `merge-tree --write-tree` rc=0, 0 upstream commits missing, upstream is an ancestor | `mergeability/ancestry-and-mergeability.log` |
| `vitest` gateway maintenance + close + delegate-artifacts | **PASS** 123/123 | `gates/vitest-gateway-maintenance-close.log` |
| `vitest` text_end reconciliation | **FAIL** 6 of 47 | `gates/vitest-text-end-reconciliation.log` |

`execution_status = STATIC_GATES_ONLY_NO_LIVE_ROWS_AT_THIS_SHA`.

### The one honest red

`src/agents/embedded-agent-subscribe.subscribe-embedded-agent-session.text-end-reconciliation.test.ts`
fails 6 of 47. One root cause: each delivered block carries the prior block's text prepended
(expected `["First","Second"]`, got `["First","First\nSecond"]`), plus a duplicated block and an
unterminated fence. The continuation deltas have not adopted upstream #146361's streamed-text
offset/fencing/partial contract. Tracked as `karmaterminal/openclaw#1350`. It is **not** a
regression from the absorb that produced this SHA: the same 6 failed identically before it.
