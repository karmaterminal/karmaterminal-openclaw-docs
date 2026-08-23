# Exact Gate 2.7 reconciliation

- Candidate: `372ce0f8e33b42d0377a64806f8013208af54fcf`
- Frozen upstream: `8578b8f55cf77ddb161891b662a02f8c8c2a80ba`
- PR creation: `7b0d8726cb81775cc63b5e5dc394acc989a455eb`
- Current canonical gate tool source:
  `karmaterminal/openclaw-bootstrap@6dd6c3a7712c8ae02937a29054525b2ddacb89c1`
- Files examined: 930
- `GENUINE`: 296
- `SAFE-NEW`: 288
- `MIXED-CLOBBER`: 346
- `FROZEN-STALE`: 0
- Tool exit: 0

The zero exit means the high-confidence `FROZEN-STALE` class is empty. The
required `MIXED-CLOBBER` reconciliation is now complete:

- current paths: 346;
- prior disposition paths: 317;
- shared: 310;
- current-only: 36;
- prior-only: 7, recorded as superseded/not-current;
- current dispositions: 346 unique, 345 `KEEP` and one `RESTORE`;
- duplicates, missing paths, and extra paths: zero.

All set operations used `LC_ALL=C sort -u` and `LC_ALL=C comm`. The 287 shared
exact-overlay rows match their prior source, frozen, and candidate blobs. The
remaining 23 shared rows retain their prior reviewed semantic dispositions.
Every current-only row was reviewed against the exact four identities,
provenance, callers, and adjacent tests.

The sole `RESTORE` is
`extensions/telegram/src/bot-message-dispatch.context-recovery.test.ts`. The
candidate retains accepted canonical `Body`, `BodyForAgent`, `CommandBody`, and
`RawBody` fixture fields but omits frozen upstream's compatible assertion that
a spoofed current-message marker does not enter `ChannelStructuredContext`.
Because the presentation is immutable and this docs lane cannot patch
OpenClaw, acceptance remains fail-closed.

The complete machine-readable result is
[`gate-2.7-classification.tsv`](gate-2.7-classification.tsv).
The disposition authority is
[`gate-2.7-dispositions.tsv`](gate-2.7-dispositions.tsv), with set members and
hashes recorded beside it.
