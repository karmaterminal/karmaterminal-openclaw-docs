# PROOFS / a1778c94732a25292b4223736fa995b5cd42fe78

Active Project 81 corpus for the exact #1172 assembly SHA
`a1778c94732a25292b4223736fa995b5cd42fe78` (`OpenClaw 2026.7.2`).

This seed is published before proof collection so every prince has a canonical
row directory, manifest entry, and direct-to-main submission target. Carried
artifacts are baseline evidence only; they do not prove the new tracing repair.

## Seed rollup

`35 total / 29 carried-pass / 1 partial / 1 carried-honest-limit / 4 missing`

| Row | Owner | State | Exact-SHA requirement |
|---|---|---:|---|
| `R-CD-1` | 🌫 Silas | `missing` | typed delegate schedule/spawn/return plus attributable Tempo trace |
| `R-CD-2` | 🩸 Cael | `missing` | silent-wake return, no outbound delivery, plus attributable Tempo trace |
| `R-CD-3` | 🌊 Ronan | `missing` | post-compaction lifeboat plus attributable Tempo trace |
| `R-CW-1` | 🌫 Silas + 🩸 Cael | `missing` | tool and bracket successor turns, durable wake, valid trace continuity |
| `R-OBS-STATUS` | 🌻 Elliott + 🌊 Ronan | `partial` | reviewed exact-SHA active-line/absent-line contrast |

`R-RC-2` retains the published corpus's honest-limit classification for
context-pressure rejection of `request_compaction`.

## Submission contract

Proof content lands directly on
`karmaterminal/karmaterminal-openclaw-docs:main`; do not create a proof PR or a
second proof branch.

Each row submission must include:

1. Exact runtime identity showing full SHA
   `a1778c94732a25292b4223736fa995b5cd42fe78`.
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
     --sha a1778c94732a25292b4223736fa995b5cd42fe78
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
