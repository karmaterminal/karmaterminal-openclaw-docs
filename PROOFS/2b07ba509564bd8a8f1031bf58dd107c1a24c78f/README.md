# Supplementary corpus — 2b07ba50 (fleet-standardised re-run)

**This corpus is SUPPLEMENTARY. It does not supersede the bound corpus and
`PROOFS/INDEX.json` is deliberately NOT repointed at it.**

## Why this run exists

Every prince seat was rebuilt onto one composite runtime
(`310252733a626568c98071bdaf9ee09dbdf38a88`) and migrated to agent-DB schema 17
on 2026-08-12. Before that, seats were mixed: some were missing the `discord`
plugin entirely and some carried a message backlog. The question this run was
fired to answer was narrow and honest: **do row outcomes change once no seat is
missing the discord plugin and none are backed up on messages?**

## SHA transposition, and why

- **Runtime executed:** composite `310252733a626568c98071bdaf9ee09dbdf38a88`
  (base `8318e58bd22186ffd4bd317ccb05b8592570ad57`), which carries the
  continuation feature *plus* Emeric's PR #121204 content *plus* the discord
  dead-letter change.
- **Bound/published SHA:** `2b07ba509564bd8a8f1031bf58dd107c1a24c78f`, the
  verified tip of the PR-presentation branch
  `frond-scribe-claude/20260509/narrow-surgery-tight`.

The two differ on purpose. Clawsweeper's real-behaviour-proof gate rejects a SHA
that is not reachable from the PR under review, so a composite SHA cannot be
bound. The composite runtime SHA is recorded here so the provenance is explicit
in the artefact rather than implied. **Emeric's fix is not merged upstream and
must not be conflated with the continuation feature.**

## Result — and why it did NOT replace the bound corpus

| | bound corpus `a7ef0317` | this run `2b07ba50` |
| --- | --- | --- |
| pass / validated | 26 | 24 |
| genuine failures | 0 | **3** |
| review-pending | 3 | 5 |
| artefact dirs | 34 | 34 |

This run is **weaker**, so binding it would have degraded the published
evidence. The bound corpus aggregates per-seat runs across ronan, cael and
cael-dgx; this run executed a single seat (cael), which is the most likely
reason fewer rows reached an explicit verdict.

## The ten rows without a validated envelope, classified exactly

Derived directly from each row's `run-result.json`; nothing here is asserted
beyond the artefacts. Twenty-four of the thirty-four rows validated cleanly.

| row | verdict | exit | pending receipts |
| --- | --- | --- | --- |
| `R-CD-1` | PASS-candidate | 0 | 2 |
| `R-CW-1` | PASS-candidate | 0 | 2 |
| `R-CD-2` | PARTIAL-candidate | 0 | 2 |
| `R-CW-3` | PARTIAL-candidate | 0 | 2 |
| `R-RC-2` | PARTIAL-candidate | 0 | 2 |
| `R-CD-TOKEN` | PARTIAL-candidate | 0 | 10 |
| `R-CD-4` | PARTIAL-candidate | **99** | 2 |
| `R-CD-CHAINED-DEPTH-2` | PARTIAL-candidate | **99** | 2 |
| `R-CD-MODEL-TOOL` | PARTIAL-candidate | **99** | 0 |
| `PREFLIGHT` | *(null)* | 0 | 0 |

**A. Genuine failures — non-zero effective exit (3):** `R-CD-4`,
`R-CD-CHAINED-DEPTH-2`, `R-CD-MODEL-TOOL`. These crossed duration thresholds
(`r_cd_chain_duration`, `r_cd_model_tool_duration`). Note these three have
**never** recorded a pass in this corpus's history — `R-CD-4` has always been
PARTIAL and the other two always NO-VERDICT. They are therefore **persistently
unproven shapes, not regressions**, and the earlier working theory that they
represented a regression is withdrawn here.

**B. PASS-candidate, held only on trace receipts (2):** `R-CD-1`, `R-CW-1`.
`effectiveExitCode: 0`, `verdict: PASS-candidate`, blocked solely by
`validate-candidate-run-result.mjs`, which requires
`review.status === 'ready-for-human-review'` with an empty `pendingReceipts`.
Both are missing exactly `continuation-trace-correlation` and `tempo-trace-json`.
**These two are the only rows in this run that a receipt fix alone could
convert.**

**C. PARTIAL-candidate with clean exit (4):** `R-CD-2`, `R-CW-3`, `R-RC-2` (2
receipts each) and `R-CD-TOKEN` (**10** receipts, and no validation file emitted
at all). These are *not* one receipt away from passing and are deliberately not
grouped with class B.

**D. Preflight (1):** `PREFLIGHT` — exit 0, `ready-for-human-review`, no pending
receipts, but `verdict: null`, so the validator demands an explicit outcome.

## The actual blocker for class B

`Tempo trace did not reach valid continuation topology before timeout: matched
trace lacks the originating continue_delegate tool span`

A trace **was** matched, so tracing works end to end. The `openclaw.tool.execution`
span carrying `gen_ai.tool.name=continue_delegate` is what is absent. That span is
emitted by the **`diagnostics-otel` extension**
(`extensions/diagnostics-otel/src/service-recorders-tools.ts`), not by core.

`diagnostics-otel` was confirmed enabled and loaded on cael for this run
(`plugins.entries.diagnostics-otel.enabled = true`,
`diagnostics.otel.traces = true`, and the gateway logged it among 16 loaded
plugins), so a disabled-extension explanation is ruled out.

Meanwhile the gateway journal for `R-CD-1` shows the feature itself working:

```
[continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session <redacted-session-key>
```

So the continuation behaviour occurred and was journalled; only the Tempo receipt
is missing. **This is a proof-collection gap, not evidence of a broken feature —
and it is stated that way deliberately rather than counted as a pass.**

## Concurrent seat condition observed during this run

Recorded because it may bear on the duration-threshold failures in class A, and
should not be omitted merely because it is inconvenient:

- `eventLoopDelayMaxMs=1173.4`, memory pressure `level=critical`,
  `rss=4.79 GiB` against a 3 GiB threshold.
- The continuation queue was wedged: `continuationQueueTotal=25`, `runnable=0`,
  `scheduled=0`, `staged_post_compaction=25`, `drainRatePerMinute=0.00`, pinned at
  exactly 25 across every sample. The queued entries are named for proof rows
  (`agent:main:r-cd-3-*`), some stamped from July.

Staged post-compaction delegates drain via `dispatchPostCompactionDelegates`,
invoked from `src/auto-reply/reply/agent-runner-result-complete.ts:159` when that
session completes an agent run. One-shot proof sessions never run again. The
authors anticipated this hazard — `src/gateway/server-runtime-services.ts:361`
reads *"for a session that already compacted there is no subsequent compaction
seam to consume them, so a requeued row would sit forever"* — and added boot
recovery, but that recovery is gated on rows left `running` by a crash
(`runningUpdatedAtOrBefore`). These rows are `staged`, and they survived a fresh
gateway start. **Stated as a strong hypothesis with citations, not as a proven
cause of the class A failures.**

## Provenance

- Source run: `31590642301`, workflow `project81-k6-proof.yml`, seat `cael`,
  `rows=live-suite`, `dry_run=false`.
- Artefacts copied verbatim from the runner workspace on cael; no row evidence
  was edited, and no verdict in this document was asserted beyond what the
  artefacts support.
