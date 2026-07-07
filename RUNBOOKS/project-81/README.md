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

As of the post-#306/#307 Project 81 surface, the broad live slice is:

```text
R-CD-1,R-CD-2,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-MODEL-CHAINED-ALT,R-CD-MODEL-DEFAULT,R-CD-MODEL-TOKEN,R-CD-MODEL-TOOL,R-CD-TOKEN,R-CONFIG-defaults,R-CW-1,R-CW-4,R-CW-DELEGATE-SELF-CONTINUATION,R-CW-TOKEN,R-OBS-status,R-RC-1
```

`preflight` remains `static-preflight-only`: the runner performs seat-readiness preflight for live runs, but the preflight manifest row is intentionally skipped by live-run guard.

The current canonical manual corpus has 29 rows under `PROOFS/INDEX.json`. The k6 manifest registry covers all 29: runnable/scaffold manifests for rows with executable fixtures, and `construct-only` manifests for rows that are currently manual-corpus receipts only. Check the coverage map with:

```bash
node tools/k6-proofs/scripts/check-current-corpus-manifest-coverage.mjs
```

`extraNonCorpusRows` in that report are supplemental automation rows that are not entries in the current 29-row manual corpus.

Use this directory as the accumulator. When a scaffold row becomes runnable, add or update `RUNBOOKS/project-81/rows/<ROW>.md` in the same PR as the scenario/manifest change.

## Current runnable row runbooks

- [preflight](rows/preflight.md) — static preflight / seat-readiness helper
- [R-CD-1](rows/R-CD-1.md)
- [R-CD-2](rows/R-CD-2.md)
- [R-CD-4](rows/R-CD-4.md)
- [R-CD-CHAINED-DEPTH-2](rows/R-CD-CHAINED-DEPTH-2.md)
- [R-CD-MODEL-CHAINED-ALT](rows/R-CD-MODEL-CHAINED-ALT.md)
- [R-CD-MODEL-DEFAULT](rows/R-CD-MODEL-DEFAULT.md)
- [R-CD-MODEL-TOKEN](rows/R-CD-MODEL-TOKEN.md)
- [R-CD-MODEL-TOOL](rows/R-CD-MODEL-TOOL.md)
- [R-CD-TOKEN](rows/R-CD-TOKEN.md)
- [R-CONFIG-defaults](rows/R-CONFIG-defaults.md)
- [R-CW-1](rows/R-CW-1.md)
- [R-CW-4](rows/R-CW-4.md)
- [R-CW-DELEGATE-SELF-CONTINUATION](rows/R-CW-DELEGATE-SELF-CONTINUATION.md)
- [R-CW-TOKEN](rows/R-CW-TOKEN.md)
- [R-OBS-status](rows/R-OBS-status.md)
- [R-RC-1](rows/R-RC-1.md)

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

4. Live-run only when the row runbook says it is safe:

   ```bash
   cd tools/k6-proofs
   OPENCLAW_GATEWAY_TOKEN=*** \
   OPENCLAW_SESSION_KEY=<target-session-key> \
     ./scripts/run-proofs.sh --live <ROW> <candidate-sha>
   ```

5. Preserve candidate output. For live runs, `run-proofs.sh` writes artifacts under `--out-dir` (default `/tmp/k6-proof-runs`):

   ```text
   <out-dir>/<candidate-sha>/<ROW>/<seat>/<timestamp-row>/
   ├── row-manifest.json
   ├── runner-metadata.json
   ├── k6.log
   ├── evidence-lines.log
   ├── evidence.jsonl
   ├── run-result.json
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
  curl -fsS "http://tempo.dandelion.cult/api/traces/<trace-id>" \
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
