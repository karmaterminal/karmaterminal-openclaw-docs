# Continuation proof corpus — `7cb9d71f622250bedbf565e327bd7d7b9d90b567`

Status: **BLOCKED** on the remaining non-PASS rows.

- exact product/runtime: `7cb9d71f622250bedbf565e327bd7d7b9d90b567`
- exact product tree: `85821bfd8f4676cfac8be658122910a7eb862f55`
- canary readiness docs: `08f8731490ce93879dabc973e7563c7ae0a65683`
- current-main promotion base: `8f1163d757342c3ac36b8e446222b0446159211b`
- baseline corpus: `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
- before: 29 PASS / 2 PARTIAL / 1 FAIL / 6 MISSING
- after: 31 PASS / 3 PARTIAL / 1 FAIL / 3 MISSING

Exactly two rows moved from MISSING to PASS: `R-CW-DELEGATE-TOKEN` and
`R-CW-MULTI`. `R-CD-COLLECTION-ON-COLLAPSE` moved from MISSING to PARTIAL.

Each promoted row contains a schema-validated `PUBLIC-REVIEW.json` that binds
the exact product, runtime, docs readiness, sealed private manifest digest,
row-specific private artifact digest, public-safe identity fingerprints,
observed predicates, limitations, and the independent manual review.
Rejected automatic producer authority was not consumed.

`R-CD-TOKEN`, `R-RC-2`, and `R-CD-COLLECTION-ON-COLLAPSE` are PARTIAL.
`R-CD-RETURN-COVENANT-AUTHORITY`, `R-CD-RETURN-OVERLAP`, and `R-OBS-2` remain
MISSING. `R-CD-2` remains FAIL, and the other 35 row states are unchanged.
