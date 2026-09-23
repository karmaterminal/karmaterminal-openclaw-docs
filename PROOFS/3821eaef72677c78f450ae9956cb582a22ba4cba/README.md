# PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba — continuation candidate corpus (2026-09-20)

**This corpus is CANDIDATE-ONLY and is NOT acceptance-complete.** It does not supersede the
published board at `7cb9d71f622250bedbf565e327bd7d7b9d90b567`, and `PROOFS/INDEX.json` is deliberately not repointed by it.

## Identity

| field | value |
|---|---|
| presented product SHA | `3821eaef72677c78f450ae9956cb582a22ba4cba` |
| executed runtime SHA | `1baff536afa549fea75660403c453bbd265352c0` (composite carrier) |
| `exact_product_runtime` | **false** |
| docs / harness SHA | `45d301cb87c2e57634daf2fb78c7613d6afbc018` |
| seat | ronan (aarch64) |
| harness | `tools/k6-proofs/scripts/run-proofs.sh --live` |

### Why the runtime SHA differs from the presented SHA

The fleet runs a composite because two upstream fixes are not merged yet. The PR presents the pure
continuation descendant, never the composite. Receipts:

- `3821eaef72677c78f450ae9956cb582a22ba4cba` **is a git ancestor** of `1baff536afa549fea75660403c453bbd265352c0`.
- The composite adds exactly four commits: `131456cbae` (#124337), `1edf868b3a` (#121204),
  `a6de2d2b78` (local integration repair), `1baff536af` (local gate repair).
- The **continuation surface is byte-identical**: a diff over `src/auto-reply/continuation/`,
  `src/infra/continuation-tracer.ts`, `src/gateway/` and `src/agents/` reports **zero** changed
  files, so the continuation/delegate owner code these rows exercise is the same in both.

**Disclosed confound.** The composite *does* change delivery plumbing outside that surface
(`src/auto-reply/reply/queue/drain.ts`, `queue/lifecycle.ts`, `queue/recent-message-ids.ts`,
`reply/dispatch-from-config.prepare-context.ts`, `src/auto-reply/inbound-debounce.ts`, and channel
ingress). A delegate return traverses reply-queue delivery, so the return-observation PARTIAL rows
below are **not** certified composite-free. Settling that needs a pure-tip run.

No row is marked PARTIAL merely because the runtime was a composite. The carrier fact lives here and
in `proofs-manifest.json::execution_runtime_provenance`.

## Rollup

| state | rows |
|---|---|
| pass | 23 |
| partial | 9 |
| honest_limit | 1 |
| fail | 0 |
| missing | 5 |
| **total required** | **38** |

## Authority — read this before quoting any number

Every verdict here is a **candidate** verdict from one automated fire. Per the canonical method a
candidate verdict is never a folded verdict, and **no row in this corpus is promoted**
(`promotion.authority = none`, `automatic_authority = false`). The board at `7cb9d71f622250bedbf565e327bd7d7b9d90b567` reports
higher pass counts partly because its rows carry `independent-manual-review` promotion authority,
a step this corpus has not had. Comparing the two rollups directly is not apples-to-apples.

## Non-PASS rows

| row | state | note |
|---|---|---|
| R-CD-2 | partial | `r-cd-2-authoritative-receipt.json` never written; trace receipts pending |
| R-CD-4 | partial | child completed but no return observed in target or parent |
| R-CD-CHAINED-DEPTH-2 | partial | |
| R-CD-MODEL-CHAINED-ALT | partial | |
| R-CD-SILENT | partial | |
| R-CD-TOKEN | partial | **expected on this seat class** — the row's own manifest states a message-body seat cannot prove the bracket path and remains PARTIAL unless raw-final-text mode is forced. `OPENCLAW_SEAT_CLASS` was left unset rather than stamped. |
| R-CW-3 | partial | |
| R-CW-DELEGATE-SELF-CONTINUATION | partial | |
| R-CW-TOKEN | partial | |
| R-RC-2 | honest_limit | the one closure the method sanctions |
| R-CW-5 / R-CW-6 | missing | `orchestration-required`; excluded from the live-suite by design, provable only via their documented process-local isolated fixtures (`run-cost-cap-fixture.mjs`, max-chain fixture) |
| R-CW-5A / R-CW-6A | missing | `static-preflight-only`; these validate the **committed artifacts** of their live siblings, so they can only go green after R-CW-5/R-CW-6 fixture packets are committed. Derivative, not independent blockers. |
| R-CD-RETURN-COVENANT-AUTHORITY | missing | `construct-only`; **has never passed in any corpus** — see provenance below |

## R-OBS-1 — disclosed refire

R-OBS-1 **failed on its first fire and passed on one disclosed refire**, so its `pass` state does
not rest on the original suite run. The first fire was invalidated by an agent-turn stall rather
than by row behavior: its bounded journal capture held zero proof-relevant lines, no
`assistant_output_started` milestone exists in that 60s window, and an `[agent/embedded] Codex
parent-local egress workaround is unavailable` warning was logged 2s after dispatch — while a later
row in the same suite reached `assistant_output_started` in 11.3s. The refire produced the complete
sentinel in 22.2s with all four predicates true. Both run ids are recorded in the row's
`PUBLIC-REVIEW.json`, in `proofs-manifest.json::refires`, and in the row's `test_cases_executed`.
The earlier FAIL is retained as provenance, not discarded.

## R-CD-RETURN-COVENANT-AUTHORITY — required-row provenance

This row is recorded `missing` and its required-row status is **flagged for method review** rather
than treated as a settled merge gate.

- It originated on 2026-08-28 in a separate frond-scribe lane, in response to a **ClawSweeper review
  comment on the presentation PR itself** (`openclaw/openclaw#129388`) — not from the continuation
  feature's original acceptance method (docs #117/#118 and `PROOF-CORPUS-METHOD.md`).
- Its authoring lane doc states plainly: *"No row manifest or pipeline entry is added in this lane"*
  and that *"exact-head matrix execution and proof folding remain deferred until the product supplies
  the fixture seam."*
- It entered docs-main `required_rows` via PR #540 (`5831d6df`, 2026-09-05) by **inheriting a 38-row
  baseline set wholesale**. That PR's body promotes three unrelated rows and states no producer
  implementation is included; the widening of the required set from 37 to 38 was never separately
  called out or approved.
- PR #544 (`45d301cb`, 2026-09-19) catalogued it `construct-only` **only to unblock a fail-closed
  manifest preflight**, and says in its own commit message that it records the row's state and does
  not promote it.
- It has **never passed**. Its single recorded attempt produced 0 of 24 observations because the
  fixture gateway was not running for phase calls — a harness defect, not a product contradiction.

The product seam this row would exercise already exists on this head
(`src/auto-reply/continuation/return-covenant-fixture/`, plus
`scripts/return-covenant-fixture-driver.mjs` and its `tsdown` entry), so closing the row is a
**harness** project, not new product code. Per the canonical method, a never-passed row from a
separate lane should stay outside `required_rows` unless the feature method and the maintainer
explicitly adopt it. Because the request originated from ClawSweeper on this very PR, that adoption
call belongs to the maintainer and is recorded here as open.

## Trace evidence

Tempo was verified reachable before dispatch and trace receipts were produced this cycle
(`traceStatus: present` with `tempo-trace-*.json` and `continuation-trace-correlation.json` on
R-CD-1, R-CD-4, R-CD-CHAINED-DEPTH-2, R-CW-1, R-CW-3). Observability runs on silas per
`ansible/roles/openclaw-observability` (`openclaw_obs_node: silas`), fronted by HAProxy.

## Artifacts

Raw per-row artifacts are retained **privately on the seat** and bound here by sha256 in each row's
`PUBLIC-REVIEW.json`. Only public-safe review documents are published, matching the established
corpus shape. See [`ARTIFACTS.md`](ARTIFACTS.md).
