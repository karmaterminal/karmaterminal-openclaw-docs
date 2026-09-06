# R-CD-COLLECTION-ON-COLLAPSE — exact-product partial attempt

- product/runtime: `7cb9d71f622250bedbf565e327bd7d7b9d90b567`
- canary readiness docs: `08f8731490ce93879dabc973e7563c7ae0a65683`
- canonical state: `partial`
- authority: independent manual review
- public receipt: [`PUBLIC-REVIEW.json`](PUBLIC-REVIEW.json)

A reached B, but B supplied `recipientContext` while artifact returns were
forbidden. Exact product correctly rejected that malformed call before
scheduling C. B terminated and delivered; no C task, flow, session, run,
trace, or sentinel existed, and no orphan remained. This attempt is not a
product behavior failure and does not prove PASS.
