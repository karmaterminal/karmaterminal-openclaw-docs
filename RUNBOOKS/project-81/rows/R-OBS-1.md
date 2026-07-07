# R-OBS-1 row runbook

Status-card observability row. This row is read-only: it creates a disposable session by default, asks the agent to call `session_status`, and verifies that the resulting status card exposes build/version, context usage, continuation chain/queue visibility, and active route/delivery context.

## Safety

- `mutates: false`
- no continuation/delegate fire
- no config mutation
- no gateway restart
- no compaction request
- same-session safe when using disposable sessions

## Dry run

```bash
cd tools/k6-proofs
./scripts/run-proofs.sh --dry-run R-OBS-1 <candidate-sha>
```

## Live candidate run

```bash
cd tools/k6-proofs
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --live R-OBS-1 <candidate-sha>
```

The scenario writes candidate artifacts under the configured proof output root. Candidate artifacts are not canonical proof verdicts until reviewed/folded.

## Required receipts

- `seat-readiness.json`
- `row-manifest.json`
- `k6.log`
- `evidence.jsonl`
- `run-result.json`
- `r-obs-1-summary.json`

PASS-candidate requires the nonce-correlated `OBS1-STATUS` sentinel to report:

```text
BUILD yes CONTEXT yes CHAIN yes ROUTE yes
```

## Review notes

The historical manual row also attached Tempo JSON for `session_status`. The k6 candidate row records trace id when the gateway exposes one, but a null trace id is review debt only if the manifest requires trace JSON; do not synthesize trace debt when no trace id was emitted.
