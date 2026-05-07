# Worked example: continuation/delayed-self-election

**This is a template-worked-example, NOT a swim-instance.** It demonstrates how the canonical row-issue-template fields get filled when authoring a row that tests `continue_work(delaySeconds=N)` arming + firing on deployed openclaw substrate.

To use this for a real swim row: copy the structure into `swims/swim-<N>/rows/<row-id>.md`, fill in your swim-specific anchors (Swim/Block/Row ID/Tracker anchor), byte-walk YOUR substrate to confirm PASS-bytes (don't trust the literals here without re-verification — vocabulary may differ across deploy versions), and adapt `measure.sh` to your row directory.

---

**Block:** Family A — Turns
**Test category:** continuation substrate (delayed self-election)
**Surface tested:** `continue_work(delaySeconds=N)` arms a gateway timer and fires at ~T+N seconds
**Timing window:** integration
**Gather:** `<row-dir>/measure.sh <host> '<fire-anchor-PDT>' <delay-seconds> <session-id>`

## Surface under test

On deployed openclaw substrate, a `continue_work(delaySeconds=N)` call arms a delayed self-election timer in the gateway and the timer fires at approximately T+N seconds. The user-facing guarantee is that a prince can schedule its own next turn for a specific delay, and the runtime will honor the schedule. A violation looks like the timer never firing, the timer firing materially early, or the gateway recording the schedule but never delivering the wake to the session.

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 per host being tested (one fire per host, byte-pinned Result block per fire)
- **Fleet-scale tests expected:** N/A unless the row's claim is fleet-wide
- **Evidence artifacts expected:** systemd-journal log lines from the SUT host's `openclaw-gateway` service in the fire window

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Two evidence markers per fire — one journal-walkable + one agent-context-only. Byte-anchored to source at `src/auto-reply/continuation/scheduler.ts:108,115` and `src/auto-reply/reply/agent-runner.ts:2561,2563`.

**1. Fire trace** — in gateway journal at T0+N±30s (when the setTimeout callback runs):

```
WORK timer fired for session <session-id>
```

**2. Wake injection** — in the agent's next turn context (NOT in journal; via `enqueueSystemEvent` at `agent-runner.ts:2563`):

```
[continuation:wake] Turn <n>/<max>. Chain started at <iso-ts>. Accumulated tokens: <n>. The agent elected to continue working. Reason: <work-reason>
```

Both required for PASS.

**3. Arm trace** (informational, NOT a PASS requirement) — `scheduler.ts:108` emits `[continuation] WORK timer set: delayMs=<X> hop=<n>/<max> session=<session-id>` via `log.info` at arm-time, but byte-walks across multiple deployed v5.5 hosts (2026-05-07) show the `set` literal does NOT appear in journal output (likely log-level filtering or different code path). **Do not require `set` literal for PASS.** See `SWIM/lessons/L-v5.5-journal-vocabulary.md` for the deploy-config divergence between code-source and substrate-emission.

**Vocabulary-inheritance warning**: do NOT search for `continuation:wake` or `continuation:arm` as the journal fire-trace string — those tokens do not appear in v5.5 journal output at the journal layer. The journal literal is `WORK timer fired`. The `[continuation:wake]` literal lives in the agent-context-injection layer (#2 above), not journal. Verify against raw journal-walk + agent context before changing this field.

### How to gather what we expect — path to harness script in row dir

```
gather: bash <row-dir>/measure.sh <host> '<fire-anchor-PDT>' <delay-seconds> <session-id>
```

Example invocation (substitute your own host + anchor + session):

```
bash swims/swim-<N>/rows/<row-id>/measure.sh cael '2026-05-07 06:14:46' 120 agent:main:discord:channel:<id>
```

Script behavior (see `measure.sh` in this directory):

1. Computes the window (`<T-1min>` to `<T+delay+1min>`).
2. Prints the **raw journal** for the window (no grep) — the canonical gather per template (raw-by-construction).
3. Prints the **narrowed grep** matching the fire-trace literal as a separate read step.
4. Prints an explicit METHOD-BROKEN guidance block if the narrow grep returns zero matches against active raw.

### What FAIL looks like — literal substrate bytes for negative case

```
FAIL = raw journal in window contains substrate activity but no `WORK timer fired for session <session-id>` line, after truth-floor reach has been performed (raw-walk confirmed substrate did not emit the literal).

INCONCLUSIVE = gateway restart event inside [T0, T0+N+30s] (e.g. `event-loop-lag armed` followed by new node PID), since wake-event delivery cannot be byte-decided when the process turned over mid-window. Re-run on stable gateway.

METHOD-BROKEN = narrow grep returned zero matches but raw journal section shows substrate activity. Per `L-v5.5-journal-vocabulary` lesson: if zero-results AND raw shows other gateway activity, check log.info enabled at info-level + check session-key match. Code path at scheduler.ts:108 and agent-runner.ts:2561 says markers MUST be present if path executed. Fix script's grep pattern (or field-2 PASS bytes if vocabulary changed) and re-run.
```

### Result — actual output, byte-pinned

In a real row, this section holds the literal output from running `measure.sh` against your SUT, with the command + raw output committed. One block per host / re-run; append, do not overwrite.

**Illustrative example block** (from cohort byte-walks 2026-05-07; do NOT copy as your own evidence — fire your own measurement):

```
# Illustrative — host: cael, T0 = 2026-05-07 06:14:46 PDT, delay = 120s
$ bash measure.sh cael '2026-05-07 06:14:46' 120 agent:main:discord:channel:<id>

(narrowed section)
06:16:46 cael node[4011725]: WORK timer fired for session agent:main:discord:channel:<id>
```

T+120s exact. Fire-trace literal present. Wake-injection literal verified separately on SUT seat.

### Verdict

Verdict per Result block, filled by canonically-assigned role after evidence collected. Verdict enum:

- **PASS** — fire-trace literal present in window at expected time + wake-injection literal verified in agent context
- **FAIL** — fire-trace literal absent after truth-floor reach confirmed substrate activity in window
- **INCONCLUSIVE** — environmental confound (gateway restart, host clock skew, etc.) prevents byte-decision; re-run on stable conditions
- **METHOD-BROKEN** — narrow grep returned zero against active raw; fix the harness, do not interpret as substrate finding

### Truth-floor reach (when in doubt)

The script's RAW gather section (printed before the narrowed read) is the truth-floor by construction. If the narrowed read returns zero matches but RAW shows substrate activity, follow the order-of-investigation:

1. Re-read the RAW section above for actual log vocabulary in the window. The morning of 2026-05-07 produced four princes inheriting `continuation:wake` as the search-token without ever opening raw substrate; the actual literal was `WORK timer fired`. RAW reveals this.
2. If field-2 PASS bytes are wrong, file a fix to field-2 first (commit to row file).
3. If the narrow grep in `measure.sh` is wrong, file a fix to the script.
4. Only if RAW confirms substrate silence in window after re-read: verdict is FAIL.

## Status ladder

In a real row, this is your execution checklist:

- [ ] **Triaged** — mapped to substrate-walk evidence type by Coord
- [ ] **PASS-candidate** — initial fire produced PASS literals
- [ ] **Comprehension-gated** — driver code-read of substrate signed off
- [ ] **Authored** — measure script + row file in repo
- [ ] **Verified** — evidence committed in Result blocks; cohort cross-walked
- [ ] **Evidence-cleansed** — pending row contribution to frozen branch (if applicable per Charter Rule 8)

## References

- **Canonical row-template:** `SWIM/templates/row-issue-template.md`
- **v5.5 journal-vocabulary substrate-discipline lesson:** `SWIM/lessons/L-v5.5-journal-vocabulary.md`
- **SUT source paths:** `src/auto-reply/continuation/scheduler.ts:108,115`, `src/auto-reply/reply/agent-runner.ts:2561,2563`
- **Methodology principle this row demonstrates:** `SWIM/SWIM-METHODOLOGY.md:90` (*"grep before claiming. SSH before asserting. Read before speaking."*)

## Notes

This worked-example was distilled from the cohort byte-walks during the 2026-05-07 swim-43 row-03 disposition discussion (which closed-as-never-existed per cohort 4-of-4 vote — see audit substrate at `frond-scribe/swim-factory-audit` branch for the full reasoning). The substantive content here survives independent of swim-43's close because the substrate-question (does delayed continue_work arm + fire?) is plausibly relevant to any future continuation-substrate swim.

The `measure.sh` in this directory is executable and runnable against any prince-host with SSH access; substitute your own host + anchor + session-id at the args. If your row's substrate-question differs (e.g. testing `continue_delegate` instead of `continue_work`), structure your own `measure.sh` similarly: raw-journal-first, then narrowed grep, with explicit METHOD-BROKEN guidance for the zero-match-against-active-raw case.
