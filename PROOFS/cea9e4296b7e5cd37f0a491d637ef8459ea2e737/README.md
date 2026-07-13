# PROOFS / cea9e4296b7e5cd37f0a491d637ef8459ea2e737

Active Project 81 corpus for the exact #1172 assembly SHA
`cea9e4296b7e5cd37f0a491d637ef8459ea2e737` (`OpenClaw 2026.7.2`).

This seed is published before proof collection so every prince has a canonical
row directory, manifest entry, and direct-to-main submission target. The
candidate repairs Codex classification of successful continuation and
compaction tool results. Copied exact-`2e7861b` artifacts are historical only
and do not prove completed Codex tool status on the repaired runtime.

## Seed rollup

`35 total / 6 unchanged-surface carried-pass / 1 partial / 28 missing`

| Surface | State | Exact-SHA requirement |
|---|---|---:|---|
| All `R-CD-*` rows | `missing` | fresh `continue_delegate` behavior, successful Codex tool status, and required trace/topology receipts |
| All `R-CW-*` rows | `missing` | fresh `continue_work` behavior and required durable wake/trace receipts |
| All `R-RC-*` rows | `missing` | fresh raw `request_compaction` result receipts with successful Codex status; model sentinels are insufficient |
| Config/observability/redaction rows | `carried` | explicit unchanged-surface carry pending final closeout |
| `R-OBS-STATUS` | `partial` | exact-`4afd560` source receipt requires explicit byte-identical carry or rerun |

Offline/static scenarios read immutable receipt bytes from
`PROOFS/1cc8f4e3d617ef6f173283ef83d7b739a4995734/`, recorded as
`PROOFS/INDEX.json::static_evidence_sha`. Their output must report both the
active `currentProofSha` and the historical `sourceEvidenceSha`. Such a result
can support an unchanged-surface carry; it is not fresh runtime proof of
`cea9e42`.

## Submission contract

Proof content lands directly on
`karmaterminal/karmaterminal-openclaw-docs:main`; do not create a proof PR or a
second proof branch.

Each row submission must include:

1. Exact runtime identity showing full SHA
   `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`.
2. Workflow run and artifact IDs.
3. Raw row result/evidence bytes, not only a prose summary.
4. Required Tempo JSON under the row or corpus artifact tree.
5. A valid non-zero 32-hex trace ID and valid non-zero 16-hex span IDs.
6. For delayed continuation rows, fire and dispatch/work on the same trace with
   distinct span IDs.
7. For Codex rows, an actual successful originating tool span and no
   `codex_dynamic_tool_error`.
8. Tool and bracket forms where the proof runbook requires both.
9. Updated row `EVIDENCE.md`, manifest row state, trace pointers, and rollup in
   the same commit.

Time-window-only matching, a nearby unlabelled span, `trace_id: null`, empty
evidence, all-zero IDs, or a behavior-only PASS is insufficient.

## Dispatch allocation (authoritative for this cycle)

This exact-SHA mapping is the one-fire dispatch authority for `cea9e42`. The
generic owner table in `RUNBOOKS/PROOF-CORPUS-METHOD.md` records historical
domain stewardship only and must not override this cycle allocation.

| Seat | Rows |
|---|---|
| 🌫 Silas | `R-CD-1`, `R-CW-1` |
| 🌻 Elliott | `R-CONFIG-DEFAULTS`, `R-CONFIG-INTERSESSION`, `R-OBS-1`, `R-OBS-2`, `R-OBS-STATUS`, `R-REGRESSION-TRAP-TESTS`, `R-TRACE-REDACTION-1121` |
| 🩸 Cael | `R-CD-2`, `R-CD-4`, `R-CD-CHAINED-DEPTH-2`, `R-CD-COLLECTION-ON-COLLAPSE`, `R-CD-MODEL-CHAINED-ALT`, `R-CD-MODEL-DEFAULT`, `R-CD-MODEL-TOKEN`, `R-CD-MODEL-TOOL`, `R-CD-RETURN-OVERLAP`, `R-CD-SILENT`, `R-CD-TOKEN` |
| 🌊 Ronan | `R-CD-3`, `R-CW-2`, `R-CW-3`, `R-CW-4`, `R-CW-5`, `R-CW-6`, `R-CW-7`, `R-CW-DELEGATE-CHILD-LIVE`, `R-CW-DELEGATE-SELF-CONTINUATION`, `R-CW-DELEGATE-TOKEN`, `R-CW-MULTI`, `R-CW-MULTI-COLLAPSE`, `R-CW-TOKEN`, `R-RC-1`, `R-RC-2` |

Every row appears exactly once. Already-executed rows remain consumed even when
their evidence is partial, failed, or non-foldable. A cancelled or skipped row
that never started remains eligible for one fire. The earlier duplicate
`R-OBS-1` receipt is retained as non-foldable; the first execution is canonical.

## Direct-to-main fold steps

1. Verify `gh api user` is the submitting prince's `*-dandelion-cult` account.
2. Pull docs `main` with `git pull --ff-only`.
3. Add reviewed raw receipts beneath this exact-SHA corpus.
4. Update the owned row evidence and `proofs-manifest.json` atomically.
5. Run:

   ```bash
   node tools/k6-proofs/scripts/validate-corpus.mjs \
     --sha cea9e4296b7e5cd37f0a491d637ef8459ea2e737
   ```

6. Commit and push directly to docs `main`.
7. Post the commit, workflow run, artifact ID, and trace ID to the coordination
   issue/channel.

## Navigation

- `proofs-manifest.json` — machine-readable 35-row board
- `RESOLVED-SHA.md` — assembly identity and gate receipts
- `ARTIFACTS.md` — carried and fresh artifact index
- `METHOD.md` — exact-SHA proof/fold method
- `<ROW>/EVIDENCE.md` — row-owned evidence
