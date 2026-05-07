# Swim 43 — v5.5 FULL continuation swim — SCOREBOARD

SUT: 🩸 Cael / `agent:main:discord:channel:1466192485440164011`
Ref: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
Tag basis: `v2026.5.5`
Canonical branch: `frond/v2026.5.5/canonical`
Registry version: `v1`
Status: OPEN

Summary: 4 PASS / 0 FAIL / 0 FINDING / 0 DEFERRED / 0 BLOCKED / 1 INVALIDATED

Families:
- Turns: PARTIAL (row-02 PASS; row-03 first fire INVALIDATED and needs rerun)
- Delegates: PASS (row-04 immediate normal `continue_delegate()` visible return proven)
- Guards: OPEN
- Routes: OPEN
- Recovery: OPEN
- Rollout: PASS (fleet deployed on exact candidate)
- Observability: PASS (row-05 witness hierarchy proven: version/build-info authoritative, systemd Description decorative)
- Contamination / interpretation truth: OPEN

Human answer:
Swim 43 is honestly declared against one named SUT, one tag, one canonical branch, with the fleet actually deployed on the claimed bytes. Row-02 proved immediate `continue_work()` self-election, row-04 proved immediate normal `continue_delegate()` visible return, and row-05 proved the version witness hierarchy on deployed v5.5 (`openclaw --version` + `build-info` authoritative; systemd Description decorative). The remaining open pressure in the current slice is row-03: delayed `continue_work()` still needs a better harness because the chat-shaped timing procedure keeps invalidating it.

## Closed rows

| Row | Title | Verdict | Receipt |
|---|---|---|---|
| row-01 | pre-swim gate / substrate declaration | PASS | `rows/row-01-pre-swim-gate.md` |
| row-02 | Family A / Turns — immediate `continue_work()` fire | PASS | `rows/row-02-turns-continue-work-immediate.md` |
| row-03 | Family A / Turns — delayed `continue_work()` honored | INVALIDATED | `rows/row-03-turns-delayed-continue-work.md` |
| row-04 | Family B / Delegates — immediate normal `continue_delegate()` visible return | PASS | `rows/row-04-delegates-normal-continue-delegate.md` |
| row-05 | Family G / Observability — version witness hierarchy on deployed v5.5 | PASS | `rows/row-05-observability-version-witness-hierarchy.md` |
