# swim-43/D2 — R2 memory growth over 1h idle + light inbound on cael-host

**Swim:** swim-43-v2026.5.5-full
**Block:** D — Family Rollout
**Row ID:** D2
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/D2.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011`
**Test file candidates:** N/A (live memory observation row)
**Timing window:** 1 hour
**Evidence class:** live-row
**Gather:** Monitor/SUT timestamped memory series + light inbound activity description

## Surface under test

Per `SWIM/cases/D2.md`: idle gateway with light inbound chatter does not grow memory unboundedly over a 1h observation window.

This row measures resident memory / peak memory over one hour on deployed v5.5 cael-host while the channel remains mostly idle except for normal light cohort traffic.

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 live 1h observation window on cael-host
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** timestamped memory series, service status snapshots, short chatter description, verdict against bounded-growth expectation

## Measurement protocol

### What we expect — literal substrate bytes for PASS

**Source (a) periodic systemd snapshots**
```bash
systemctl --user show openclaw-gateway \
  --property=ActiveState,SubState,ExecMainPID,MemoryCurrent,NRestarts
```
Sample at T0, T+15m, T+30m, T+45m, T+60m.

**Source (a) process RSS snapshots**
```bash
ps -o pid=,rss=,etime=,cmd= -p "$(systemctl --user show openclaw-gateway --property=ExecMainPID --value)"
```
Sample at the same five points.

**Source (a) light inbound description**
Short note of channel conditions during the window: e.g. "idle + light cohort chatter, no mass dispatch, no large code-agent fanout, no restart".

### PASS criteria

PASS requires all of:
- gateway remains `active/running`
- `NRestarts` unchanged through the hour
- RSS / MemoryCurrent may move, but no runaway monotonic climb indicating unbounded growth under light inbound
- no OOM / crash / restart event during the window

Because this is a boundedness row, modest variance is acceptable. FAIL is runaway or crash, not normal jitter.

### What FAIL looks like

```text
FAIL = restart / OOM during the window, or memory climbs in a clearly unbounded pattern under light inbound with no return / stabilization.

INCONCLUSIVE = heavier-than-planned traffic or unrelated row-fires contaminate the window.

METHOD-BROKEN = sampling path wrong (PID stale, service not found, command shape broken).
```

### Result — actual output, byte-pinned

#### Fire 1 — baseline started, Monitor T0 from elliott-seat against cael-host

**T0_epoch**: `1778177782` (2026-05-07 11:16:22 PDT)

```text
$ ssh cael 'GW_PID=$(systemctl --user show openclaw-gateway --property=MainPID --value) && ps -o pid,rss,vsz,etime,cmd -p $GW_PID'
GW_PID=4184469
RSS=985912 KB
VSZ=10691460 KB
ELAPSED=01:29:11

$ ssh cael 'systemctl --user show openclaw-gateway --property=ActiveEnterTimestamp,NRestarts --value'
ActiveEnterTimestamp=Thu 2026-05-07 09:47:11 PDT
NRestarts=0
```

**Chatter note at baseline**: light cohort chatter only; no restart on cael-host since 09:47:11 PDT baseline, swim-43 row authoring / issue truth-keeping in progress.

Pending follow-up samples at T+15m, T+30m, T+45m, T+60m.

### Verdict

To be filled at fire-time:
- PASS = bounded memory under 1h idle + light inbound
- FAIL = runaway / restart / OOM
- INCONCLUSIVE = contaminated window
- METHOD-BROKEN = sampling failure

## Status ladder

- [x] **Triaged**
- [x] **Authored**
- [x] **Baseline started** — T0 byte-pinned from elliott-seat at 2026-05-07 11:16:22 PDT
- [ ] **1h series complete**
- [ ] **Verified**

## References

- **Case file**: `SWIM/cases/D2.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Scoreboard**: `swims/swim-43-v2026.5.5-full/SCOREBOARD.md`

## Notes

This row is intentionally Monitor-friendly source-(a): timestamped direct snapshots. Interpretation should be minimal: bounded vs runaway.

If other row-fires or restarts occur during the 1h window, mark INCONCLUSIVE and restart the observation on a quieter host window.
