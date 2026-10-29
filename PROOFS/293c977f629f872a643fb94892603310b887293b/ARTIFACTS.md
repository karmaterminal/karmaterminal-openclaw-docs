# Artifacts

Each row directory holds its public run directories exactly as `run-proofs.sh` wrote them: run-result, candidate envelope, public evidence, the redacted gateway journal with its redaction receipt, Tempo trace JSON and correlation where acquired, summaries, and the row manifest and scenario as fired.

- `<ROW>/matrix-012658Z/<run>/`: the canonical 27-row fire.
- `<ROW>/trace-refire-030423Z/<run>/`: the targeted trace refire (6 rows).
- `gates/fire-provenance/`: harness-provenance and seat-readiness for both fires.
- `gates/cure-bytes/`: the Gate 2 disposition.

The private acquisition (raw k6 logs, private evidence, the unredacted journal) was temporary and deleted by the runner. Before folding, everything was scanned for credential values (the gateway token value, bearer, sk-, JWT): none found. The bundle sha256 was `61da99c7ea772ca91dee9f8b7f37324cef9a012fac78c5556acc566b728577e4`.
