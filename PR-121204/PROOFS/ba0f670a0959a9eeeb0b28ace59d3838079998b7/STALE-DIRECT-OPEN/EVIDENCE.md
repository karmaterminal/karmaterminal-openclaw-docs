# Stale direct-open ambient vs fresh mention

**Verdict: PASS — exact-source isolating.**

Nonce `RUNE-PR121204-R1-20260823T155150Z-993991` ran from
`2026-08-23T15:51:50Z` through `2026-08-23T15:52:09Z`.

Before processing, the isolated SQLite queue contained two pending same-lane
rows. After processing:

- the stale ambient row was `failed` with
  `stale-ambient-backlog`;
- the fresh mention row was `completed`;
- only the fresh row entered the downstream adoption callback.

The source and composite share the selected regression assertion byte-for-byte.
No downstream agent turn ran. The row-1 test passed; a post-pass GitHub summary
reporter warning recorded a missing runner summary path but did not alter the
runner's zero exit status or the durable receipt.

Receipts: [gate.json](gate.json), [receipt.json](receipt.json), and
[test-result.json](test-result.json).
