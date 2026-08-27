# Watchdog bounded recovery without completed-row replay

**Verdict: PASS in composite context; NON-ISOLATING for exact source.**

Nonce `RUNE-PR121204-R3-20260823T155236Z-994306` ran from
`2026-08-23T15:52:36Z` through `2026-08-23T15:52:44Z`.

The isolated SQLite snapshots show:

1. two pending same-lane rows before dispatch;
2. after five seconds, the stalled head returned to `pending` with exactly one
   attempt and a `handler-timeout` error;
3. after one-second retry eligibility, both rows became `completed`;
4. re-enqueueing the completed ID returned the durable completed disposition,
   a further drain started zero work, and the durable rows did not change.

Dispatch order was stalled head, recovered stalled head, follower. This proves
bounded composite recovery and no durable re-adoption of the completed row.

It is not exact-source proof. Accepted source expects the watchdog to fail the
stalled row immediately. Bounded watchdog retry entered the composite through
upstream OpenClaw #127090 before the #121204 replay.

Receipts: [gate.json](gate.json), [receipt.json](receipt.json), and
[test-result.json](test-result.json).
