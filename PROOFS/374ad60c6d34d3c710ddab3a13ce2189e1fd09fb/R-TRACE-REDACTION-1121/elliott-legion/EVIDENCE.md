# R-TRACE-REDACTION-1121 candidate source receipt (elliott-legion)

- Issue: `karmaterminal/karmaterminal-openclaw-docs#490`
- Candidate/source checkout: `374ad60c6d34d3c710ddab3a13ce2189e1fd09fb`
- Reviewed docs harness: `a566100da92a87a7fa61d5d742a745f5964d4dbf`
- Execution class: offline/static plus exact-candidate focused source tests
- Proposed state: `pass`

## Result

The committed static validator returned `PASS-candidate` for its INDEX-selected
reference packet. The exact-candidate manual replay then passed:

```text
src/infra/continuation-tracer.test.ts: 35/35 PASS
```

Candidate source exposes only the safe reason attributes `reason.present`,
`reason.length`, `reason.hash`, and `reason.redacted`; the focused tests assert
that `reason.preview` is absent and raw reason text is not present in exported
attribute values.

## Receipts

| Receipt | Result |
|---|---|
| `trace-redaction-contract` | PASS: safe attributes present; raw preview excluded |
| `trace-redaction-tests-passed` | PASS: exact-candidate focused replay passed 35/35 |
| Source identity | PASS: detached clean checkout at the full candidate SHA |

The issue's direct command first stopped during k6 initialization because its
manifest path resolved with a duplicated `tools/k6-proofs` prefix. No iteration
or product invocation occurred. The documented direct-scenario fallback ran with
the scenario-relative `manifests/r-trace-redaction-1121.json` path.

Both-forms mandate: not applicable. Token-surface provenance: not applicable;
this row invokes no continuation token or tool. Tempo and gateway journal
receipts are not applicable to this source-test row.

**No secrets:** these artifacts contain no tokens, prompt bodies, user content,
nonces, raw gateway payloads, actual session keys, or private filesystem paths.
