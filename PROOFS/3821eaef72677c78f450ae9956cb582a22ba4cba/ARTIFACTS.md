# ARTIFACTS — PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba

## What is published here

Per row: `EVIDENCE.md` and `PUBLIC-REVIEW.json`. This matches the established corpus shape — the
prior board publishes exactly these two files per row and no raw artifacts.

## What is retained privately

Raw per-row artifacts (34 directories, 685 files, 4.3 MB) are retained on the seat at:

```
ronan:/home/figs/actions-runner/_work/karmaterminal-openclaw-docs/karmaterminal-openclaw-docs/
  project81-k6-proof-artifacts/1baff536afa549fea75660403c453bbd265352c0/<ROW>/ronan/<timestamp>-<row>-743bccb7/
```

Each row's `PUBLIC-REVIEW.json` binds its private directory with
`privateRowArtifactSha256` (sha256 over a sorted `relpath sha256` manifest of that directory) plus
`privateRowArtifactFileCount`.

Retained per row: `run-result.json`, `candidate-run-result.json` (PASS rows only — a non-zero
effective exit legitimately suppresses it), `row-manifest.json`, `row-scenario.js`,
`runner-metadata.json`, `seat-readiness.json`, `k6.log`, `evidence.jsonl`, `evidence-lines.log`,
`gateway-journal.log`, the redaction reports, `openclaw-proofs-k6.otlp.json`,
`openclaw-proofs-k6.prom`, and where produced `tempo-trace-*.json` and
`continuation-trace-correlation.json`.

## Why the raw artifacts are not published

- `seat-readiness.json` carries `integrity.signature`, an HMAC keyed by the live gateway token.
- `gateway-journal.log` is a redacted service-log excerpt, redaction-reported but seat-local.

A publication scan over all 685 staged files found **zero** occurrences of the gateway token and no
bot-token, bearer, private-key or API-key patterns. Redaction ran on every row
(`openclaw.k6.public-evidence-redaction.v1`, 5 sensitive values removed per row; session keys and
nonces appear as `<redacted-session-key>` / `<redacted-nonce>`).
