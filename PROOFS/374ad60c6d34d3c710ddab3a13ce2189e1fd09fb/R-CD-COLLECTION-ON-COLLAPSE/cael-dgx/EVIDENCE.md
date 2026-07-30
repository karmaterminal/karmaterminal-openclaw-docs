# R-CD-COLLECTION-ON-COLLAPSE static validator evidence

- Candidate label: `374ad60c6d34d3c710ddab3a13ce2189e1fd09fb`
- Frozen docs harness: `a566100da92a87a7fa61d5d742a745f5964d4dbf`
- Committed proof index: `4c235d8c1997e8964160117f8d6bf650ad1e8203`
- Static evidence source: `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
- Execution seat: `cael-dgx`
- Execution class: offline, read-only static validator
- k6 version: `v2.0.0`
- Generated: `2026-07-30T10:31:31.726Z`

## Verdict

The committed validator returned **PASS-candidate** with zero proof failures. The proposed Project 86 row state remains **partial** because this result validates the committed reference packet; it is not fresh behavioral execution against the candidate runtime.

## Receipts

| Required receipt | Result |
|---|---|
| `collection-collapse-artifacts` | PASS: evidence, evaluation, flow/task rows, root receipt, journal, and Tempo summary parsed from the committed static evidence source. |
| `root-collection-after-intermediate-finalized` | PASS: every validator predicate was true, including B-finalized-before-C, the C sentinel, durable rows, root collection, evaluation, and trace presence. |

The row is read-only, so the both-forms mandate and token-surface provenance are not applicable. No gateway call, continuation invocation, session mutation, deploy, or restart occurred.

## Limits

The static validator proves only that the frozen committed packet satisfies the row contract. It does not establish fresh candidate behavior or isolated runtime causality. Canonical fold remains review-required.

## Public-safety statement

No secrets are present. These artifacts contain no tokens, session keys, prompt bodies, nonces, raw gateway payloads, user content, or private filesystem paths.
