# Project 81 k6 proof corpus — `a7ef0317`

- Presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1`.
- Source GitHub Actions run: `31367303220` (`project81-k6-proof.yml`), seat `cael`.
- Raw artifacts copied from cael path: `/home/figs/actions-runner/_work/karmaterminal-openclaw-docs/karmaterminal-openclaw-docs/project81-k6-proof-artifacts/2e72b665229bac6c41388d10a6b979b86750211b/`.
- Runtime actually executed: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9`; Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read. It expects a k6 output file and writes a new `<row>/<seat>/k6-run-<timestamp>/` tree, while this task publishes the already-produced live artifacts and evidence at the scenario-readable layout (`<row>/cael-dgx/EVIDENCE.md`, except `R-TRACE-REDACTION-1121/EVIDENCE.md`). It was therefore not used to synthesize a new run directory.

## Rollup

| Scope | PASS-candidate | PARTIAL-candidate | FAIL-candidate | Unclassified |
|---|---:|---:|---:|---:|
| Proof rows (`R-*`) | 26 | 7 | 0 | 0 |
| Artifact directories including `PREFLIGHT` | 26 | 7 | 0 | 1 |

There are 34 copied artifact directories from the run: 33 `R-*` proof rows plus `PREFLIGHT`. The broader Project 81 corpus denominator remains 38; `R-CW-5`, `R-CW-5A`, `R-CW-6`, and `R-CW-6A` are orchestration-required and excluded by design, not dropped.

## Rows

| Row | Verdict | Review status | Pending receipts | Evidence |
|---|---|---|---|---|
| `PREFLIGHT` | `unclassified` | `ready-for-human-review` | none | [`PREFLIGHT/cael-dgx/EVIDENCE.md`](PREFLIGHT/cael-dgx/EVIDENCE.md) |
| `R-CD-1` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-1/cael-dgx/EVIDENCE.md`](R-CD-1/cael-dgx/EVIDENCE.md) |
| `R-CD-2` | `PARTIAL-candidate` | `ready-for-human-review` | none | [`R-CD-2/cael-dgx/EVIDENCE.md`](R-CD-2/cael-dgx/EVIDENCE.md) |
| `R-CD-3` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-3/cael-dgx/EVIDENCE.md`](R-CD-3/cael-dgx/EVIDENCE.md) |
| `R-CD-4` | `PARTIAL-candidate` | `ready-for-human-review` | none | [`R-CD-4/cael-dgx/EVIDENCE.md`](R-CD-4/cael-dgx/EVIDENCE.md) |
| `R-CD-CHAINED-DEPTH-2` | `PARTIAL-candidate` | `ready-for-human-review` | none | [`R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md`](R-CD-CHAINED-DEPTH-2/cael-dgx/EVIDENCE.md) |
| `R-CD-COLLECTION-ON-COLLAPSE` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/EVIDENCE.md`](R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/EVIDENCE.md) |
| `R-CD-MODEL-CHAINED-ALT` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-MODEL-CHAINED-ALT/cael-dgx/EVIDENCE.md`](R-CD-MODEL-CHAINED-ALT/cael-dgx/EVIDENCE.md) |
| `R-CD-MODEL-DEFAULT` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-MODEL-DEFAULT/cael-dgx/EVIDENCE.md`](R-CD-MODEL-DEFAULT/cael-dgx/EVIDENCE.md) |
| `R-CD-MODEL-TOKEN` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-MODEL-TOKEN/cael-dgx/EVIDENCE.md`](R-CD-MODEL-TOKEN/cael-dgx/EVIDENCE.md) |
| `R-CD-MODEL-TOOL` | `PARTIAL-candidate` | `ready-for-human-review` | none | [`R-CD-MODEL-TOOL/cael-dgx/EVIDENCE.md`](R-CD-MODEL-TOOL/cael-dgx/EVIDENCE.md) |
| `R-CD-RETURN-OVERLAP` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md`](R-CD-RETURN-OVERLAP/cael-dgx/EVIDENCE.md) |
| `R-CD-SILENT` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CD-SILENT/cael-dgx/EVIDENCE.md`](R-CD-SILENT/cael-dgx/EVIDENCE.md) |
| `R-CD-TOKEN` | `PARTIAL-candidate` | `review-pending` | exact-candidate-runtime-identity, attempt-state, raw-final-text-origin, parser-detected, queue-identity, child-spawned, child-completed, parent-return-event, tempo-trace-json, continuation-trace-correlation | [`R-CD-TOKEN/cael-dgx/EVIDENCE.md`](R-CD-TOKEN/cael-dgx/EVIDENCE.md) |
| `R-CONFIG-DEFAULTS` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CONFIG-DEFAULTS/cael-dgx/EVIDENCE.md`](R-CONFIG-DEFAULTS/cael-dgx/EVIDENCE.md) |
| `R-CONFIG-INTERSESSION` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CONFIG-INTERSESSION/cael-dgx/EVIDENCE.md`](R-CONFIG-INTERSESSION/cael-dgx/EVIDENCE.md) |
| `R-CW-1` | `PASS-candidate` | `review-pending` | continuation-trace-correlation, tempo-trace-json | [`R-CW-1/cael-dgx/EVIDENCE.md`](R-CW-1/cael-dgx/EVIDENCE.md) |
| `R-CW-2` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-2/cael-dgx/EVIDENCE.md`](R-CW-2/cael-dgx/EVIDENCE.md) |
| `R-CW-3` | `PARTIAL-candidate` | `review-pending` | continuation-trace-correlation, tempo-trace-json | [`R-CW-3/cael-dgx/EVIDENCE.md`](R-CW-3/cael-dgx/EVIDENCE.md) |
| `R-CW-4` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-4/cael-dgx/EVIDENCE.md`](R-CW-4/cael-dgx/EVIDENCE.md) |
| `R-CW-7` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-7/cael-dgx/EVIDENCE.md`](R-CW-7/cael-dgx/EVIDENCE.md) |
| `R-CW-DELEGATE-CHILD-LIVE` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-DELEGATE-CHILD-LIVE/cael-dgx/EVIDENCE.md`](R-CW-DELEGATE-CHILD-LIVE/cael-dgx/EVIDENCE.md) |
| `R-CW-DELEGATE-SELF-CONTINUATION` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-DELEGATE-SELF-CONTINUATION/cael-dgx/EVIDENCE.md`](R-CW-DELEGATE-SELF-CONTINUATION/cael-dgx/EVIDENCE.md) |
| `R-CW-DELEGATE-TOKEN` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-DELEGATE-TOKEN/cael-dgx/EVIDENCE.md`](R-CW-DELEGATE-TOKEN/cael-dgx/EVIDENCE.md) |
| `R-CW-MULTI` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-MULTI/cael-dgx/EVIDENCE.md`](R-CW-MULTI/cael-dgx/EVIDENCE.md) |
| `R-CW-MULTI-COLLAPSE` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-MULTI-COLLAPSE/cael-dgx/EVIDENCE.md`](R-CW-MULTI-COLLAPSE/cael-dgx/EVIDENCE.md) |
| `R-CW-TOKEN` | `PASS-candidate` | `ready-for-human-review` | none | [`R-CW-TOKEN/cael-dgx/EVIDENCE.md`](R-CW-TOKEN/cael-dgx/EVIDENCE.md) |
| `R-OBS-1` | `PASS-candidate` | `ready-for-human-review` | none | [`R-OBS-1/cael-dgx/EVIDENCE.md`](R-OBS-1/cael-dgx/EVIDENCE.md) |
| `R-OBS-2` | `PASS-candidate` | `ready-for-human-review` | none | [`R-OBS-2/cael-dgx/EVIDENCE.md`](R-OBS-2/cael-dgx/EVIDENCE.md) |
| `R-OBS-STATUS` | `PASS-candidate` | `ready-for-human-review` | none | [`R-OBS-STATUS/cael-dgx/EVIDENCE.md`](R-OBS-STATUS/cael-dgx/EVIDENCE.md) |
| `R-RC-1` | `PASS-candidate` | `ready-for-human-review` | none | [`R-RC-1/cael-dgx/EVIDENCE.md`](R-RC-1/cael-dgx/EVIDENCE.md) |
| `R-RC-2` | `PARTIAL-candidate` | `review-pending` | continuation-trace-correlation, tempo-trace-json | [`R-RC-2/cael-dgx/EVIDENCE.md`](R-RC-2/cael-dgx/EVIDENCE.md) |
| `R-REGRESSION-TRAP-TESTS` | `PASS-candidate` | `ready-for-human-review` | none | [`R-REGRESSION-TRAP-TESTS/cael-dgx/EVIDENCE.md`](R-REGRESSION-TRAP-TESTS/cael-dgx/EVIDENCE.md) |
| `R-TRACE-REDACTION-1121` | `PASS-candidate` | `ready-for-human-review` | none | [`R-TRACE-REDACTION-1121/EVIDENCE.md`](R-TRACE-REDACTION-1121/EVIDENCE.md) |

## Still owed / honest limits

- `R-CD-2`, `R-CD-4`, `R-CD-CHAINED-DEPTH-2`, `R-CD-MODEL-TOOL`, `R-CD-TOKEN`, `R-CW-3`, and `R-RC-2` are `PARTIAL-candidate`, not PASS.
- `R-CD-4`, `R-CD-CHAINED-DEPTH-2`, and `R-CD-MODEL-TOOL` are partial because the copied public evidence does not contain the required delegate-return receipt (`return_in_target:false` / `return_in_parent:false`, missing chain return, or missing return payload as applicable).
- `R-RC-2` is partial from its own artifacts: trace/correlation receipts are pending or missing, and the request-compaction tool result / post-compaction path fields are not observed in `run-result.json`.
- `R-CD-TOKEN` is partial from a pre-dispatch build identity gate and carries the pending receipts listed in its row evidence.
- `R-CW-1` has a PASS-candidate verdict but remains review-pending for `continuation-trace-correlation` and `tempo-trace-json`; the pass was not upgraded into a validated envelope.
- The extracted GitHub run log file `run-31367303220-verdict-lines.txt` contains the verdict/summary lines emitted by the workflow; not every artifact directory emitted a matching row-log line, so row verdicts are taken from `run-result.json` when absent there.

