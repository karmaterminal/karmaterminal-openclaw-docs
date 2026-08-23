# PR 121204 exact-source proof corpus

- Accepted feature source: `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9`
- Execution composite: `6e6da7bba079b0fc50d134b96657cda683985837`
- Seat: Rune
- Capture date: 2026-08-23

The source SHA identifies the behavior and this corpus. Rune executed the
already-installed composite; this corpus does not claim that Rune ran the source
SHA.

| Row | Composite result | Exact-source verdict |
| --- | --- | --- |
| Stale direct-open ambient vs fresh mention | Pass | **Pass** |
| Corrupt pending vs fresh addressed event | Pass | **Pass** |
| Watchdog bounded recovery without completed-row replay | Pass | **Non-isolating** |

Rows 1 and 2 exercise the real Discord durable-ingress monitor over isolated
SQLite state. The fresh row is adopted and completed while the blocking row is
terminally failed with the expected reason. Row 3 proves the composite behavior,
but not the accepted source behavior: bounded watchdog retry entered the
composite through upstream commit `ee79b0a49ae4b0ecd30f9e483c70c0f49f20232c`
(OpenClaw #127090), already present in the composite base.

No gateway restart, deployment, presentation-branch movement, live database
write, or live Discord fire occurred. Downstream agent execution was not
exercised; the proof ends at durable ingress adoption and settlement.

See [METHOD.md](METHOD.md), [RESOLVED-SHA.md](RESOLVED-SHA.md),
[NON-INTERFERENCE-MAP.md](NON-INTERFERENCE-MAP.md), and
[manifest.json](manifest.json).
