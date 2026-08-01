# Project 81 k6 proof runbooks

Durable runbook surface for Project 81: turn manually executed proof-row methods into repeatable k6/direct-tool flows.

This directory is intentionally operational. Each row runbook should answer:

- what row is runnable today
- exact runner/k6 command
- required env and seat constraints
- what k6 directly proves
- what still needs manual collection before a PASS can be folded
- where to write candidate artifacts
- known honest-limit / review caveats

Current automation substrate:

```bash
cd tools/k6-proofs
./scripts/run-proofs.sh --dry-run all <candidate-sha>
```

For an external/reviewer-facing path from “install k6” to “run the unattended suite,” use [EXECUTABLE-SUITE.md](EXECUTABLE-SUITE.md).

As of the current Project 81 surface, `list-runnable-rows --live-suite` resolves to 34 unattended rows:

```text
preflight,R-CD-1,R-CD-2,R-CD-3,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-COLLECTION-ON-COLLAPSE,R-CD-MODEL-CHAINED-ALT,R-CD-MODEL-DEFAULT,R-CD-MODEL-TOKEN,R-CD-MODEL-TOOL,R-CD-RETURN-OVERLAP,R-CD-SILENT,R-CD-TOKEN,R-CONFIG-defaults,R-CONFIG-INTERSESSION,R-CW-1,R-CW-2,R-CW-3,R-CW-4,R-CW-7,R-CW-DELEGATE-CHILD-LIVE,R-CW-DELEGATE-SELF-CONTINUATION,R-CW-DELEGATE-TOKEN,R-CW-MULTI-COLLAPSE,R-CW-MULTI,R-CW-TOKEN,R-OBS-1,R-OBS-2,R-OBS-status,R-RC-1,R-RC-2,R-REGRESSION-TRAP-TESTS,R-TRACE-REDACTION-1121
```

That count is a runner surface, not a proof-class claim. It includes fresh live WebSocket rows, read-only/status probes, offline static committed-packet validators, and threshold/honest-limit canaries. R-CW-5/R-CW-6 are excluded because their cap claims run through explicit process-local exact-candidate fixtures rather than the unattended WebSocket suite; R-CW-5A/R-CW-6A are non-live construct-only boundary checks. A `PASS-candidate` or `HONEST-LIMIT-candidate` still needs row-specific review before any canonical fold.

`preflight` remains a readiness helper with its own manifest contract; live cap rows are never promoted by that helper.

Use this directory as the accumulator. When a scaffold row becomes runnable, add or update `RUNBOOKS/project-81/rows/<ROW>.md` or a fixture note in the same PR as the scenario/manifest change. Static committed-packet validators may stay manifest-driven when the manifest and executable-suite docs already describe the review caveat.

## Current row runbooks

- [preflight](rows/preflight.md) — static preflight / seat-readiness helper
- [R-CD-1](rows/R-CD-1.md)
- [R-CD-2](rows/R-CD-2.md)
- [R-CD-4](rows/R-CD-4.md)
- [R-CD-CHAINED-DEPTH-2](rows/R-CD-CHAINED-DEPTH-2.md)
- [R-CD-SILENT](rows/R-CD-SILENT.md)
- [R-CD-MODEL-CHAINED-ALT](rows/R-CD-MODEL-CHAINED-ALT.md)
- [R-CD-MODEL-DEFAULT](rows/R-CD-MODEL-DEFAULT.md)
- [R-CD-MODEL-TOKEN](rows/R-CD-MODEL-TOKEN.md)
- [R-CD-MODEL-TOOL](rows/R-CD-MODEL-TOOL.md)
- [R-CD-TOKEN](rows/R-CD-TOKEN.md)
- [R-CONFIG-defaults](rows/R-CONFIG-defaults.md)
- [R-CONFIG-INTERSESSION](rows/R-CONFIG-INTERSESSION.md)
- [R-CW-1](rows/R-CW-1.md)
- [R-CW-2](rows/R-CW-2.md)
- [R-CW-3](rows/R-CW-3.md)
- [R-CW-4](rows/R-CW-4.md)
- [R-CW-DELEGATE-SELF-CONTINUATION](rows/R-CW-DELEGATE-SELF-CONTINUATION.md)
- [R-CW-TOKEN](rows/R-CW-TOKEN.md)
- [R-OBS-1](rows/R-OBS-1.md)
- [R-OBS-2](rows/R-OBS-2.md)
- [R-OBS-status](rows/R-OBS-status.md)
- [R-RC-1](rows/R-RC-1.md)

Rows promoted as static committed-packet validators or honest-limit canaries may be runnable from manifests before they have a dedicated per-row runbook. In that case, use the manifest, `EXECUTABLE-SUITE.md`, and the generated candidate report as the review surface.

## Shared execution pattern

1. Confirm the current proof corpus is mechanically clean:

   ```bash
   node tools/k6-proofs/scripts/validate-corpus.mjs --index --json
   node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
   node tools/k6-proofs/scripts/check-scenario-alignment.mjs
   ```

2. Run seat readiness before any live fold candidate:

   ```bash
   OPENCLAW_CANDIDATE_SHA=<40-char-sha> \
   OPENCLAW_SEAT_NAME=<seat> \
   OPENCLAW_SESSION_KEY=<target-session-key> \
   OPENCLAW_GATEWAY_TOKEN=*** \
     node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json \
       > /tmp/seat-readiness.json
   ```

3. Dry-run row selection:

   ```bash
   cd tools/k6-proofs
   OPENCLAW_GATEWAY_TOKEN=*** \
     ./scripts/run-proofs.sh --dry-run <ROW-or-comma-list-or-all> <candidate-sha>
   ```

4. Live-run only when the row runbook says it is safe. A live run must be bound
   to the exact immutable docs/harness commit it is running from (#496):

   ```bash
   cd tools/k6-proofs
   OPENCLAW_GATEWAY_TOKEN=*** \
   OPENCLAW_SESSION_KEY=<target-session-key> \
     ./scripts/run-proofs.sh --live --docs-ref "$(git rev-parse HEAD)" <ROW> <candidate-sha>
   ```

   The runner refuses to fire when the ref is missing/malformed, when `HEAD` is
   not that ref, when tracked bytes under `tools/k6-proofs` are dirty, when a
   selected row's manifest/scenario is untracked at that commit, or when the
   catalog preflight fails. Each of those writes one
   `<out-dir>/harness-control-receipt.json`, exits 78, and executes no rows.

5. Preserve candidate output. For live runs, `run-proofs.sh` writes artifacts under `--out-dir` (default `/tmp/k6-proof-runs`):

   ```text
   <out-dir>/harness-provenance.json   # docs ref, candidate, digests, row selection
   <out-dir>/<candidate-sha>/<ROW>/<seat>/<timestamp-row>/
   ├── row-manifest.json
   ├── row-scenario.js                 # the exact scenario source that fired
   ├── runner-metadata.json            # incl. docsRef / manifestSha256 / scenarioSha256
   ├── k6.log
   ├── evidence-lines.log
   ├── evidence.jsonl
   ├── run-result.json
   ├── candidate-run-result.json  # only when review-complete; never canonical proof
   └── *summary.json
   ```

   A k6 PASS-candidate is not a folded proof by itself. Gather the row-specific manual receipts listed in the row runbook.

## Shared manual receipts

Most continuation rows still need one or more of these after k6 runs:

- `seat-readiness.json`
- raw k6 stdout and generated summary JSON
- exact row manifest used
- session transcript excerpts or JSONL for parent/child/target sessions
- TaskFlow / flow rows when the behavior persists there
- gateway journal lines for continuation dispatch / queue drain / fanout / wake
- Tempo trace JSON, not just a trace URL:

  ```bash
  curl -fsS "${OPENCLAW_PROOFS_TEMPO_BASE_URL:-http://tempo.dandelion.cult}/api/traces/<trace-id>" \
    -o PROOFS/<sha>/<row>/<seat>/tempo/trace-<trace-id>.json
  ```

Trace JSON should be committed with the candidate proof artifacts whenever available because internal Tempo URLs are not public maintainer receipts. Before fetching traces from a candidate bundle, summarize review debt so null trace ids are not mistaken for fetchable receipts:

```bash
node tools/k6-proofs/scripts/summarize-review-debt.mjs \
  --run-root RUNBOOKS/project-81/candidate-runs/<sha>/<run-id>
```

If `tempo-trace-json` debt is reported as `tempo-trace-unfetchable`, the bundle emitted `traceId: null`; rerun with trace emission or explicitly accept trace-missing as an honest review limit before a canonical fold.

## What not to do

- Do not fold generated k6 artifacts as final proof verdicts without review.
- Do not treat `tasks.list` absence as a continue_delegate failure by itself; delegate rows use pending-delegate/subagent/session-delivery surfaces.
- Do not run same-session-unsafe continuation rows concurrently against the same target session.
- Do not use `validate-corpus --all` as the current-board gate until #271 is resolved; use `--index` for point-in-time current corpus validation.
