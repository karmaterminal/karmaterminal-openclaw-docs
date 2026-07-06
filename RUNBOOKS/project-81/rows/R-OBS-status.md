# R-OBS-status row runbook

## Status

Runnable. Read-only gateway observer/status receipt row. Repeatability-hardened
for exact-head live smoke runs on Cael; the row does not fire continuation tools
or mutate gateway/session state.

- Manifest: `tools/k6-proofs/manifests/r-obs-status.json`
- Scenario: `tools/k6-proofs/scenarios/r-obs-status.js`
- Workflow choice: `r-obs-status`
- Live safety: `k6-runnable`

## Purpose

Prove the proof harness can collect an observer/status receipt from the target gateway without firing continuation tools or mutating state.

## Commands

Runner dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-OBS-status <candidate-sha>
```

Live read-only smoke:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-OBS-status <candidate-sha>
```

Direct k6 form:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-obs-status.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/r-obs-status.js 2>&1 | tee /tmp/r-obs-status-k6.log
```

## k6 covers

- WebSocket connect/auth accepted.
- Gateway `status` request accepted.
- Redacted observer receipt printed as `R_OBS_STATUS_EVIDENCE`.
- Summary JSON verdict is `PASS-candidate` when `proof_failures=0`.

## Manual collection still needed

- Save the runner artifact directory; it contains `k6.log`, `row-manifest.json`, `runner-metadata.json`, `run-result.json`, `evidence-lines.log`, and generated summary JSON when present.
- Summary JSON is moved into the runner artifact directory automatically for live runs.
- If the status payload includes a traceparent/trace id, fetch Tempo JSON and store it under `PROOFS/<sha>/R-OBS-status/<seat>/tempo/`.
- If no trace id is emitted, record that explicitly; for status-only rows this is a receipt limitation, not automatically a product failure. The manifest treats `tempo-trace-id` as optional for this reason; `observer-receipt` is the required receipt.

## Exact-head Cael repeatability receipt

Candidate/runtime target:

```text
1cc8f4e3d617ef6f173283ef83d7b739a4995734
OpenClaw 2026.6.11 (1cc8f4e)
```

On 2026-07-06T01:22Z, Cael ran three live read-only iterations against
the exact-head deployment. All three exited `0` and produced
`PASS-candidate` summaries with `proof_failures=0` and an accepted
`status` response:

```text
run 1: PASS-candidate, duration_avg=682ms, k6ExitCode=0, started=2026-07-06T01:22:23.820Z
run 2: PASS-candidate, duration_avg=629ms, k6ExitCode=0, started=2026-07-06T01:22:26.230Z
run 3: PASS-candidate, duration_avg=628ms, k6ExitCode=0, started=2026-07-06T01:22:28.629Z
```

The status payload did not emit a trace id in these runs (`trace_id: null`),
so no Tempo JSON is expected for this row. Candidate artifacts were preserved
under:

```text
/tmp/k6-proof-runs-rrc2-natural/1cc8f4e3d617ef6f173283ef83d7b739a4995734/R-OBS-STATUS/cael/
```

## Fold guidance

This row is read-only. It can support observability/readiness claims, not continuation behavior claims.
