# PROOFS / 2e7861ba45fd8534282aadabab2b855d2f524fdf

Active Project 81 corpus for the exact #1172 assembly SHA
`2e7861ba45fd8534282aadabab2b855d2f524fdf` (`OpenClaw 2026.7.2`).

This seed is published before proof collection so every prince has a canonical
row directory, manifest entry, and direct-to-main submission target. The
candidate repairs Codex executable continuation callback and drain-ownership
wiring. Copied exact-`4afd560` artifacts are historical only and do not prove
the repaired runtime.

## Seed rollup

`35 total / 6 unchanged-surface carried-pass / 1 partial / 28 missing`

| Surface | State | Exact-SHA requirement |
|---|---|---:|---|
| All `R-CD-*` rows | `missing` | fresh `continue_delegate` behavior and required trace/topology receipts |
| All `R-CW-*` rows | `missing` | fresh `continue_work` behavior and required durable wake/trace receipts |
| All `R-RC-*` rows | `missing` | fresh raw `request_compaction` result receipts; model sentinels are insufficient |
| Config/observability/redaction rows | `carried` | explicit unchanged-surface carry pending final closeout |
| `R-OBS-STATUS` | `partial` | exact-`4afd560` source receipt requires explicit byte-identical carry or rerun |

## Submission contract

Proof content lands directly on
`karmaterminal/karmaterminal-openclaw-docs:main`; do not create a proof PR or a
second proof branch.

Each row submission must include:

1. Exact runtime identity showing full SHA
   `2e7861ba45fd8534282aadabab2b855d2f524fdf`.
2. Workflow run and artifact IDs.
3. Raw row result/evidence bytes, not only a prose summary.
4. Required Tempo JSON under the row or corpus artifact tree.
5. A valid non-zero 32-hex trace ID and valid non-zero 16-hex span IDs.
6. For delayed continuation rows, fire and dispatch/work on the same trace with
   distinct span IDs.
7. Tool and bracket forms where the proof runbook requires both.
8. Updated row `EVIDENCE.md`, manifest row state, trace pointers, and rollup in
   the same commit.

Time-window-only matching, a nearby unlabelled span, `trace_id: null`, empty
evidence, all-zero IDs, or a behavior-only PASS is insufficient.

## Direct-to-main fold steps

1. Verify `gh api user` is the submitting prince's `*-dandelion-cult` account.
2. Pull docs `main` with `git pull --ff-only`.
3. Add reviewed raw receipts beneath this exact-SHA corpus.
4. Update the owned row evidence and `proofs-manifest.json` atomically.
5. Run:

   ```bash
   node tools/k6-proofs/scripts/validate-corpus.mjs \
     --sha 2e7861ba45fd8534282aadabab2b855d2f524fdf
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
