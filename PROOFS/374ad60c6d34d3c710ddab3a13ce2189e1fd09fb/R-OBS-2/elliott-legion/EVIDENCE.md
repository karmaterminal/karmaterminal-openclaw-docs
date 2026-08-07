# R-OBS-2 static validator receipt (elliott-legion)

- Issue: `karmaterminal/karmaterminal-openclaw-docs#485`
- Candidate: `374ad60c6d34d3c710ddab3a13ce2189e1fd09fb`
- Reviewed docs harness: `a566100da92a87a7fa61d5d742a745f5964d4dbf`
- Execution class: offline/static
- Proposed state: `partial`

## Result

The committed validator returned `PASS-candidate` for the INDEX-selected static
packet at `PROOFS/1cc8f4e3d617ef6f173283ef83d7b739a4995734/R-OBS-2/cael-dgx/`.
It observed one trace id, 46 spans, one root, zero orphan spans, and all required
continuation lineage names.

This is a static-contract pass only. Elliott's deployed runtime is
`f01e2fbf09130103592c948ef7eef6b39a1e5a88`, not the candidate, so no fresh
candidate trace was fired. The row remains `partial` for the candidate behavior
claim. No deploy or restart was attempted.

## Receipts

| Receipt | Result |
|---|---|
| `trace-tree-artifacts` | PASS: trace-tree, span-tree, and span-count source artifacts parsed |
| `continuation-lineage` | PASS: delegate dispatch, harness/run, tool execution, queue fanout, and queue drain present |
| Fresh candidate trace | Missing: blocked by exact-runtime identity gate |

The issue's direct command first stopped during k6 initialization because its
manifest path resolved with a duplicated `tools/k6-proofs` prefix. No iteration
or product invocation occurred. The documented direct-scenario fallback ran with
the scenario-relative `manifests/r-obs-2.json` path and produced the attached
summary.

Both-forms mandate: not applicable. Token-surface provenance: not applicable;
this row invokes no continuation token or tool. Tempo and gateway journal
receipts are intentionally absent because this execution was offline/static.

**No secrets:** these artifacts contain no tokens, prompt bodies, user content,
nonces, raw gateway payloads, actual session keys, or private filesystem paths.
