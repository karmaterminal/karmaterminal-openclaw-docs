# R-OBS-STATUS — Elliott comparator evidence

- Candidate: `4c235d8c1997e8964160117f8d6bf650ad1e8203`
- Canonical owner (preserved): 🌻 elliott-legion
- Execution seat: `elliott-legion`
- Execution role: `comparator`
- Conservative classification: **partial**
- Selected artifact: `comparators/elliott-legion/20260719T194146Z-r-obs-status/`
- Source kind: `elliott-run`

## Classification reasons

- terminal candidate verdict is BAD_PROOF
- effective exit code is 99
- review-complete candidate envelope is absent
- behavior/publication authority is absent
- one or more allowlisted artifacts were withheld by the secret/private-path scan

## Missing mandatory receipts

- none

## Published public-safe artifacts

- `evidence-redaction.json` (evidence-redaction, sha256 `db13e4c67a5859509fe23494d8bdba63ff48759fd86a004b957a49d309cce821`)
- `gateway-journal-capture.json` (gateway-journal-capture, sha256 `e9bc5a95b7d5c7d87c08886bc55a26185c19485ebf68b116932122868c7b771f`)
- `gateway-journal-redaction.json` (gateway-journal-redaction, sha256 `f761c8095b96f896b1ed7d0492152b1573e187eb76ab0bc90988d514316c3052`)
- `gateway-journal.log` (gateway-journal, sha256 `d45cb86f68e5266503b1e5a0537b9e981258bc99b9213b6841191694abcdc0c3`)
- `k6.log` (k6-log, sha256 `a46fca7e1625c06cc061595b63b37142e079300b22c03daff3c7c149f108227d`)
- `r-obs-status-summary.json` (k6-summary, sha256 `ba8b806c4be215b2afba78c3aebf1c9d5752c760dfbb688d6b0cdb734347bd36`)
- `row-manifest.json` (row-manifest, sha256 `a422a42b931e517fede6be29087459fb80e0bb190f178c4c7f84ec95e68a0ef1`)
- `run-result.json` (run-result, sha256 `08f1279e292fdf0e6bb94f74bcc989ef64f230dff3d22e2bc89584750e313476`)
- `runner-metadata.json` (runner-metadata, sha256 `087bdc8a8f45ac7e9ac38bbbf425f622bfab3326ac20d16ac75928f52b65e999`)

## Scope

This is comparator evidence. It does not replace, impersonate, or reassign the canonical owner. Candidate runner output is not promoted beyond the authority and receipts actually present.

## Review finding

The formatter extraction failure is tracked as [karmaterminal-openclaw-docs#438](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/438). The exact candidate moved the formatter definition to `src/status/status-continuation-line.ts` while the harness still searched `src/status/status-text.ts`. This attempt was not refired; it remains harness-invalid/partial evidence.
