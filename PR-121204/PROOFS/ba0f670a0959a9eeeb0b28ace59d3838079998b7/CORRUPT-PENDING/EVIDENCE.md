# Corrupt pending vs fresh addressed event

**Verdict: PASS — exact-source isolating for the selected null-payload case.**

Nonce `RUNE-PR121204-R2-20260823T155221Z-994186` ran from
`2026-08-23T15:52:21Z` through `2026-08-23T15:52:29Z`.

Before processing, the isolated SQLite queue contained a stale null-payload row
and a fresh addressed row on the same lane. After processing:

- the corrupt row was `failed` with `invalid-event`;
- the fresh addressed row was `completed`;
- only the fresh row entered the downstream adoption callback.

The selected null-payload assertion exists at the accepted source. The later
policy-containment commit adds other corrupt shapes but is not needed for this
case. No downstream agent turn ran.

Receipts: [gate.json](gate.json), [receipt.json](receipt.json), and
[test-result.json](test-result.json).
