# R-CD-TOKEN — explicit-owner replacement-attempt evidence

- canonical pure SHA: `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
- ancillary runtime: `dbf5795bd5dd406f586575d883a7878288e591ad`
- approved explicit-owner harness:
  `52c0b46f86f2f98a6ff7f17b7a5f380609903484`
- consumed semantic attempt, preserved unchanged:
  `20260903T060815Z-r-cd-token-0fd4f089`
- authorized replacement attempt:
  `20260903T073850Z-r-cd-token-248195ae`
- canonical state: `partial`
- candidate verdict: `PARTIAL-candidate`

The replacement attempt stopped at the pre-dispatch build-identity gate.
Seat readiness passed on the exact deployed `dbf5795...` runtime, but the
approved command's repository-relative ancillary contract path was resolved
from the immutable snapshot's `tools/k6-proofs` working directory. The
validator therefore received the nonexistent doubled path
`tools/k6-proofs/tools/k6-proofs/contracts/...` and emitted:

```text
ancillary runtime provenance failed: ENOENT: no such file or directory, open 'tools/k6-proofs/contracts/ancillary-runtime/129388-pure5035-dbf5795.json'
```

No attempt state, session, nonce, prompt, token, TaskFlow, child, return, trace,
or signed row receipt was created. This is an infrastructure-before-consumption
failure. Per the one-attempt authorization, it was preserved and not retried.
The prior semantic PARTIAL remains canonical and unchanged.

All earlier attempts remain under the row directory or prior checkpoint history.
