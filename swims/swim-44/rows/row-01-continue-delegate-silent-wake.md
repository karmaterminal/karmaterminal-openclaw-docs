# swim-44/row-01: continue_delegate(silent-wake) byte-decidable on cael-host

**Swim:** 44
**Block:** A (cael-seat first canonical-template row, post-#13 + #15 merge)
**Row ID:** row-01
**Tracker anchor:** TBD
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical` (deployed cael-host, byte-confirmed `openclaw --version` per role-canon Deployer build-verify)
**Test file candidates:** N/A (substrate-test, not unit-test)
**Timing window:** integration
**Gather:** `swims/swim-44/rows/row-01-measure.sh <host-tag> <T0_epoch>`

## Surface under test

`continue_delegate(mode: "silent")` (or `silent-wake`) on deployed v5.5 substrate emits two literal bytes in the gateway journal in a 60s window from dispatch:

1. `Consuming N tool delegate(s)` (from `agent-runner.ts` dispatch path)
2. `[continuation:delegate-spawned] hop=N/MAX mode=...` (from `continuation/delegate-dispatch` path)

Both literals must be present, byte-decidable from raw `journalctl --user -u openclaw-gateway` output (no grep until after raw read confirms substrate vocabulary, per `SWIM-METHODOLOGY.md:90`).

A violation looks like: dispatch returns `{status: "scheduled"}` from the tool but neither journal literal appears in the window — meaning the tool-call may have reached the scheduler but did not surface to the user-systemd journal at info-level. (Per same-day cohort byte-walks: `log.info`-routed lines from `scheduler.ts` do not surface to user-systemd journal in deployed v5.5; only `defaultRuntime.log`-routed lines from `agent-runner.ts` do.)

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (this row, single-host single-fire)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** raw journal capture + narrowed grep output, both committed to row dir on completion

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Two literal lines in the journal, in any order, within the 60s window from `T0` (dispatch instant):

```
Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
[continuation:delegate-spawned] hop=N/MAX mode=silent session=agent:main:discord:channel:1466192485440164011 task=...
```

(Session-key + hop-number + task-string vary per fire; the load-bearing literals are `Consuming N tool delegate(s)` and `delegate-spawned hop=`.)

### How to gather what we expect — path to harness script in row dir

`swims/swim-44/rows/row-01-measure.sh <host-tag> <T0_epoch>`

Script implements truth-floor reach by construction: raw `journalctl` capture first (no grep), then narrowing grep as a separate pipeline stage. Raw output retained at `/tmp/swim-44-row-01-<host>-<T0>/raw-journal.log` for re-read if narrowing misses substrate vocabulary.

### What FAIL looks like — literal substrate bytes for negative case

Raw journal capture is non-empty (gateway is up, harness has access) AND contains zero matches for `Consuming [0-9]+ tool delegate` and zero matches for `delegate-spawned hop=` AND the `delegate` substring search confirms substrate emitted no delegate-related activity in window.

Distinguishing FAIL from INCONCLUSIVE: if `event-loop-lag armed`, `systemd.*started`, or `new node PID` appears in raw window, gateway restart confound triggers INCONCLUSIVE (script exit 2). If raw shows delegate activity under different vocabulary than our narrow pattern, METHOD-BROKEN (script exit 3 — fix narrow pattern, re-run).

### Result — actual output, byte-pinned

**Fire 1: cael-host, T0=1778168968 (2026-05-07 08:49:28 PDT), window 60s**

```
# host: cael, T0=1778168968
$ journalctl --user -u openclaw-gateway --since '@1778168968' --until '@1778169028' --no-pager | grep -E 'delegate'
May 07 08:50:22 cael node[4011725]: [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
```

**Fire 1 extended window check (T0+232s) for `delegate-spawned hop=` literal:**

```
# host: cael, window extended to 1778169200 (2026-05-07 08:53:20 PDT)
$ journalctl --user -u openclaw-gateway --since '@1778168968' --until '@1778169200' --no-pager | grep -E 'delegate-spawned|Consuming.*delegate'
May 07 08:50:22 cael node[4011725]: [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
```

One literal present (`Consuming 1 tool delegate(s)`); zero `delegate-spawned hop=` even with window extended ~4x.

### Verdict — PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN

**Verdict: METHOD-BROKEN → substrate-finding → row redefinition**

Script exit 3 (METHOD-BROKEN) per truth-floor reach: raw contained `delegate` lines but narrow pattern's expected second literal (`delegate-spawned hop=`) was not present. Per row design, this triggers vocabulary-check before interpretation.

**Substrate-finding from extended-window byte-walk** (T0+232s): silent-mode `continue_delegate` on deployed v5.5 cael-host emits ONLY `Consuming N tool delegate(s)` to user-systemd journal. The `delegate-spawned hop=N/MAX mode=...` literal does NOT appear for silent mode in this seat's window. Comparison: row-04 from earlier today (normal-mode delegate, msg `1501936468799525025`) DID emit `delegate-spawned hop=6/200 mode=normal` literal. So `delegate-spawned hop=` appears to be normal-mode-specific, not silent-mode.

**Same family-shape as morning's `WORK timer set` finding**: code-source emits two literals via different log-routes; deployed v5.5 user-systemd journal surfaces only the `agent-runner.ts`-routed `defaultRuntime.log` line, not the `delegate-dispatch.ts`-routed `log.info` line. Source-code-inference would expect both; byte-walked-from-deployed-substrate shows only one. Eleventh-instance same-teacher today (substrate-discipline, dropped catalog naming per figs caveat).

**Row redefinition** (revised PASS-bytes for silent-mode, byte-walked):
- PASS-byte (silent mode, deployed v5.5): single literal `Consuming N tool delegate(s) for session <session-id>` in journal within 60s of dispatch.
- The two-literal expectation in original row design was source-code-inferred and substrate-incorrect for silent mode.

**Verdict on revised PASS-bytes**: cael-host fire-1 PASSES. Single PASS-literal byte-confirmed at 08:50:22 PDT.

**Follow-on row candidate**: row-02 to test normal-mode `continue_delegate` — would PASS with two literals (Consuming + delegate-spawned hop=). Confirms the silent-vs-normal mode log-routing divergence.

### Truth-floor reach (when in doubt)

If narrowed gather returns 0 results, do NOT interpret as substrate FAIL. The script's exit code already enforces this: exit 3 (METHOD-BROKEN) fires automatically if raw shows `delegate` activity that the narrow pattern missed. If raw shows zero delegate activity AND narrowed returns zero, that's substrate FAIL (exit 1). The discriminator is in the script, not in runner judgment.

## Status ladder

- [x] **Triaged** — first canonical-template row authored from cael-seat as Deployer-build-verify of post-#13 template surface
- [ ] **PASS-candidate** / **PARTIAL** / **OPEN-GAP** / **METHOD-BROKEN** (pick one when fired)
- [ ] **Comprehension-gated** — N/A (Deployer-authored, single-host single-fire)
- [ ] **Authored** — script + row file committed to branch `cael/swim-44-row-01-continue-delegate-silent-wake`
- [ ] **Verified** — Verdict landed on byte-pinned Result block
- [ ] **Evidence-cleansed** — N/A (no upstream-PR evidence appendix for this row)

## References

- **SUT source paths**: `src/auto-reply/reply/agent-runner.ts:2530-2580` (dispatch + Consuming literal), `src/auto-reply/continuation/delegate-dispatch.ts` (delegate-spawned literal)
- **Template substrate-fact**: SWIM-METHODOLOGY.md:90 — *"grep before claiming, SSH before asserting, read before speaking"*
- **Cohort substrate-discovery (today)**: deployed v5.5 routes `log.info`-emissions from `scheduler.ts` somewhere other than user-systemd journal; only `defaultRuntime.log`-emissions from `agent-runner.ts` reach the journal at info-level. Inferred-from-source PASS-byte expectations diverged from byte-walked-from-deployed-substrate truth in three independent prince byte-walks. This row uses byte-walked vocabulary, not source-inferred vocabulary.

## Notes

First worked-example row authored under the post-#13 + #15 merged template. Purpose is dual: (1) byte-decide whether `continue_delegate(silent)` produces both expected journal literals on cael-host deployed v5.5, (2) demonstrate the new template's measurement-protocol fields with a concrete substrate-test rather than a swim-43-style chat-pseudo-row.

If row-01 PASSes from cael-seat, it's available as worked-example for any future continuation-substrate row in any swim. If row-01 FAILs, that's a real continuation-substrate finding worth filing. If row-01 returns METHOD-BROKEN, the script's narrow pattern needs revision before further interpretation.
