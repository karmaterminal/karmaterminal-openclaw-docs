# Method

The reviewed 38-row `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
ledger is the status baseline. Product ancestry from that SHA to
`7cb9d71f622250bedbf565e327bd7d7b9d90b567` is verified.

The current-main baseline is
`08f8731490ce93879dabc973e7563c7ae0a65683`. Exactly five PARTIAL rows consume
the sealed canary evidence. Their sole authority is the independent manual
review linked by each public receipt; rejected automatic producer authority is
excluded. Every other state is checked by row-name comparison against current
main.

Public receipts expose only SHA-256 digests and 16-hex SHA-256 identity
fingerprints, including traceparent and span fingerprints. Raw evidence,
prompts, credentials, session keys, and runtime identifiers remain private.
