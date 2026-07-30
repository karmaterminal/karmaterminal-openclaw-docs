# R-REGRESSION-TRAP-TESTS candidate source receipt (elliott-legion)

- Issue: `karmaterminal/karmaterminal-openclaw-docs#489`
- Candidate/source checkout: `374ad60c6d34d3c710ddab3a13ce2189e1fd09fb`
- Reviewed docs harness: `a566100da92a87a7fa61d5d742a745f5964d4dbf`
- Execution class: offline/static plus exact-candidate focused source tests
- Proposed state: `pass`

## Result

The committed static validator returned `PASS-candidate` for its INDEX-selected
reference packet. The documented manual source replay then ran on a clean,
isolated checkout at the exact candidate SHA:

```text
src/agents/tools/continuation-inventory-opts.test.ts                  5/5
src/agents/openclaw-tools.continuation-registration.test.ts          8/8
src/agents/openclaw-tools.continuation-misconfig-warn.test.ts         7/7
src/agents/tools/continuation-tools-registration.test.ts             13/13
Total                                                                33/33 PASS
```

The candidate currently routes these files through three Vitest shards; all
three passed. This supersedes the historical packet's 31-test count for the
fresh candidate receipt without altering the static validator's reference
contract.

## Receipts

| Receipt | Result |
|---|---|
| `regression-trap-artifacts` | PASS: reference evidence/log/source/test inventory parsed |
| `regression-tests-passed` | PASS: exact-candidate focused replay passed 33/33 |
| Source identity | PASS: detached clean checkout at the full candidate SHA |

The issue's direct command first stopped during k6 initialization because its
manifest path resolved with a duplicated `tools/k6-proofs` prefix. No iteration
or product invocation occurred. The documented direct-scenario fallback ran with
the scenario-relative `manifests/r-regression-trap-tests.json` path.

Both-forms mandate: not applicable. Token-surface provenance: not applicable;
this row invokes no continuation token or tool. Tempo and gateway journal
receipts are not applicable to this source-test row.

**No secrets:** these artifacts contain no tokens, prompt bodies, user content,
nonces, raw gateway payloads, actual session keys, or private filesystem paths.
