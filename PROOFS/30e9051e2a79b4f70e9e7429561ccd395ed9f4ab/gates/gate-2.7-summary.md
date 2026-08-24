# Exact Gate 2.7 reconciliation

- Candidate: `30e9051e2a79b4f70e9e7429561ccd395ed9f4ab`
- Frozen upstream: `6669872a95f87b9a79ebebbaac5718cd877f86bd`
- PR creation: `7b0d8726cb81775cc63b5e5dc394acc989a455eb`
- Current canonical gate tool source:
  `karmaterminal/openclaw-bootstrap@6dd6c3a7712c8ae02937a29054525b2ddacb89c1`
- Files examined: 931
- `GENUINE`: 297
- `SAFE-NEW`: 289
- `MIXED-CLOBBER`: 345
- `FROZEN-STALE`: 0
- Tool exit: 0

The zero exit means the high-confidence `FROZEN-STALE` class is empty. The
required `MIXED-CLOBBER` reconciliation is now complete:

- current paths: 345;
- prior disposition paths: 346;
- shared: 345;
- current-only: 0;
- prior-only: 1, the now-applied Telegram restore;
- current dispositions: 345 unique, all `KEEP`;
- duplicates, missing paths, and extra paths: zero.

All set operations used `LC_ALL=C sort -u` and `LC_ALL=C comm`. Feature-delta
patch IDs are identical for 341 rows. The four changed rows are the reviewed
back-merge resolutions in block-reply lifecycle/delivery, tool completion, and
diagnostic tests; focused owner suites, type checks, static checks, build,
autoreview, and GitNexus are clean.

The prior `RESTORE`,
`extensions/telegram/src/bot-message-dispatch.context-recovery.test.ts`, is now
applied byte-identically. The candidate retains canonical `Body`,
`BodyForAgent`, `CommandBody`, and `RawBody` fixture fields and asserts that a
spoofed current-message marker cannot enter `ChannelStructuredContext`. The
owning Telegram shard passes 11/11.

The complete machine-readable result is
[`gate-2.7-classification.tsv`](gate-2.7-classification.tsv).
The disposition authority is
[`gate-2.7-dispositions.tsv`](gate-2.7-dispositions.tsv), with set members and
hashes recorded beside it.
