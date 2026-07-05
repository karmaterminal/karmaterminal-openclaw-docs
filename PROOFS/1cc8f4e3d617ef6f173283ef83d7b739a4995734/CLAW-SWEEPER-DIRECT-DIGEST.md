# ClawSweeper direct proof digest -- 1cc8f4e3d617ef6f173283ef83d7b739a4995734

Purpose: give ClawSweeper and maintainers a short path through the current proof corpus without following older Project 82/83 issue history, superseded THIN attempts, or caveat chains.

Current corpus state:

- PR/candidate head: `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
- Current rollup after `karmaterminal/karmaterminal-openclaw-docs#279`: 29 rows / 28 pass / 0 thin / 1 honest-limit / 0 missing
- Manifest: [`proofs-manifest.json`](./proofs-manifest.json)
- Row board: [`README.md`](./README.md)

Reading rule: use the evidence files linked here as the row verdicts. Older issue bodies often describe prior templates or superseded attempts; they are provenance, not the current verdict.

## Corpus-level transposition

This corpus is an exact-SHA navigation corpus for `1cc8f4e3d617ef6f173283ef83d7b739a4995734`.

Most raw live-fire receipts were captured on `bca2b0b89ab886bf23a10e4983926f6b374b3188`, then full-copied forward after the presentation branch absorbed the validation-loop terminal diagnostic fix and upstream/main drift. The carry-forward is explicit, not hidden. Gate 2.7 for `1cc8f4e` reports 0 `FROZEN-STALE`, and the corpus has direct row directories under this exact SHA.

Rows with extra interpretation are summarized below.

## Direct row map

| Row | State | Issue | Direct proof text | Why it is listed here |
|---|---|---|---|---|
| R-CW-7 | pass | [#220](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/220) | [`R-CW-7/cael-dgx/EVIDENCE.md`](./R-CW-7/cael-dgx/EVIDENCE.md) | Replaces an older THIN public-`traceparent` method with direct exact-head source/test proof. |
| R-CD-CHAINED-DEPTH-2 | pass | [#215](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/215) | [`R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md`](./R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md) | Earlier partial attempt is preserved; rerun 1403 is the passing evidence. |
| R-CW-MULTI-COLLAPSE | pass | [#216](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/216) | [`R-CW-MULTI-COLLAPSE/cael-dgx/EVIDENCE.md`](./R-CW-MULTI-COLLAPSE/cael-dgx/EVIDENCE.md) | Synthetic DB-seeded method with explicit scope limits. |
| R-CD-COLLECTION-ON-COLLAPSE | pass | [#217](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/217) | [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/EVIDENCE.md`](./R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/EVIDENCE.md) | Multi-hop A -> B -> delayed-C proof; direct evidence avoids older row-template history. |
| R-CD-RETURN-OVERLAP | pass | [#246](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/246) | [`R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md`](./R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md) | PASS with wake-causality caveat; proves collected overlap, not isolated wake causality. |
| R-RC-2 | honest_limit | [#238](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/238) | [`R-RC-2/cael-dgx/EVIDENCE.md`](./R-RC-2/cael-dgx/EVIDENCE.md) | Honest-limit is the correct byte because the live session was below compaction threshold. |

## Row summaries

### R-CW-7 -- traceparent propagation

Verdict: PASS.

Current proof text: `traceparent` is intentionally internal, not a public model-facing `continue_delegate` parameter. Exact-head focused tests on `1cc8f4e3d617ef6f173283ef83d7b739a4995734` prove:

1. public schema generation strips the internal `traceparent` field;
2. `continue_delegate` auto-picks active runtime trace context when the model omits `traceparent`;
3. delegate dispatch preserves trace context;
4. child spawn receives, persists, hands off, and registers the inherited traceparent;
5. focused tests pass: 142 tests / 0 failed.

Receipts:

- [`R-CW-7/cael-dgx/EVIDENCE.md`](./R-CW-7/cael-dgx/EVIDENCE.md)
- [`R-CW-7/cael-dgx/source/source-snippets.md`](./R-CW-7/cael-dgx/source/source-snippets.md)
- [`R-CW-7/cael-dgx/test/focused-traceparent-tests.log`](./R-CW-7/cael-dgx/test/focused-traceparent-tests.log)

Do not read the old public-`traceparent` THIN method as the current verdict.

### R-CD-CHAINED-DEPTH-2 -- depth-2 delegate chain

Verdict: PASS.

Current proof text: rerun `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403` proves root -> depth-1, depth-1 -> depth-2, depth-2 leaf return, and depth-1 final return after observing the leaf. The first attempt is retained for audit history, but the rerun is the verdict.

Receipts:

- [`R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md`](./R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md)
- [`R-CD-CHAINED-DEPTH-2/cael-dgx/rerun-1403-pass/evaluation.json`](./R-CD-CHAINED-DEPTH-2/cael-dgx/rerun-1403-pass/evaluation.json)
- [`R-CD-CHAINED-DEPTH-2/cael-dgx/rerun-1403-pass/main/root-observation.md`](./R-CD-CHAINED-DEPTH-2/cael-dgx/rerun-1403-pass/main/root-observation.md)
- [`R-CD-CHAINED-DEPTH-2/cael-dgx/rerun-1403-pass/tempo/trace-summary.json`](./R-CD-CHAINED-DEPTH-2/cael-dgx/rerun-1403-pass/tempo/trace-summary.json)

### R-CW-MULTI-COLLAPSE -- same-session stale/new continue_work collapse

Verdict: PASS with explicit synthetic-method caveat.

Current proof text: two same-session continuation rows were seeded directly into SQLite under figs-authorized invasive method. The older row was superseded; the newest row received one durable terminal grant; config was restored byte-identically. The synthetic `hop:101/102` values are metadata from the seeded rows, not realistic chain-depth evidence.

Receipts:

- [`R-CW-MULTI-COLLAPSE/cael-dgx/EVIDENCE.md`](./R-CW-MULTI-COLLAPSE/cael-dgx/EVIDENCE.md)
- [`R-CW-MULTI-COLLAPSE/cael-dgx/final-terminal-sqlite.txt`](./R-CW-MULTI-COLLAPSE/cael-dgx/final-terminal-sqlite.txt)
- [`R-CW-MULTI-COLLAPSE/cael-dgx/final-queued-running.txt`](./R-CW-MULTI-COLLAPSE/cael-dgx/final-queued-running.txt)
- [`R-CW-MULTI-COLLAPSE/cael-dgx/restore-verified-sha256.txt`](./R-CW-MULTI-COLLAPSE/cael-dgx/restore-verified-sha256.txt)

### R-CD-COLLECTION-ON-COLLAPSE -- A -> B -> delayed-C collection

Verdict: PASS.

Current proof text: root A spawned detached B; B scheduled delayed C with typed `continue_delegate(mode=normal, delaySeconds=7, fanoutMode=tree)` and finalized before C existed/started/returned; C later returned a unique sentinel; root/main had enough bytes to observe the B -> C continuation leaf. No config mutation or DB seeding was used.

Receipts:

- [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/EVIDENCE.md`](./R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/EVIDENCE.md)
- [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/db/flow-rows-concise.json`](./R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/db/flow-rows-concise.json)
- [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/db/task-rows-concise.json`](./R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/db/task-rows-concise.json)
- [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/main/root-collection-receipt.md`](./R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/main/root-collection-receipt.md)
- [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/tempo/trace-summary.json`](./R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/tempo/trace-summary.json)

### R-CD-RETURN-OVERLAP -- silent and waking returns in one overlap window

Verdict: PASS with wake-causality caveat.

Current proof text: a silent return and a silent-wake return both targeted the same root window. Both returns were durably delivered to root; no silent return was lost, no orphaned return appeared, no duplicate wake storm occurred, and no invented child execution was observed.

Caveat: this row does not prove that the waking return was the sole cause of an isolated fresh root generation. The root was already active / had continuation work in flight, so the visible wake surface folded into the active/queued window. The row proves collected overlap behavior.

Receipts:

- [`R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md`](./R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md)
- [`R-CD-RETURN-OVERLAP/cael-dgx/db/flow-rows-concise.json`](./R-CD-RETURN-OVERLAP/cael-dgx/db/flow-rows-concise.json)
- [`R-CD-RETURN-OVERLAP/cael-dgx/db/task-rows-concise.json`](./R-CD-RETURN-OVERLAP/cael-dgx/db/task-rows-concise.json)
- [`R-CD-RETURN-OVERLAP/cael-dgx/journal/journal-filtered.log`](./R-CD-RETURN-OVERLAP/cael-dgx/journal/journal-filtered.log)
- [`R-CD-RETURN-OVERLAP/cael-dgx/tempo/trace-0d676f84623ebfe6499a324d039ee050-summary.json`](./R-CD-RETURN-OVERLAP/cael-dgx/tempo/trace-0d676f84623ebfe6499a324d039ee050-summary.json)

### R-RC-2 -- request_compaction threshold guard

Verdict: HONEST_LIMIT.

Current proof text: the live session was at 17% context and the threshold for `request_compaction()` acceptance is 70%. The correct behavior was a single structured rejection: `status=rejected`, `guard=context_threshold`, `contextUsage=17`, `threshold=70`. No context stuffing, loop, or forced compaction was performed.

Receipts:

- [`R-RC-2/cael-dgx/EVIDENCE.md`](./R-RC-2/cael-dgx/EVIDENCE.md)
- [`R-RC-2/cael-dgx/session-status.txt`](./R-RC-2/cael-dgx/session-status.txt)
- [`R-RC-2/cael-dgx/request-compaction-receipt.json`](./R-RC-2/cael-dgx/request-compaction-receipt.json)
- [`R-RC-2/cael-dgx/tempo/trace-summary.jsonl`](./R-RC-2/cael-dgx/tempo/trace-summary.jsonl)

This row should remain honest-limit unless a future genuinely >=70% context session is used.
