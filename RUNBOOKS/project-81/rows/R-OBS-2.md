# R-OBS-2 row runbook

Offline/static observability row for the committed current-corpus trace-tree/span-tree artifacts. This row does not connect to the gateway; it parses committed `PROOFS/<current_sha>/R-OBS-2` artifacts and verifies the trace-tree/lineage receipts expected by the manual proof.

## Safety

- `mutates: false`
- no gateway token required
- no live session required
- no config mutation or restart
- safe for unattended broad suite

## Dry run

```bash
cd tools/k6-proofs
./scripts/run-proofs.sh --dry-run R-OBS-2 <candidate-sha>
```

## Live/static candidate run

```bash
cd tools/k6-proofs
./scripts/run-proofs.sh --live R-OBS-2 <candidate-sha>
```

Because this is an offline/static row, “live” means the runner emits candidate artifacts from committed corpus inspection; it does not touch a live OpenClaw gateway.
