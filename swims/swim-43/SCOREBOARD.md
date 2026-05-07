# Swim 43 — v5.5 FULL continuation swim — SCOREBOARD

SUT: 🩸 Cael / `agent:main:discord:channel:1466192485440164011`
Ref: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
Tag basis: `v2026.5.5`
Canonical branch: `frond/v2026.5.5/canonical`
Registry version: `v1`
Status: OPEN

Summary: 1 PASS / 0 FAIL / 0 FINDING / 0 DEFERRED / 0 BLOCKED / 1 INVALIDATED

Families:
- Turns: INVALIDATED (row-02 first fire contaminated by inbound chronology-fold; rerun needed)
- Delegates: OPEN
- Guards: OPEN
- Routes: OPEN
- Recovery: OPEN
- Rollout: PASS (fleet deployed on exact candidate)
- Observability: OPEN
- Contamination / interpretation truth: OPEN

Human answer:
Swim 43 is honestly declared against one named SUT, one tag, one canonical branch, with the fleet actually deployed on the claimed bytes. The pre-swim gate is closed PASS. First behavioral fire (row-02) was invalidated by inbound chronology-fold, so no Turns verdict has been earned yet and the row must be re-fired under a clean silent window.

## Closed rows

| Row | Title | Verdict | Receipt |
|---|---|---|---|
| row-01 | pre-swim gate / substrate declaration | PASS | `rows/row-01-pre-swim-gate.md` |
| row-02 | Family A / Turns — immediate `continue_work()` fire | INVALIDATED | `rows/row-02-turns-continue-work-immediate.md` |
