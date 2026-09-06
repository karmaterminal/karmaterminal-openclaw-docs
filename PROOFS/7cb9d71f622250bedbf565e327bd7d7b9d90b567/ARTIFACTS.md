# Artifacts

The historical baseline artifacts are preserved from the reviewed
`5035aac3a96df18f0a5d5a5c3e91a516a32daf32` corpus. They retain their original
identity and do not claim exact-target execution.

New exact-target evidence is represented by eight public corpus
`PUBLIC-REVIEW.json` receipts and their cited public review receipts. Synthetic
proof identifiers and acquisition-path references disclosed by those cited
reviews are public provenance. Credentials, provider tokens, prompts or other
private content, and raw acquisition bytes are not published.

The five newest corpus receipts use deterministic SHA-256 fingerprints for
compact joins over task, flow, session, run, traceparent, and span identities;
the fingerprints do not claim every source identifier is secret. Tempo
retrieval was unavailable; retained exact W3C identities provide the reviewed
trace binding.
