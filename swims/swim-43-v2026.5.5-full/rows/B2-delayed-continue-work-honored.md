# swim-43/B2 — F2 delayed continue_work() byte-decidable on urudyne

**Swim:** swim-43-v2026.5.5-full
**Block:** B — Family Turns
**Row ID:** B2
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/B2.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** silas-host (urudyne) — alternate canonical SUT per cohort cross-host coverage
**SUT seat:** `agent:main:discord:channel:1466192485440164011` (silas-seat in #sprites-of-thornfield)
**Test file candidates:** N/A (substrate-walk row, evidence class live-row)
**Timing window:** integration
**Evidence class:** live-row
**Gather:** SUT-side three-source check + cross-source journal-walk

## Surface under test

Per `SWIM/cases/B2.md`: self-elected `continue_work()` handles inbound message arriving during the reservation window correctly: either fold-into-current-turn or honor reservation, but never both.

This row's specific test: delayed `continue_work(delaySeconds=120)` on deployed v5.5 substrate, fired from silas-seat to silas-host (urudyne). Three-source PASS check per SWIM-METHODOLOGY.md lines 46-48 (SUT self-report tool-return + system-message + journal cross-source).

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (this row, fired from silas-seat to urudyne)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** SUT-side tool-return + wake-injection system-message + cross-source journal-walk for `WORK timer fired` literal

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Three sources per SWIM-METHODOLOGY.md three-source rule:

**Source (a) tool-return** (continue_work invocation result):
```
continue_work(delaySeconds=120) → {status: "scheduled", delaySeconds: 120}
```
Canonical evidence the call reached the scheduler. Disambiguator for "did tool-call reach scheduler" question that journal-walk alone cannot answer.

**Source (a) wake-injection** (system-message landing in next agent turn):
```
[continuation:wake] Turn N/MAX. Chain started at <iso-ts>.
```
Arrives at T+delaySeconds ± scheduler tolerance. Canonical evidence the timer fired AND the wake was delivered to the agent.

**Source (b) journal cross-source**:
```
WORK timer fired for session <session-id>
```
Single unprefixed line at T+delaySeconds ± scheduler tolerance, from `agent-runner.ts:2561` `defaultRuntime.log` emission. Per `SWIM/lessons/L-v5.5-journal-vocabulary.md`: scheduler.ts:108 + scheduler.ts:114 emissions do NOT reach user-systemd journal in deployed v5.5; only the agent-runner.ts:2561 unprefixed line does.

### How to gather what we expect

SUT-side: `continue_work` tool-return + next-turn agent-context for wake-injection literal.

Cross-source journal-walk (Monitor or Driver from non-SUT seat):
```bash
ssh silas "journalctl --user -u openclaw-gateway --since '<T0>' --until '<T0+delaySeconds+30s>' --no-pager | grep -E 'WORK timer fired'"
```

### What FAIL looks like

```
FAIL = source (a) tool-return = scheduled but source (a) wake-injection absent at T+delaySeconds (timer didn't fire OR wake not delivered to agent), OR source (b) journal absent (substrate didn't fire even though tool-return claimed scheduled).

INCONCLUSIVE = inbound message during reservation window OR gateway restart during window — re-run on stable conditions.

METHOD-BROKEN = grep pattern wrong / log-scope wrong / session-key mismatch. Per L-v5.5-journal-vocabulary lesson: do NOT search for `[continuation] WORK timer set` or `[continuation] WORK timer fired` (those are scheduler.ts log.info emissions that don't reach journal). Search only for unprefixed `WORK timer fired for session ...`.
```

### Result — actual output, byte-pinned

#### Fire 1 — silas-seat to urudyne, T0 = 2026-05-07 06:11:16 PDT, delay = 120s

**Source (a) tool-return** (silas-seat continue_work invocation):
```
continue_work(delaySeconds=120) → {status: "scheduled", delaySeconds: 120}
```

**Source (a) wake-injection** (system-message in next agent turn at silas-seat):
```
[continuation:wake] Turn 1/200. Chain started at 2026-05-07T13:11:16.866Z
```
Arrived 06:13:16 PDT — **T+120s exact** from arm at 06:11:16 PDT.

**Source (b) journal cross-source** (urudyne):
```
$ journalctl --user -u openclaw-gateway --since '06:11:00' --until '06:14:00' --no-pager | grep 'WORK timer'
May 07 06:13:16 urudyne node[69091]: WORK timer fired for session agent:main:discord:channel:1466192485440164011
```
Single unprefixed line at 06:13:16 PDT. Zero `[continuation] WORK timer set` / `[continuation] WORK timer fired` matches (per L-v5.5-journal-vocabulary lesson scheduler.ts emissions do not reach journal).

#### Fire 2 — silas-seat to urudyne, arm at 06:19:38 PDT, delay = 175s

**Source (a) tool-return**
```
continue_work(delaySeconds=175) → {status: "scheduled", delaySeconds: 175}
```
Tool-return surfaced at Discord msg `1501936512650973357` (06:19:05 PDT); arm took effect at 06:19:38 PDT per journal.

**Source (b) journal cross-source**
```
06:19:38 [continuation/signal] effective-signal: origin=tool-call kind=work
06:22:33 WORK timer fired for session agent:main:discord:channel:1466192485440164011
```
Arm-to-fire delta is ~175s exact.

**Source (a) wake-injection**
Not byte-walked for this second fire. This re-run is therefore a **two-source PASS corroboration**, not a replacement for Fire 1's full three-source proof.

This second fire matters because Silas later corrected his earlier stale read (`msg 1501938420...`) that the wake had not fired. Against the substrate, the timer did fire exactly on schedule.

### Verdict

**PASS** on the row claim.

Fire 1 closed the row on a full three-source check:
- Source (a) tool-return: `{status: "scheduled"}` ✓
- Source (a) wake-injection: T+120s exact ✓
- Source (b) journal: `WORK timer fired` literal present ✓

Fire 2 adds a second urudyne corroboration on a different delay:
- Source (a) tool-return: `{status: "scheduled", delaySeconds: 175}` ✓
- Source (b) journal: arm at 06:19:38 PDT, `WORK timer fired` at 06:22:33 PDT (T+175s exact) ✓

Substrate-evidence credit: silas SUT-self-report at msg `1501987040...` (first-fire three-source PASS) plus later self-correction / second-fire byte-pin confirming the earlier wake-did-not-fire claim was stale against the substrate.

### Truth-floor reach

Source (b) journal showed only ONE `WORK timer fired` line, no `[continuation]` prefixed emissions. Per L-v5.5-journal-vocabulary lesson Case 1: this is byte-true substrate behavior on deployed v5.5, NOT a missing-emission-FAIL. Source (a) tool-return + wake-injection both confirm fire-cycle completed correctly.

## Status ladder

- [x] **Triaged** — required per B2 case file (live-row evidence class)
- [x] **Authored** — script + row file committed
- [x] **PASS-candidate** — fire 1 produced PASS evidence on three-source check
- [x] **Comprehension-gated** — driver code-read of scheduler.ts + agent-runner.ts signed off via L-v5.5-journal-vocabulary lesson
- [x] **Verified** — Verdict landed on byte-pinned Result block; cross-source corroboration via silas SUT-self-report + journal cross-walk
- [ ] **Evidence-cleansed** — N/A unless contributing to frozen-branch evidence appendix per Charter Rule 8

## References

- **Case file**: `SWIM/cases/B2.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md` lines 9-19 (fixed roles), lines 46-48 (three-source evidence rule)
- **Substrate-knowledge lesson**: `SWIM/lessons/L-v5.5-journal-vocabulary.md` (Case 1 delayed continue_work)
- **Worked example**: `SWIM/templates/worked-examples/continuation-delayed-self-election/`
- **Cross-host corroboration**: cael-host fire 06:14:46 → 06:16:46 (per L-v5.5-journal-vocabulary lesson Case 1) + elliott-host fire 06:08:35 → 06:10:36

## Notes

This row demonstrates the canonical three-source evidence rule in practice. Source (a) tool-return + wake-injection are SUT-side; source (b) journal is cross-source. All three converge on PASS for v5.5 delayed `continue_work(120s)` substrate.

The morning's swim-43-disposition discussion never assembled this three-source PASS shape because journal-walk alone (the cohort grep-pattern) missed `WORK timer fired` literal AND because cohort never reached for source (a) tool-return as the disambiguator for "did the tool-call reach the scheduler." silas's three-source check at msg `1501987040...` (and earlier urudyne byte-pin at msg `1501986562...`) demonstrates the canonical evidence-rule applied correctly.

Multi-host PASS-pattern: same byte-shape on cael-host (06:14:46 → 06:16:46) + elliott-host (06:08:35 → 06:10:36) + urudyne first fire (06:11:16 → 06:13:16) + urudyne second fire (06:19:38 → 06:22:33 with `delaySeconds=175`). Cross-host and repeat-fire corroboration that v5.5 delayed continue_work substrate works correctly.
