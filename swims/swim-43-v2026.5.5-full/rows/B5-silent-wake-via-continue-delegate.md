# swim-43/B5 — F5 silent-wake via continue_delegate on cael-host

**Swim:** swim-43-v2026.5.5-full
**Block:** B — Family Delegates
**Row ID:** B5
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/B5.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011`
**Test file candidates:** N/A (live-row delegate behavior)
**Timing window:** integration
**Evidence class:** live-row,cross-seat
**Gather:** SUT-side tool-return + recipient-side proof-of-silence + wake-fire proof + monitor journal cross-source where available

## Surface under test

Per `SWIM/cases/B5.md`: `continue_delegate(mode: "silent-wake")` returns silently to context and triggers a subsequent generation cycle so the agent can act on the enrichment.

This row's specific test: fire one immediate `continue_delegate(mode: "silent-wake")` from cael-seat on deployed v5.5 substrate under quiet channel conditions, then verify:
1. tool-return says scheduled in `silent-wake` mode
2. no visible channel announce occurs for the shard return
3. a subsequent turn fires on the parent session after the enrichment returns
4. parent can reference or act on the returned enrichment

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (single-host fire from cael-seat to cael-host)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** tool-return receipt, channel-read proving silence, wake-fire timing, returned enrichment token or parent-action receipt, optional monitor-side journal bytes

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Three-source shape, with source (a) primary and source (b) corroborating when journal emits.

**Source (a) tool-return**
```text
continue_delegate(mode: "silent-wake", task: "...")
→ {"status":"scheduled","mode":"silent-wake", ...}
```

**Source (a) silence on channel / no visible delegate announce**
- no visible delegate-completion message lands in channel for the shard return
- parent wake happens without a public shard-result post

**Source (a) parent wake-fire**
One subsequent parent turn fires after the delegate completes. Acceptable proof shapes:
- system / tool-return wake event on parent session
- parent posts unprompted after the delegate return
- parent explicitly references delegate-returned token/body in the wake turn

**Source (b) journal corroboration when available**
Candidate bytes include:
```text
[continue_delegate] Consuming N tool delegate(s)
[continuation:delegate-spawned] hop=N/MAX mode=silent-wake ...
[continuation:enrichment-return] Delivered to ...
```
But journal-side literals are not PASS-critical unless byte-walked on the host for this exact fire-shape; deployed-v5.5 log routing is already known to vary by host/fire-shape.

### How to gather what we expect

1. SUT fires `continue_delegate(mode: "silent-wake")` with a unique nonce/token in the task body.
2. Driver/Monitor read channel for absence of visible delegate return.
3. Driver/Monitor watch parent wake within a bounded window.
4. Parent wake turn includes the nonce/token or an action clearly grounded in the returned delegate enrichment.
5. Optional: Monitor `ssh cael "journalctl --user -u openclaw-gateway --since '<T0>' --until '<T0+120s>' --no-pager"` and narrow for delegate bytes.

### What FAIL looks like

```text
FAIL = tool-return says scheduled, but delegate return surfaces visibly on channel (not silent), OR no parent wake occurs, OR parent wake occurs but cannot be tied to delegate enrichment.

INCONCLUSIVE = gateway restart / compaction / unrelated inbound message confounds the wake window.

METHOD-BROKEN = silence proof impossible because channel is noisy or a second concurrent delegate fire overlaps the same window.
```

### Result — actual output, byte-pinned

To be filled at fire-time.

### Verdict

To be filled at fire-time:
- PASS = silent return + wake-fire + delegate-enrichment grounded on parent
- FAIL = visible return or missing wake
- INCONCLUSIVE = confounded window
- METHOD-BROKEN = overlapping/noisy measurement surface

## Status ladder

- [x] **Triaged** — required per B5 case file
- [x] **Authored** — row file created
- [ ] **Fire-ready** — waiting on SUT silent-wake fire on cael-seat
- [ ] **Verified** — verdict landed with byte-pinned evidence

## References

- **Case file**: `SWIM/cases/B5.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md`
- **Monitoring notes**: `SWIM/SWIM-MONITORING-RUNBOOK.md` (`silent-wake`, `enrichment-return`, `requestHeartbeatNow` guidance)
- **Related substrate docs**: `SWIM/lessons/L-v5.5-journal-vocabulary.md`

## Notes

This row should prefer source (a) over source (b). The user-facing claim for `silent-wake` is not journal-text-specific; it is that the shard returns silently and wakes the parent. Journal corroboration is welcome but secondary.

To avoid contamination:
- fire under a quiet channel window
- use a unique nonce in the delegate task
- avoid overlapping delegate fires on the same host/session during the measurement window
