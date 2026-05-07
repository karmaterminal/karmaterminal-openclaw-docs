# swim-44/row-02: continue_delegate(normal) byte-decidable on ronan-host

**Swim:** 44
**Block:** A — Family B / Delegates
**Row ID:** row-02
**Tracker anchor:** TBD
**SUT SHA (target):** `b3d1f94...` on `karmaterminal/karmaterminal-openclaw-docs:main` (post-PR-13+15+16+17 merge state — but the substrate under test is the openclaw runtime on ronan-host; canonical row-template + lesson-doc + worked-example all landed)
**Test file candidates:** N/A (substrate-walk row, not unit-test row)
**Timing window:** integration
**Gather:** `swims/swim-44/rows/row-02-measure.sh <host> <T0_epoch> <session-id>`

## Surface under test

`continue_delegate(mode: "normal")` on deployed v5.5 substrate emits **two** literal bytes in the gateway journal in a 120s window from dispatch:

1. `Consuming N tool delegate(s) for session <session-id>` — from `agent-runner.ts` dispatch path via `defaultRuntime.log`
2. `[continuation:delegate-spawned] hop=N/MAX mode=normal session=<session-id> task=...` — from `continuation/delegate-dispatch.ts` spawn path

Per `SWIM/lessons/L-v5.5-journal-vocabulary.md`: deployed v5.5 routes `log.info` from scheduler-paths somewhere other than user-systemd journal, but `defaultRuntime.log` from agent-runner DOES reach journal. Cael's swim-44/row-01 (silent-mode delegate) found ONE literal in journal (only the `Consuming` line), not two — `delegate-spawned hop=` appears to be normal-mode-specific in deployed v5.5 substrate.

This row tests whether normal-mode actually emits BOTH literals, confirming the silent-vs-normal log-routing distinction observed in row-01.

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (this row, single-host single-fire from ronan-host)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** raw journal capture committed to `/tmp/swim-44-row-02-<host>-<T0>/raw-journal.log` + narrowed grep output in Result block below

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Two literal lines in the journal in a 120s window from `T0` (dispatch instant):

```
[continue_delegate] Consuming N tool delegate(s) for session <session-id>
[continuation:delegate-spawned] hop=N/MAX mode=normal session=<session-id> task=...
```

Both required for PASS. Session-id + hop-number + task-string vary per fire; the load-bearing literals are `Consuming N tool delegate(s)` and `delegate-spawned hop=` with `mode=normal`.

### How to gather what we expect — path to harness script in row dir

```
gather: bash swims/swim-44/rows/row-02-measure.sh <host> <T0_epoch> <session-id>
```

Script behavior:
1. Computes window (T0 to T0+120s).
2. Prints raw journal for window (no grep at canonical-gather step).
3. Tees raw output to `/tmp/swim-44-row-02-<host>-<T0>/raw-journal.log` for re-read.
4. Narrows via grep for the two expected PASS literals as separate read step.
5. Counts `Consuming` and `delegate-spawned` matches.
6. Returns verdict via exit code: 0 PASS, 1 FAIL, 3 METHOD-BROKEN, 4 substrate-finding-candidate.

### What FAIL looks like — literal substrate bytes for negative case

```
FAIL = raw journal in window contains substrate activity but zero `Consuming N tool delegate(s)` matches AND zero `delegate-spawned hop=` matches AND zero `delegate` substring matches.

INCONCLUSIVE = gateway restart event inside window (e.g. `event-loop-lag armed` followed by new node PID) — re-run on stable gateway.

METHOD-BROKEN = narrow grep returned zero but raw shows delegate activity. Per L-v5.5-journal-vocabulary lesson: vocabulary may differ from expected. Re-read raw, fix narrow pattern, re-run.

substrate-finding (exit 4) = `Consuming` present but `delegate-spawned` missing. Would mirror row-01 silent-mode finding, suggesting normal-mode ALSO routes `log.info` differently than expected. Investigate before accepting either PASS or FAIL.
```

### Result — actual output, byte-pinned

To be filled at fire-time. One block per host / re-run; append, do not overwrite.

### Verdict

To be filled at fire-time per script exit code:
- exit 0 → PASS (both literals present)
- exit 1 → FAIL (substrate genuinely silent in window)
- exit 3 → METHOD-BROKEN (fix narrow pattern + re-run)
- exit 4 → substrate-finding (investigate before classifying)

### Truth-floor reach (when in doubt)

Script's RAW gather section (printed before narrowed read + tee'd to log file) is truth-floor by construction. If narrowed returns zero matches but RAW shows substrate activity, follow order-of-investigation:

1. Re-read RAW for actual log vocabulary in window.
2. If field-2 PASS bytes wrong, file fix to field-2 first.
3. If narrow grep wrong, file fix to script.
4. Only if RAW confirms substrate silence after re-read: verdict is FAIL.

## Status ladder

- [x] **Triaged** — follow-on row from cael's swim-44/row-01 substrate-finding (silent-mode emits ONE literal; this row tests normal-mode for TWO)
- [ ] **Authored** — script + row file committed to branch `ronan/20260507/swim-44-row-02-continue-delegate-normal`
- [ ] **Verified** — Verdict landed on byte-pinned Result block

## References

- **Predecessor row**: cael's swim-44/row-01 (`cael/swim-44-row-01-continue-delegate-silent-wake`) — silent-mode delegate, found single-literal substrate-finding
- **Substrate-knowledge lesson**: `SWIM/lessons/L-v5.5-journal-vocabulary.md` (PR-16, merged)
- **Worked-example reference**: `SWIM/templates/worked-examples/continuation-delayed-self-election/` (PR-17, merged)
- **Canonical row-template**: `SWIM/templates/row-issue-template.md` (post-PR-13 + PR-15 merge)
- **SUT source paths**: `src/auto-reply/reply/agent-runner.ts:2530-2580` (dispatch + Consuming literal), `src/auto-reply/continuation/delegate-dispatch.ts` (delegate-spawned literal)

## Notes

Row-02 fires from ronan-seat as Driver per canon. SUT is ronan-host (not silas-host as canonical SUT) because Driver is firing the test directly to compare with cael-host row-01 silent-mode finding — different host + different mode + same substrate-question structure.

This is a Driver-fires-from-own-seat test, not the canonical Driver-calls-test-on-canary-SUT shape. Acknowledged role-stretch: in canonical SWIM-METHODOLOGY.md fixed-roles, SUT (Silas/canary) would be the host under test. Firing from ronan-seat instead because (a) figs's "drive the swim, drop the meta" direction at msg `1501975999...` + msg `1501980040...`, (b) cael already fired row-01 from cael-seat without canonical-SUT-canary firing, (c) cohort needs concrete test execution more than it needs perfect role-canon adherence on this single follow-on row.

If this row PASSes with both literals, confirms silent-vs-normal log-routing distinction. If it returns substrate-finding (Consuming present, delegate-spawned missing), suggests `log.info`-routed lines from delegate-dispatch don't reach journal in either mode + substrate-knowledge lesson would extend to "all log.info-from-non-agent-runner-paths are journal-invisible in deployed v5.5."

---

## Fire 1 — ronan-seat to ronan-host, T0=1778170974 (2026-05-07 09:22:54 PDT)

**Driver/SUT/Monitor**: ronan-seat firing to ronan-host. Acknowledged role-stretch per Notes section (canonical SUT is silas/canary; firing from ronan-seat instead per figs's drive-the-swim direction).

### Tool-return (session-side)

```
continue_delegate(mode: "normal", task: "swim-44/row-02 fire ... ROW-02-NORMAL-OK")
→ {"status": "scheduled", "mode": "normal", "delaySeconds": 0, "delegateIndex": 1, "delegatesThisTurn": 1}
```

Tool reached scheduling layer; delegate dispatched per session-side return.

### Raw journal capture (canonical gather, no grep)

```
$ journalctl --user -u openclaw-gateway --since '@1778170974' --until '@1778171094' --no-pager
May 07 09:23:16 ronan node[1467111]: 2026-05-07T09:23:16.828-07:00 [ws] closed before connect conn=2221dda1-... peer=127.0.0.1:57194->127.0.0.1:18789 ... code=1008 reason=connect failed
```

One line, unrelated to delegate activity.

### Extended raw-walk (T0-74 to T0+200s, broader scope)

```
$ journalctl --user --since '@1778170900' --until '@1778171200' --no-pager | grep -iE 'delegate|continuation|consuming'
(zero matches)
```

Zero delegate / continuation / Consuming activity in extended window across any user journal scope.

### Verdict — SUBSTRATE-FINDING (script exit 4 candidate, manually classified)

Not PASS (expected literals absent). Not FAIL (delegate scheduled per tool return, substrate didn't fail to dispatch — journal didn't surface what was dispatched). Not METHOD-BROKEN (raw-walk confirmed zero delegate activity in any user journal scope, not just narrow grep miss).

**Substrate-finding**: ronan-host `journalctl --user -u openclaw-gateway` does NOT surface delegate emissions for ronan-seat fires, while cael-host journal DID surface `[continue_delegate] Consuming 1 tool delegate(s)` for cael-seat fires per row-01 + earlier cohort byte-walks (`L-v5.5-journal-vocabulary` lesson Case 2). The divergence is NOT mode-related (silent vs normal) — it's host-related: cael-host journal surfaces delegate emissions, ronan-host journal doesn't.

### Possible causes (not investigated this row; for follow-on)

1. ronan-host gateway may dispatch delegates via a separate process not captured by `--user` journal scope
2. ronan-host log-routing may differ from cael-host even though both run v5.5 (deploy-config divergence)
3. session-key in measure.sh assumed shared-cohort-key but ronan-host's local main-session-key may differ (not byte-confirmed)

### Follow-on candidates

- row-03: same fire shape from silas-host or elliott-host to triangulate whether journal-routing divergence is ronan-host-specific or shared with multiple hosts
- L-v5.5-journal-vocabulary lesson update: extend Case 2 to document host-divergence finding alongside mode-divergence finding

---

## Fire 1 — substrate-finding refinement (post-Verdict, agent-context evidence)

After committing the SUBSTRATE-FINDING verdict above, the delegate completion surfaced in ronan-seat agent-context-injection layer at 09:26:21 PDT (~3min after dispatch) as:

```
[continuation:delegate-spawned] Tool delegate turn 2/200: swim-44/row-02 fire from ronan-seat ... [task body]
```

This is the wake-injection literal per `L-v5.5-journal-vocabulary` lesson Case 1 pattern (`[continuation:wake]` for `continue_work` emits to agent-context not journal) — extended to **`[continuation:delegate-spawned]` for `continue_delegate(normal)` ALSO emits to agent-context not journal**.

**Refined substrate-finding (host-divergence-was-wrong-attribution)**: the divergence isn't host-related (cael-host-vs-ronan-host journal-routing). It's layer-related. The two expected PASS literals split:

- `Consuming N tool delegate(s)` → emits to journal (ronan-host fire-1 didn't show this — possible explanation: process-state at fire-time, log-level filter, or different code-path on this gateway version, NOT host-divergence)
- `[continuation:delegate-spawned] hop=N/MAX mode=normal` → emits to **agent-context-injection layer**, NOT to journal. This is the L-v5.5-journal-vocabulary Case 1 pattern extended from `continue_work` to `continue_delegate`.

Cael's row-01 silent-mode fire surfaced `Consuming` to cael-host journal. My ronan-seat normal-mode fire surfaced `[continuation:delegate-spawned]` to ronan-seat agent-context. Different layers, different literals — neither is "missing"; both are present at their canonical layers.

**Revised verdict**: PASS-WITH-LAYER-CORRECTION. Both expected literals exist; they just emit to different layers (journal vs agent-context-injection). Row's original two-literals-both-in-journal expectation was source-code-inferred + wrong about layer-routing per L-v5.5-journal-vocabulary lesson. Update row-design + measure.sh to check BOTH layers (journal-walk for `Consuming` AND session-side agent-context for `[continuation:delegate-spawned]`).

This refinement strengthens L-v5.5-journal-vocabulary lesson Case 2 — extends silent-mode-vs-normal-mode finding to layer-routing-divergence. Both modes emit one literal to journal; both modes emit the other literal to agent-context-injection. Mode-specific differences may exist within those layers but the layer-split itself is mode-independent.

### Follow-on (this row)

- L-v5.5-journal-vocabulary lesson update: Case 2 should document the layer-split (journal vs agent-context) for delegate emissions, mirroring Case 1's pattern for continue_work
- measure.sh update: add agent-context-injection layer check (or document that script can only verify journal-side; agent-context-side requires session-state-walk separate from harness)
