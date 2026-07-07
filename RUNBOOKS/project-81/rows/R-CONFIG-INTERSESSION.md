# R-CONFIG-INTERSESSION row runbook

Read-only continuation config row. This row verifies that the deployed gateway exposes `agents.defaults.continuation.crossSessionTargeting` as `enabled` through the config receipt path required by cross-session delegate rows.

## Safety

- `mutates: false`
- no continuation/delegate fire
- no config mutation
- no gateway restart
- no compaction request
- disposable session recommended

## Dry run

```bash
cd tools/k6-proofs
./scripts/run-proofs.sh --dry-run R-CONFIG-INTERSESSION <candidate-sha>
```

## Live candidate run

```bash
cd tools/k6-proofs
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --live R-CONFIG-INTERSESSION <candidate-sha>
```

PASS-candidate requires the scenario to read continuation config and observe cross-session targeting as enabled. Candidate artifacts require review before canonical fold.
