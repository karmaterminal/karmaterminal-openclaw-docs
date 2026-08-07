# R-OBS-1 — Elliott comparator evidence

- Candidate: `4c235d8c1997e8964160117f8d6bf650ad1e8203`
- Canonical owner (preserved): 🌻 elliott-legion
- Execution seat: `elliott-legion`
- Execution role: `comparator`
- Conservative classification: **fail**
- Selected artifact: `comparators/elliott-legion/20260719T194038Z-r-obs-1/`
- Source kind: `elliott-run`

## Classification reasons

- authoritative candidate result is FAIL-CANDIDATE

## Missing mandatory receipts

- none

## Published public-safe artifacts

- `evidence-redaction.json` (evidence-redaction, sha256 `d05537e8be90862721719ee309c1927e3644dc582d828b7c742e7b1503eb0712`)
- `gateway-journal-capture.json` (gateway-journal-capture, sha256 `d6795952f5c832a855029760fb163fee7f05d99fb88776870a81a0c35804e16d`)
- `gateway-journal-redaction.json` (gateway-journal-redaction, sha256 `1a11adc71a3e3554ea7f4b258b0255afbae4ad23b2dce1cbcd7b63f55e69e866`)
- `k6.log` (k6-log, sha256 `af358565dda30be18d2e6bcdb3609141b2c3ae470dfd92ddc0ca6842d2df2613`)
- `r-obs-1-summary.json` (k6-summary, sha256 `43e730506fb8112c710d85814624a3f3e14f6e02c95c6a23da2be5c98e119a67`)
- `row-manifest.json` (row-manifest, sha256 `63588a11932ad7895575790664389d29ed9bfbd64cb205b0f9735044f8246655`)
- `run-result.json` (run-result, sha256 `c39a25ef74c58aa20837206803005d7ee50210ef3c2314da06c2a188a7ff4106`)
- `runner-metadata.json` (runner-metadata, sha256 `96af3b4445a2ee2cdd556209d9a02b4213f6a7dd1794a6d5797a184d6c73eee2`)

## Scope

This is comparator evidence. It does not replace, impersonate, or reassign the canonical owner. Candidate runner output is not promoted beyond the authority and receipts actually present.

## Review finding

The required-tool precondition failure is tracked as [karmaterminal-openclaw-docs#439](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/439). The disposable session's effective policy removed `session_status`, so the row could not exercise its intended status-card contract. The runner's explicit FAIL remains preserved; no behavioral refire or silent green fold was performed.
