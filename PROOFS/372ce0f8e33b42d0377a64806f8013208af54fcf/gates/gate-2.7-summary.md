# Exact Gate 2.7 receipt

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

The zero exit means the high-confidence `FROZEN-STALE` class is empty. It does
not close Gate 2.7: current authority requires every `MIXED-CLOBBER` row to
have a recorded keep/restore disposition. No such 346-row disposition ledger
belongs to this exact final presentation SHA, so this gate remains unresolved.

The complete machine-readable result is
[`gate-2.7-classification.tsv`](gate-2.7-classification.tsv).
