# Continuation proof corpus — `c868194`

Bound to **`c868194997d0a61de2e648580afdf40e0d0b34b9`**, the exact head that `openclaw/openclaw#85651` presents.

## Why this replaced the previous corpus
The prior corpus bound `b27a2624ed3`. That SHA is **not an ancestor** of this head
(52 commits off the presentation line) and carries ~961 insertions of Emeric #1229
work the PR does not ship. It therefore proved a *different artifact*, and no
transposition note could honestly bridge it. It was replaced, not relabelled.

Upstream also restructured the gateway run/admission path (#121215, extracting
`agent-turn-service`) between the two SHAs — the exact path these rows exercise.

## What was run
- Seat: **cael**, live; `dist/build-info.json` commit verified `== c868194` before capture
- Seat readiness: `PASS-candidate`, k6 `v2.0.0`
- Runnable rows: **34**. The corpus is 38; `R-CW-5/5A/6/6A` are
  `orchestration-required` and excluded from `--live-suite` **by design**, not dropped.

## Verdicts (34 runnable)

| outcome | rows |
|---|---|
| PASS-candidate | 16 |
| PARTIAL-candidate | 7 |
| FAIL-candidate | 7 |
| unclassified | 4 |

Review state: **27 ready-for-human-review**, 7 review-pending, 16 with a validated
candidate envelope.

## What this is NOT
Every row is `candidateOnly` with `foldRequiresReview`. **Nothing here is canonical
proof, and nothing here is an automatic fold input.** The harness withholds the
routing envelope for review-pending rows on purpose, so review-debt can route their
missing receipts.

## Known receipt debt, and its cause
`continuation-trace-correlation` and `tempo-trace-json` are pending on 4 rows.

The cause is identified, not guessed: the seat has **no built extensions**
(`extensions/*/dist` is empty) and `diagnostics-otel` is not enabled, so the
`openclaw.tool.execution` span carrying `gen_ai.tool.name` is never exported. Core
`continuation.*` spans **do** reach Tempo — which is why the collector matches a
trace but reports it "lacks the originating continue_delegate tool span". That is a
seat observability gap, not a product defect.

Per the harness README, fetch/correlation failures are non-fatal by default and
correctly leave these receipts review-pending.

Remaining pending receipts are itemised in `../INDEX.json` under
`review.pendingReceiptTally`.
