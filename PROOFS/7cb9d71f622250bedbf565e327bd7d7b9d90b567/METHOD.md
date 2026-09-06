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

Synthetic proof identifiers and acquisition-path references disclosed in the
cited public review receipts are public provenance. Credentials, provider
tokens, prompts or other private content, and raw acquisition bytes are not
published. Public corpus receipts use deterministic 16-hex SHA-256
fingerprints for compact joins, not to claim that every source identifier is
secret.
