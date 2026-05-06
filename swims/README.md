# Swim index

Public-facing evidence index for continuation-feature integration swims. Per figs's directive 2026-05-06 18:51Z, this index slots known historical swims so the cohort can arrange a comprehensive set for v2026.5.5 release-facing testing reconstruction.

## Currently in this repo (public evidence surface)

| Swim | Era | Status | Anchor |
|---|---|---|---|
| [Swim 9](swim-09/README.md) | early canary | retained historical | volitional-compaction, 5/5 PASS |
| [Swim 10](swim-10/README.md) | full tool-parity canary | retained historical | 12 PASS / 1 DEFERRED, 13-row scorecard |
| [Swim 41](swim-41/README.md) | v5.2 substrate verification | recent OV-row-driven | 3/4 OV closed; OV-4 in flight |
| [Swim 42](swim-42/README.md) | v5.2 final-release integration | recent rows-era | Option B minimum-viable |

## Known historical swims documented elsewhere (NOT yet in this repo)

Per cohort archaeology 2026-05-06, evidence for these swims lives in [`karmaterminal/openclaw-bootstrap`](https://github.com/karmaterminal/openclaw-bootstrap) and/or in [`karmaterminal/openclaw`](https://github.com/karmaterminal/openclaw) frozen-branch RFC history:

| Swim | Where to find evidence | Era / shape |
|---|---|---|
| Swim 5 | [`openclaw-bootstrap/SWIM/history/SWIM5-STATUS.md`](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/SWIM/history/SWIM5-STATUS.md) | early — status doc |
| Swim 6 | [`openclaw-bootstrap/SWIM/history/SWIM6-FINDINGS.md`](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/SWIM/history/SWIM6-FINDINGS.md) + [`SWIM6-PROTOCOL.md`](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/SWIM/history/SWIM6-PROTOCOL.md) | early — findings + protocol |
| Swim 7 | [`openclaw-bootstrap/SWIM/history/SWIM7-RESULTS.md`](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/SWIM/history/SWIM7-RESULTS.md) + [`silas-likes-to-watch/swim-logs/`](https://github.com/karmaterminal/silas-likes-to-watch/tree/main/swim-logs) | early — results + raw logs |
| Swim 8 | RFC history on `feature/context-pressure-squashed` lineage in `karmaterminal/openclaw` | early; thin in current archives |
| Swim 31 | [`openclaw-bootstrap/SWIM/history/SWIM31-EVIDENCE.md`](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/SWIM/history/SWIM31-EVIDENCE.md) | mid — evidence doc |
| [Swim 34](swim-34/README.md) | [`openclaw-bootstrap/swims/swim-34-formal-matrix/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-34-formal-matrix) (largest matrix-era board) + [`swim-34-staleness/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-34-staleness) | formal matrix era |
| [Swim 35](swim-35/README.md) | [`openclaw-bootstrap/swims/swim-35-stabilization/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-35-stabilization) | stabilization cycle |
| [Swim 36](swim-36/README.md) | [`openclaw-bootstrap/swims/swim-36/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-36) | mid cycle |
| [Swim 37](swim-37/README.md) | [`openclaw-bootstrap/swims/swim-37/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-37) + [`SWIM/lessons/swim-37-*`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/SWIM/lessons) | heartbeat-era + lessons |
| [Swim 38](swim-38/README.md) | [`openclaw-bootstrap/swims/swim-38-slippy-hoodie/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-38-slippy-hoodie) | slippy-hoodie cycle |
| [Swim 39](swim-39/README.md) | [`openclaw-bootstrap/swims/swim-39-volatile-purge/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-39-volatile-purge) | volatile-purge cycle |
| [Swim 40](swim-40/README.md) | [`openclaw-bootstrap/swims/swim-40-v29-substrate-verification/`](https://github.com/karmaterminal/openclaw-bootstrap/tree/main/swims/swim-40-v29-substrate-verification) | v29 substrate verification |

## Genuinely thin spots / gaps

Swims **11–30** (except Swim 31), and **32–33** — these are not currently archived in either repo at a citable level. The earlier RFC inline summaries on `feature/context-pressure-squashed` lineage carry some bridge material but no dedicated swim-folders exist for these numbers.

## Canonical anchors for full-suite reconstruction

- [`openclaw-bootstrap#427`](https://github.com/karmaterminal/openclaw-bootstrap/issues/427) — Swim 29 formal test matrix (canonical row inventory)
- [`openclaw-bootstrap#412`](https://github.com/karmaterminal/openclaw-bootstrap/issues/412) — continuation public-surface audit (tokens / tools / visibility / coexistence)
- [`openclaw-bootstrap/SWIM/FORMAL-SWIM-RUNBOOK.md`](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/SWIM/FORMAL-SWIM-RUNBOOK.md) — synthesized authoritative runbook

## Provenance

Swim slot-entries 34–40 in this PR are **slot stubs** authored 2026-05-06 by 🌿 frond-scribe pointing at the bootstrap source-of-truth. They do not yet replicate the full bootstrap evidence into the docs repo. That fuller migration is left to follow-on work (likely 🌻 Elliott per figs's "🌻 can arrange a nice set of 'all of the things'") so a single human can shape the public arrangement coherently.

🌿 frond-scribe • 2026-05-06
