# k6 PROOFS live-run safety and review gates

This document is the contract for **which proof rows are safe to run automatically**,
**which require orchestration outside the k6 harness**, and **how a candidate row is
gated before it is treated as proof-standard evidence**.

It addresses [#146](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/146)
("define live-run safety and review gates for proof rows") by surfacing what was
previously scattered across manifests, scenarios, and the CONTRIBUTING checklist
into a single maintainer-readable reference.

The goal is to avoid two failure modes:

1. **False proof failures** — a row reports `FAIL` because the seat lacked a
   token, the session was wrong, or a tool surface needed orchestration the k6
   harness cannot drive.
2. **Unsafe live fire** — a row that mutates config, restarts services, or
   collides with another live row on the same session is fired without the
   coordination its design assumed.

## Row safety classes

Every row in `tools/k6-proofs/manifests/` falls in exactly one class. The class
is implied today by the combination of `scenario.status`, `mutates`,
`review.candidateOnly`, `review.foldRequiresReview`, and the row's `expectedReceipts`.
The optional `liveRun` block (see [Schema additions](#schema-additions) below)
records the same intent explicitly for tooling.

### Class A — Offline / preflight

Reads only. No live gateway connection beyond optional liveness check. Output
is candidate-only by definition.

Examples: `preflight.example.json`, the golden-path postprocessor smoke.

- Live gateway token: not required for the offline smoke; required for the
  WS preflight scenario.
- Target session key: not used to fire continuation/delegate.
- Outside-k6 orchestration: none.
- Safe to run concurrently with other rows: yes.
- Expected artifact class: `PASS-candidate` or `HONEST-LIMIT-candidate`.

### Class B — Live continuation/delegate, k6-driven

Real WebSocket dispatch through the harness. The continuation or delegate
fires through `sessions.send` / `tools.invoke` / typed-tool form. The harness
observes session-events for receipts.

Examples (runnable today): `r-cd-2.json` → `r-cd-2-silent-wake.js`,
`r-cd-4.json` → `r-cd-4-target-session-key.js`,
`r-cd-chained-depth-2.json` → `r-cd-chained-depth-2.js`,
`r-cw-1.json` → `r-cw-1.js`.

- Live gateway token: required.
- Target session key: required; must be a session the operator owns or has
  coordination clearance for.
- Outside-k6 orchestration: none for the dispatch path itself. Trace/log
  collection (Tempo, Loki) may still be manual until those receipts land in
  the postprocessor.
- Safe to run concurrently with other rows on the **same session**: no. Run
  one continuation row per session at a time.
- Expected artifact class: `PASS-candidate`. Folds to `pass` only after a
  human review of receipts.

### Class C — Live continuation requiring agent / prince orchestration

The proof shape needs an agent (model run) or a prince in the loop to emit
the bracket/token/message that triggers the feature under test. The k6
harness cannot synthesize the trigger on its own.

Examples: `r-cd-token.json` (bracket-token scanner; seat-class dependent),
`r-cw-token.json`, `r-cw-delegate-self.json`,
`r-cd-collection-on-collapse.json` (detached intermediate design),
`r-cd-model-*` rows (model byte must come from a real agent run).

- Live gateway token: required.
- Target session key: required, and must be a session bound to the agent
  that will emit the token/message.
- Outside-k6 orchestration: required. The row PR body must describe how the
  trigger was emitted (which seat, which agent, which prompt class).
- Safe to run concurrently: no.
- Expected artifact class: `PASS-candidate` when receipts align with the
  declared seat-class expectation, `HONEST-LIMIT-candidate` when the seat
  class predicts a no-fire (e.g. `message-body` seat for the bracket
  scanner — declared **before** the run in the manifest's
  `seatClassExpectation`, not retrofitted).

### Class D — Config / safety / restart class

Rows that mutate gateway config, restart services, or otherwise change
fleet state. These need explicit pre-/post-state capture and a restore
plan, and they belong off the automatic-run path until coordination is in
place.

Examples: `r-cw-5.json` (cost cap), `r-cw-6.json` (max chain length),
`r-rc-2.json` (request_compaction accept), other config/scheduler rows.

- Live gateway token: required.
- Target session key: required and may need to be an isolated session.
- Outside-k6 orchestration: required — operator captures pre-state,
  applies the change, fires the row, and either restores the change or
  records why the rolled-forward state stays. Do not fold a row that
  mutated config without showing the restore (or an explicit no-restore
  justification).
- Safe to run concurrently: no, and not concurrent with any live row on
  the same fleet.
- Expected artifact class: `PASS-candidate` or `HONEST-LIMIT-candidate`
  depending on the row's declared expectation; `mutates: true` is required
  on the manifest.

## How a maintainer reads safety state today

Until tooling auto-walks the manifests, use the registry helper:

```bash
node tools/k6-proofs/scripts/check-live-run-safety.mjs
```

This walks `tools/k6-proofs/manifests/*.json` and prints a table per row:

| Column | Meaning |
| --- | --- |
| `row` | Manifest row id |
| `status` | `runnable` / `scaffold` / `construct-only` |
| `class` | Inferred row class (`A`/`B`/`C`/`D`) |
| `mutates` | Manifest `mutates` flag |
| `concurrent` | `liveRun.safeToRunConcurrently` (default: `false` for live rows) |
| `external` | `liveRun.requiresOutsideK6Orchestration` (default: `false`) |
| `candidate` | `review.candidateOnly` (must be `true`) |
| `review` | `review.foldRequiresReview` (must be `true`) |

The script reports a non-zero exit if a manifest's declared fields are
internally inconsistent (e.g. `mutates: true` but `liveRun.requiresOutsideK6Orchestration:
false`). It never mutates manifests.

## Schema additions

The `openclaw.k6.proof-row-manifest.v1` schema gains an optional `liveRun`
block. Existing manifests without the block remain valid; the helper above
infers safe defaults.

```jsonc
{
  "schema": "openclaw.k6.proof-row-manifest.v1",
  "rowId": "R-CD-2",
  // ...
  "liveRun": {
    "requiresLiveGatewayToken": true,
    "requiresTargetSessionKey": true,
    "requiresOutsideK6Orchestration": false,
    "safeToRunConcurrently": false,
    "expectedArtifactClass": "PASS-candidate",
    "notes": "k6-driven continue_delegate via sessions.send; single-VU only."
  }
}
```

All fields are optional and have explicit defaults documented in the
schema. The maintainer-facing checker, postprocessor, and dashboards are
free to read the block when present and fall back to inferred values when
it is absent.

`expectedArtifactClass` values mirror the existing artifact class names:

- `PASS-candidate`
- `PARTIAL-candidate`
- `HONEST-LIMIT-candidate`
- `FAIL-candidate`
- `construct-only`

## Review gates before fold

A row PR is reviewable when it satisfies the
[`CONTRIBUTING-ROWS.md`](CONTRIBUTING-ROWS.md) checklist and the
[`validate-corpus.mjs`](scripts/validate-corpus.mjs) invariants. This file
adds the live-run safety lens:

- [ ] The manifest's row class is identifiable from `scenario.status`,
  `mutates`, and (if present) `liveRun`.
- [ ] If `mutates: true`, the EVIDENCE.md captures pre-state, the change,
  and the restore (or an explicit no-restore justification).
- [ ] If `liveRun.requiresOutsideK6Orchestration: true`, the PR body or
  EVIDENCE.md names the seat, the agent/prince, and the emission shape.
- [ ] If `liveRun.safeToRunConcurrently: false`, no concurrent live row
  was fired against the same session during the run window.
- [ ] The candidate artifact's outcome matches the manifest's
  `expectedArtifactClass` (or the manifest's `seatClassExpectation` for
  bracket-scanner-class rows).
- [ ] Secrets are not in the diff, evidence, or PR body.

A candidate that fails these gates stays candidate-only. Fold-time
review by the coordinator promotes a candidate to `pass` only after the
gates are recorded in EVIDENCE.md.

## See also

- [`README.md`](README.md) — harness usage, runnable scenarios.
- [`CONTRIBUTING-ROWS.md`](CONTRIBUTING-ROWS.md) — prince-facing PR checklist.
- [`METRICS.md`](METRICS.md) — observability and dashboard contract.
- [`row-manifest.schema.json`](row-manifest.schema.json) — manifest schema.
- [`scripts/check-live-run-safety.mjs`](scripts/check-live-run-safety.mjs) — registry walker.
