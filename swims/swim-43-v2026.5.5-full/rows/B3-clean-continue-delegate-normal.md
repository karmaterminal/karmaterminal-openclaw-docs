# swim-43/B3 — F3 clean continue_delegate(default/normal) byte-decidable on cael-host

**Swim:** swim-43-v2026.5.5-full
**Block:** B — Family Delegates
**Row ID:** B3
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/B3.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011` (cael-seat)
**Test file candidates:** N/A (substrate-walk row, evidence class live-row)
**Timing window:** integration
**Evidence class:** live-row
**Gather:** SUT-side three-source check + journal cross-source

## Surface under test

Per `SWIM/cases/B3.md`: `continue_delegate()` with default mode spawns subagent, runs, and returns to caller under quiet-channel conditions.

This row's specific test: immediate `continue_delegate(mode: "normal")` on deployed v5.5 substrate, fired from cael-seat to cael-host. Three-source check per SWIM-METHODOLOGY.md lines 46-48.

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (this row, fired from cael-seat to cael-host)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** SUT-side tool-return + agent-context delegate-completion + cross-source journal-walk for `Consuming N tool delegate(s)` + `delegate-spawned hop=N/MAX mode=normal` literals

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Three sources per SWIM-METHODOLOGY.md three-source rule:

**Source (a) tool-return** (continue_delegate invocation result):
```
continue_delegate(mode: "normal", task: "...") → {status: "scheduled", mode: "normal", delaySeconds: 0}
```

**Source (a) agent-context delegate-completion** (system-message in next agent turn):
```
ROW-04-OK — delegate completion for SWIM 43 row-04 (Family B / Delegates / immediate normal continue_delegate visible return), fired from cael-seat live v5.5 SUT
```
(or equivalent task-acknowledgment token from the delegate's task-body completion)

**Source (b) journal cross-source** — TWO literals expected for normal mode:
```
[continue_delegate] Consuming N tool delegate(s) for session <session-id>
[continuation:delegate-spawned] hop=N/MAX mode=normal session=<session-id> task=...
```
Per `SWIM/lessons/L-v5.5-journal-vocabulary.md` Case 2: normal-mode `continue_delegate` emits BOTH literals to journal (in contrast to silent-mode which emits only `Consuming` per L-v5.5-journal-vocabulary lesson + cael's swim-44/row-01).

### How to gather what we expect

SUT-side: `continue_delegate(mode: "normal")` tool-return + next-turn agent-context for delegate-completion task-acknowledgment.

Cross-source journal-walk:
```bash
ssh cael "journalctl --user -u openclaw-gateway --since '<T0>' --until '<T0+60s>' --no-pager | grep -E 'Consuming.*tool delegate|delegate-spawned hop=.*mode=normal'"
```

### What FAIL looks like

```
FAIL = source (a) tool-return = scheduled but agent-context delegate-completion absent within reasonable timeout (delegate didn't run OR didn't return), OR source (b) journal absent both literals.

INCONCLUSIVE = gateway restart during window — re-run on stable conditions.

METHOD-BROKEN = grep pattern wrong / log-scope wrong / session-key mismatch.
```

### Result — actual output, byte-pinned

#### Fire 1 — cael-seat to cael-host, T0 = 2026-05-06 23:31:35 PDT, mode = normal

(Evidence credit: cael's swim-43-morning row-04 fire — L-v5.5-journal-vocabulary lesson Case 2 first half + my msg `1501938008...` byte-walk + cael's msg `1501936468...` ROW-04-CTRL-OK delegate completion announcement.)

**Source (a) tool-return** (cael-seat continue_delegate invocation):
```
continue_delegate(task: "...", mode: "normal") → {status: "scheduled", mode: "normal"}
```

**Source (a) agent-context delegate-completion** (system-message next agent turn at cael-seat):
```
ROW-04-OK — delegate completion for SWIM 43 row-04 (Family B / Delegates / immediate normal continue_delegate visible return), fired from cael-seat live v5.5 SUT per 🌊 driver-call msg 1501833554936598638.
```
Returned visibly to parent session/channel within reasonable window.

**Source (b) journal cross-source** (cael-host):
```
$ journalctl --user -u openclaw-gateway --since '2026-05-06 23:31:00' --until '2026-05-06 23:32:00' --no-pager | grep -E 'Consuming|delegate-spawned'
May 06 23:31:35 cael node[3731004]: [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
May 06 23:31:36 cael node[3731004]: [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=6/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=SWIM 43 row-04 delegate fire — Family B / Delegates / immediate normal continue_delegate
May 06 23:31:45 cael node[4011725]: ROW-04-OK — delegate completion for SWIM 43 row-04 ...
```
Both expected literals present in normal-mode delegate journal output (in contrast to silent-mode which surfaces only `Consuming` per L-v5.5-journal-vocabulary lesson + cael's swim-44/row-01).

### Verdict

**PASS** on three-source check:
- Source (a) tool-return: `{status: "scheduled", mode: "normal"}` ✓
- Source (a) agent-context delegate-completion: `ROW-04-OK` task-acknowledgment ✓
- Source (b) journal: BOTH `Consuming 1 tool delegate(s)` + `delegate-spawned hop=6/200 mode=normal` literals present ✓

### Truth-floor reach

Source (b) journal showed BOTH expected literals for normal-mode (in contrast to silent-mode's single literal). This is the byte-true substrate behavior on deployed v5.5 — `delegate-spawned hop=` literal is normal-mode-specific in journal emission per L-v5.5-journal-vocabulary lesson Case 2. Mode discriminates which delegate-side log surfaces to journal.

## Status ladder

- [x] **Triaged** — required per B3 case file (live-row evidence class)
- [x] **Authored** — script + row file committed
- [x] **PASS-candidate** — fire 1 produced PASS evidence on three-source check
- [x] **Comprehension-gated** — driver code-read of agent-runner.ts:2530-2580 + delegate-dispatch.ts signed off via L-v5.5-journal-vocabulary lesson
- [x] **Verified** — Verdict landed on byte-pinned Result block; three-source evidence preserved
- [ ] **Evidence-cleansed** — N/A unless contributing to frozen-branch evidence appendix per Charter Rule 8

## References

- **Case file**: `SWIM/cases/B3.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md` lines 9-19 + 46-48
- **Substrate-knowledge lesson**: `SWIM/lessons/L-v5.5-journal-vocabulary.md` (Case 2 normal-mode delegate)
- **Cross-mode comparison**: cael's swim-44/row-01 (silent-mode delegate, single-literal substrate-finding)
- **Worked example**: `SWIM/templates/worked-examples/continuation-delayed-self-election/`

## Notes

This row demonstrates normal-mode delegate dispatch with the FULL two-literal journal evidence. Compare to silent-mode where only `Consuming` literal surfaces (cael's swim-44/row-01). The mode-specific log-routing distinction is a real substrate property documented in L-v5.5-journal-vocabulary lesson Case 2.

Evidence-credit attributed: cael's swim-43-morning row-04 fire was the original source for this row's PASS evidence pack, captured in cohort byte-walks at msg `1501938008...` (mine) + msg `1501936468...` (cael's announcement). Re-presented here under canonical row-template + three-source evidence rule shape.
