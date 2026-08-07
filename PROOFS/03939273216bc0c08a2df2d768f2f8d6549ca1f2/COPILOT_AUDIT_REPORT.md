# Frozen proof-result classification audit

## Frozen root and candidate source

This audit is limited to the frozen diagnostic root:

`/home/figs/.local/state/openclaw-proof-runs/03939273216bc0c08a2df2d768f2f8d6549ca1f2-rowwise-20260806T205552Z`

I refer to that root as `F/` below. Its frozen contents are 953 regular files
totaling 2,965,159 bytes. `F/run-metadata.txt:1-4` binds the run to:

- candidate `03939273216bc0c08a2df2d768f2f8d6549ca1f2`;
- proof-harness/docs ref `52941484c258f353a91d783a635ba6c841d1c38a`;
- start `2026-08-06T20:55:52Z`;
- finish `2026-08-06T21:18:26Z`.

The frozen provenance names repository
`karmaterminal/karmaterminal-openclaw-docs` and runner SHA-256
`397a23ed1e64e7ccfc015abe40ac669d4e07ce381f36a58157ee56000697bdac`
(for example, `F/R-CD-4/harness-provenance.json:19`). The controlling frozen
files are:

| File | SHA-256 |
|---|---|
| `F/canonical-rows.txt` | `46fced0ec87a6e1098d2b23e2d679af5e2fa6d614f422b63c5a1d4f5f699036d` |
| `F/exit-status.tsv` | `ad68f7efbe9c4083046f8c51859e2a3edbbdbb5ceb794fcff8bee8f582a57c1e` |
| `F/fixture-exit-status.tsv` | `49b9f1ab773d029ef122ac1d1982ea62b1b756f0b3fb004e4bbc5b862ca2240b` |

The checkout is detached at the exact candidate SHA. Its commit is
`fix(i18n): leave native locale generation to automation`; the complete
candidate commit delta is 184 deletions in 23 Android locale-generation files.
It does not touch the proof harness or continuation runtime. Compared with the
prior proof candidate `989d20226a2009b47a3a479865f9f2ef39f89a6a`, the
continuation scheduler, work/delegate dispatch, continuation tool registry,
task-flow registry, and session-store owner files are unchanged. The only
inspected attempt-runner delta is two `chatType` forwarding lines in
`src/agents/command/attempt-execution.ts:953,1280`.

The most recent folded comparison corpus is
`PROOFS/989d20226a2009b47a3a479865f9f2ef39f89a6a` at the frozen docs ref.
Its `PROOFS/INDEX.json:10-19` reports 27 pass, 11 partial, zero fail, 38 total
rows, comprising 33 target executions and five reviewed transpositions.

## Catalog and denominator

`F/canonical-rows.txt` contains exactly 36 process attempts: `PREFLIGHT` plus
35 proof rows. `F/exit-status.tsv` records 23 exit 0, 10 exit 99, and 3 exit
107. The 13 nonzero attempts are the canonical non-pass denominator.

The folded semantic catalog contains 38 entries, including `PREFLIGHT`,
`R-CW-5`, `R-CW-5A`, `R-CW-6`, and `R-CW-6A`. This is not a 38-attempt
rowwise denominator. At docs ref `52941484...`,
`tools/k6-proofs/manifests/r-cw-5.json:16-22` and
`r-cw-6.json:16-27` mark original `R-CW-5` and `R-CW-6` as `scaffold`.
Their runnable static substitutes are `R-CW-5A` and `R-CW-6A`
(`r-cw-5a-static.json:12-19`, `r-cw-6a-static.json:12-19`). The rowwise list
therefore excludes the two scaffold rows and remains 36. Original fixture
receipts under `F/fixtures/R-CW-5` and `F/fixtures/R-CW-6` are separate
orchestration evidence for those scaffold rows; they must not be counted in
addition to the 36 or synthesized as a 37th/38th runnable attempt.

One exit-zero row is not a pass on artifact inspection: `R-RC-2` is a
`PARTIAL-candidate` run mislabeled `PASS-candidate` by its summary. Thus the
process-status rollup overstates valid passes by at least one.

## Common static-validator defect

Six zero-duration failures share one deterministic harness defect. At
`52941484...:tools/k6-proofs/scenarios/static-corpus-row-validator.js:20-29`,
the validator selects carried evidence SHA `989d...`, hardcodes every row root
to `.../<row>/cael-dgx`, and converts any failed read to an empty string.
Lines 295-304 then turn the resulting false predicates into
`FAIL-candidate`. The exact `989d...` tree contains 766 files under `cael/`
and zero under `cael-dgx/`. These checks neither started nor exercised the
candidate; each frozen summary reports `duration_ms=0`.

`R-TRACE-REDACTION-1121` is a seventh zero-duration carried-material failure
with a different path/content mismatch. Its scenario reads only the
transposition summary at
`PROOFS/989d.../R-TRACE-REDACTION-1121/EVIDENCE.md`
(`r-trace-redaction-1121.js:20-45`), while the detailed evidence it searches
for lives below `source-immutable/`. The root summary contains only the
classification/provenance and explicitly says target execution was false.

## Canonical non-pass rows

Paths in the table are relative to `F/`. “Prior” means the folded `989d...`
corpus at docs ref `52941484...`.

| ID and frozen attempt | Exact failed or missing evidence | Classification | Prior comparison and smallest next action |
|---|---|---|---|
| **R-CD-4** — `R-CD-4/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CD-4/cael/20260806T205811Z-r-cd-4-a01e2766` | `run-result.json:evidence` records `tool_accepted=true`, `agent_turn_observed=true`, and `child_completed=true`, but `return_in_target=false` and `return_in_parent=false`; verdict is verbatim `PARTIAL-candidate`. `continuation-trace-collector.error.log:1` says `invalid search trace id: 1fb6...`. | `incomplete trace gathering` (with a repeated partial execution outcome), not a demonstrated regression | Prior `R-CD-4/.../20260805T054646Z.../run-result.json` was also `PARTIAL-candidate` with both return predicates false, although it retained a valid trace. Repair trace-ID selection, then fresh-nonce rerun only this row and require a target/parent return receipt plus correlated trace. |
| **R-CD-CHAINED-DEPTH-2** — `R-CD-CHAINED-DEPTH-2/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CD-CHAINED-DEPTH-2/cael/20260806T205955Z-r-cd-chained-depth-2-8883679e` | Child and grandchild spawned and both completion sentinels were observed, but `chain_return_received=false`, `root_return_candidate=null`, and `root_return_receipt=null`; verdict is `PARTIAL-candidate`. The trace collector has the same invalid search trace ID. | `incomplete trace gathering` (with a repeated partial execution outcome), not a demonstrated regression | Prior `.../20260805T054831Z.../run-result.json` had the same missing root return and `PARTIAL-candidate`, with a valid trace. Repair trace collection; fresh-nonce rerun must bind child, grandchild, root return, and one trace. |
| **R-CD-COLLECTION-ON-COLLAPSE** — `R-CD-COLLECTION-ON-COLLAPSE/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CD-COLLECTION-ON-COLLAPSE/cael/20260806T210239Z-r-cd-collection-on-collapse-8424d751` | All nine predicates in `run-result.json:evidence.checks` are false; every `source_files` path points to nonexistent `.../R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/...`; duration is 0 and verdict is `FAIL-candidate`. | `execution/harness` false-positive candidate failure | Prior catalog classification is `PASS-candidate` carried evidence. Correct the seat path to the existing immutable material and rerun only the static validator; no candidate/source rerun or nonce is needed. |
| **R-CD-MODEL-TOOL** — `R-CD-MODEL-TOOL/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CD-MODEL-TOOL/cael/20260806T210436Z-r-cd-model-tool-fef95587` | Dispatch and parent scheduled sentinel are true, but `child_session_observed=false`, model metadata/self-report are null, `model_matches=false`, and `return_payload=false`; verdict is `PARTIAL-candidate`, trace status `unknown`. | `other` — incomplete execution evidence, not a demonstrated regression | Prior `.../20260805T055303Z.../run-result.json` likewise observed dispatch only and lacked an execution-bound child model byte/return. Fresh-nonce rerun is justified only after the harness can retain child-session identity and trace; require the execution-bound selected-model byte, requested-model equality, return payload, and correlation trace. |
| **R-CD-RETURN-OVERLAP** — `R-CD-RETURN-OVERLAP/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CD-RETURN-OVERLAP/cael/20260806T210752Z-r-cd-return-overlap-4204fff0` | Verbatim verdict is `null`, effective exit is 107, evidence is null, and validation says an explicit candidate outcome is missing. `k6.log` reports missing `.../R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md`; the direct failing `open()` is `r-cd-return-overlap.js:24-29`. | `execution/harness`; no candidate verdict | Prior catalog classification is `PASS-candidate`. Correct the carried-evidence path and rerun only this static scenario; no fresh nonce or source repair. |
| **R-CW-7** — `R-CW-7/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CW-7/cael/20260806T211234Z-r-cw-7-fe24cc0f` | All seven checks are false; all source files are under nonexistent `.../R-CW-7/cael-dgx/...`; duration is 0 and verdict is `FAIL-candidate`. | `execution/harness` false-positive candidate failure | Prior classification is `PASS-candidate`. Repair the static seat path and revalidate carried bytes only. |
| **R-CW-DELEGATE-CHILD-LIVE** — `R-CW-DELEGATE-CHILD-LIVE/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CW-DELEGATE-CHILD-LIVE/cael/20260806T211246Z-r-cw-delegate-child-live-19979a4d` | All seven checks are false; all source paths use nonexistent `cael-dgx`; duration is 0 and verdict is `FAIL-candidate`. | `execution/harness` false-positive candidate failure | Prior classification is `PASS-candidate`. Repair the path and revalidate carried bytes only. |
| **R-CW-DELEGATE-TOKEN** — `R-CW-DELEGATE-TOKEN/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CW-DELEGATE-TOKEN/cael/20260806T211330Z-r-cw-delegate-token-21a580a8` | All seven checks are false; all source paths use nonexistent `cael-dgx`; duration is 0 and verdict is `FAIL-candidate`. | `execution/harness` false-positive candidate failure | Prior classification is `PASS-candidate`. Repair the path and revalidate carried bytes only. |
| **R-CW-MULTI-COLLAPSE** — `R-CW-MULTI-COLLAPSE/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CW-MULTI-COLLAPSE/cael/20260806T211343Z-r-cw-multi-collapse-fb6e286f` | Seven of eight checks are false (`noRemainingQueued` alone is true); every source path uses nonexistent `cael-dgx`; duration is 0 and verdict is `FAIL-candidate`. | `execution/harness` false-positive candidate failure | Prior classification is `PASS-candidate`. Repair the path and revalidate carried bytes only. |
| **R-CW-MULTI** — `R-CW-MULTI/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-CW-MULTI/cael/20260806T211355Z-r-cw-multi-5a2a2db7` | All seven checks are false; every source path uses nonexistent `cael-dgx`; duration is 0 and verdict is `FAIL-candidate`. | `execution/harness` false-positive candidate failure | Prior classification is `PASS-candidate`. Repair the path and revalidate carried bytes only. |
| **R-OBS-2** — `R-OBS-2/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-OBS-2/cael/20260806T211503Z-r-obs-2-bdca32fd` | Verbatim verdict is `null`, effective exit is 107, and evidence is null. `k6.log` reports missing `.../R-OBS-2/cael-dgx/trace-tree.json`; `r-obs-2.js:24-27` directly opens that nonexistent path. | `execution/harness`; no candidate verdict | Prior classification is `PASS-candidate`. Correct the carried-evidence path and rerun this static scenario only. |
| **R-REGRESSION-TRAP-TESTS** — `R-REGRESSION-TRAP-TESTS/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-REGRESSION-TRAP-TESTS/cael/20260806T211809Z-r-regression-trap-tests-46558b14` | Verbatim verdict is `null`, effective exit is 107, and evidence is null. `k6.log` reports missing `.../R-REGRESSION-TRAP-TESTS/cael-dgx/EVIDENCE.md`; `r-regression-trap-tests.js:24-28` directly opens that path. | `execution/harness`; no candidate verdict | Prior classification is `PASS-candidate`. Correct the carried-evidence path and rerun this static scenario only. |
| **R-TRACE-REDACTION-1121** — `R-TRACE-REDACTION-1121/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-TRACE-REDACTION-1121/cael/20260806T211822Z-r-trace-redaction-1121-cecf4787` | `pass_heading_present=true`, but the five content predicates are false; duration is 0 and verdict is `FAIL-candidate`. The scenario reads the short root transposition summary, which does not contain the detailed safe-attribute/test assertions it requests. | `execution/harness` false-positive candidate failure | Prior classification is `PASS-candidate`, explicitly transposed with target execution false. Point the scenario to the reviewed `source-immutable` evidence (or validate the root summary’s actual schema), then rerun only the static validator. |

No canonical nonzero row establishes a genuine candidate regression. The
three dynamic rows are repeated partial/no-verdict outcomes; the remaining
ten are deterministic harness failures before candidate behavior.

## Exit-zero false pass: R-RC-2

**Frozen attempt:** `F/R-RC-2/03939273216bc0c08a2df2d768f2f8d6549ca1f2/R-RC-2/cael/20260806T211556Z-r-rc-2-36b67b78`.

This row must not remain in the pass count:

- `run-result.json:6-9` records verbatim VU verdict `PARTIAL-candidate` but
  summary verdict `PASS-candidate`.
- `run-result.json:26-45` records no child session, no bound tool result,
  `request_compaction_tool_result_observed=false`, null role/name/status,
  `request_compaction_invocation_bound=false`, neither accepted nor rejected
  request-compaction state, no post-compaction path, no guard, and no trace.
- `candidate-run-result-validation.error.log:1` says the run is
  review-incomplete.
- `continuation-trace-collector.error.log:1` has the same invalid search trace
  ID as other rows.

The defect is in the harness verdict threshold. In the frozen
`row-scenario.js:344-380`, authoritative threshold/accepted outcomes correctly
require a child session and a nonce-bound `request_compaction` `toolResult`.
But `acceptedOutcome` also accepts the unbound
`child_reported_context_threshold` boolean. Lines 381-394 therefore leave the
failure counter at zero. `handleSummary` runs outside VU state and falls back
to `PASS-candidate` when that counter is zero
(`verdict-reconciliation.json:reason`). The prior `989d...` R-RC-2 receipt has
the same effective exit 0, `PARTIAL-candidate` VU verdict, and missing bound
receipt, so this is a repeated proof-harness false pass, not new candidate
behavior.

**Classification:** `execution/harness` false-positive pass, compounded by
`incomplete trace gathering`.

**Smallest next action:** remove unbound child self-report from
`acceptedOutcome`; fail the process unless the authoritative receipt predicate
is true; explicitly carry the VU verdict/evidence into summary generation; and
repair trace-ID collection. Only then perform a fresh-nonce R-RC-2 rerun. A
valid honest-limit result requires the child session, a nonce-bound
`toolResult` with role `toolResult`, tool name `request_compaction`, status
`rejected`, guard `context_threshold`, and correlated context/threshold
values. A valid pass instead requires a bound accepted receipt plus the
post-compaction path. Either result also requires the correlation trace.

## Original R-CW-5 and R-CW-6 fixture receipts

These are separate scaffold-row fixtures, not extra rowwise attempts.
`F/fixture-exit-status.tsv` records exit 1 for both.

### R-CW-5

`F/fixtures/R-CW-5/fixture-result.json:13-17` proves that the production
boundary matrix and candidate dispatch suite passed; only
`toolSurfacePassed=false` and `noRejectedHopSpawn=false` remain.
`typed-tool-surface.json:64-68` records process exit 1,
`typedToolCaptured=true`, `overCapRejected=true`, and
`rejectedHopNoDurableWork=false`.

The failing generated test does import and enter candidate runtime, so the
fixture is not wholly static. However, the preserved result does not identify
the failed assertion or show a durable rejected-hop row. At docs ref
`52941484...`, `run-cost-cap-fixture.mjs:532-545` reduces the complete Vitest
process to regex booleans and does not retain stdout/stderr. In particular,
`rejectedHopNoDurableWork` is merely `/1 passed/`, so any test failure is
misnamed as a no-durable-work failure.

The accepted `989d...` receipt is not a same-fixture baseline. It names harness
SHA `50be336...`; its generated test blob is
`c4cb62c1ce244575f4f0f5a66be2a714cd9ee5c0`, versus frozen/current blob
`abe766cfacc7552e4860c83ab0d69d10044d1f2e`. The template was materially
rewritten, including replacing its SQLite session-accessor setup with a JSON
session-store setup. The exact current fixture bytes also produced the
identical matrix-pass/dispatch-pass/tool-surface-fail shape for earlier
candidate `374ad60...`
(`PROOFS/374ad60.../R-CW-5/ronan-dgx/fixture-result.json`). No accepted
same-fixture result was found.

**Classification:** `execution/harness` / outdated, non-diagnostic test seam;
not a demonstrated candidate regression. Before any target rerun, update the
fixture to the candidate’s canonical session-state seam, retain the private
failed assertion/stack, and obtain one accepted known-good run with the exact
same script/template bytes. Then run those unchanged bytes against the target.

### R-CW-6

`F/fixtures/R-CW-6/fixture-result.json:62-76` proves the production boundary
matrix, candidate dispatch suite, exact worktree, dependency, integrity, and
artifact-safety checks passed. The runtime/durable/typed checks are false.
But `runtime-boundary.json`, `durable-state-recovery.json`, and
`typed-tool-surface.json` contain only provenance and `passed=false`; they
contain no runtime or typed receipt.

This evidence loss is deterministic harness behavior. At docs ref
`52941484...`, `run-max-chain-fixture.mjs:660-661` reads both raw receipts only
if the combined two-test Vitest process is wholly successful. One failed test
therefore discards both receipts. Lines 816-850 then evaluate absent receipt
fields as false, and lines 880-887 delete the raw files. The frozen corpus
cannot identify which assertion failed or whether the other test completed.

The accepted `989d...` result again is not a same-fixture baseline. Its
runtime template blob is `efff2e7fafc9ccc09eb5038cc4b69fceaae16d90`,
versus current `eec2d84b3b355c32fa4e6f522b54c300bc6cb538`; its runner blob is
`4357b65d12ae1ece34091e37f8ba9d2a81005be7`, versus current
`079b551d08fd3aff183c9773a6b55d79c4d70e6b`. The current template was
materially rewritten from SQLite-backed recovery to a JSON store. The exact
current fixture bytes also failed in the same matrix-pass/dispatch-pass/
runtime-receipt-empty shape for `374ad60...`
(`PROOFS/374ad60.../R-CW-6/ronan-dgx/fixture-result.json`). No accepted
same-fixture result was found.

**Classification:** `execution/harness` / outdated, evidence-destroying test
seam; not a demonstrated candidate regression. Split the two tests or retain
each raw receipt independently of aggregate exit, preserve private failure
output, align persistence with the canonical session store, and establish an
accepted exact-byte known-good baseline before running unchanged bytes on the
target.

## Verdict

The frozen corpus does **not** prove a regression in candidate
`03939273216bc0c08a2df2d768f2f8d6549ca1f2`. Seven claimed `FAIL-candidate`
rows are zero-duration checks of carried material, not candidate executions;
six fail because the generic validator requests a nonexistent `cael-dgx`
tree, while the redaction row reads the wrong level of a transposed artifact.
Three exit-107 rows abort on the same nonexistent seat path before producing a
verdict. The three dynamic nonzero rows repeat prior partial/no-verdict
behavior and lack decisive execution/trace receipts. R-RC-2 is an additional
false pass: it has no nonce-bound `request_compaction` tool receipt, its
authoritative VU verdict is `PARTIAL-candidate`, and permissive threshold plus
summary logic turns that into exit 0/`PASS-candidate`. R-CW-5 and R-CW-6 reach
candidate code in their passing matrix/dispatch portions, but their failing
generated seams are materially different from the accepted fixtures, already
failed on another candidate, and discard the failure evidence needed for a
regression judgment. No same-fixture accepted baseline exists for either.

## Remediation order

1. **Repair carried-artifact addressing first.** Replace the six generic
   `cael-dgx` roots with the reviewed existing seat/immutable paths; point
   R-TRACE-REDACTION-1121 at the detailed immutable evidence; fix the three
   direct-open rc107 scenarios. Revalidate these ten static rows without
   touching or rerunning candidate behavior.
2. **Make R-RC-2 fail closed.** Require the authoritative nonce-bound tool
   receipt in both checks and exit status; carry VU evidence into
   `handleSummary`; never derive pass from an unbound child sentence.
3. **Repair trace correlation.** Stop submitting the invalid shared search ID
   and retain row-specific trace-query inputs/errors. Confirm this on a
   non-mutating trace probe before any fresh nonce.
4. **Repair fixture observability and ownership.** Preserve private Vitest
   failures for R-CW-5; independently preserve both R-CW-6 receipts even when
   one test fails; use the canonical candidate session-state seam.
5. **Establish same-fixture baselines.** Freeze and hash repaired R-CW-5/6
   scripts/templates, pass those exact bytes on a selected known-good
   candidate, then run the unchanged bytes on `039392...`. Do not call any
   difference a regression before this comparison exists.
6. **Only then run targeted fresh-nonce rows.** Rerun R-CD-4,
   R-CD-CHAINED-DEPTH-2, R-CD-MODEL-TOOL, and R-RC-2 individually with the
   repaired trace/receipt gates. A whole-corpus rerun is not justified by the
   frozen evidence.

## Evidence required before targeted rerun

- A reviewed harness commit/ref and SHA-256 for every repaired scenario,
  manifest, runner, and fixture template.
- A static preflight proving every carried-artifact path exists and that
  missing files are reported as harness errors, never empty-content candidate
  failures.
- A trace-collector probe showing that the row’s actual correlation key
  resolves to one valid trace; no reused `1fb6...` search ID.
- For R-CD-4: dispatch, unique child, completion, target/parent return receipt,
  and the same trace.
- For R-CD-CHAINED-DEPTH-2: child and grandchild identities/completions, bound
  root return, maximum depth, and the same trace.
- For R-CD-MODEL-TOOL: unique child session, execution-bound selected-model
  metadata, exact requested-model match, return payload, and trace.
- For R-RC-2: child session plus a nonce-bound authoritative
  `request_compaction` tool result and either structured threshold rejection
  or accepted/post-compaction completion, with correlation trace.
- For R-CW-5/6: retained exact failure output, independent raw receipts,
  canonical-state fixture setup, fixture-byte hashes, and an accepted
  known-good result using those exact same bytes before the target run.
