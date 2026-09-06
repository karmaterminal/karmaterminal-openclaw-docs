# Method

The reviewed 38-row `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
ledger is the status baseline. Product ancestry from that SHA to
`7cb9d71f622250bedbf565e327bd7d7b9d90b567` is verified.

Only three MISSING rows consume the sealed canary evidence. Their sole authority
is the independent manual review linked by each public receipt. The rejected
producer-v6 automatic authority path is excluded. Every unchanged state is
checked by row-name comparison against the baseline manifest.

Public receipts expose only SHA-256 digests and 16-hex SHA-256 identity
fingerprints. Raw evidence, prompts, credentials, session keys, and runtime
identifiers remain private.
