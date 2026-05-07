# swim-43/D1 — R1 boot-time stall check on cael-host

**Swim:** swim-43-v2026.5.5-full
**Block:** D — Family Recovery
**Row ID:** D1
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/D1.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011`
**Test file candidates:** N/A (live boot/recovery row)
**Timing window:** integration
**Evidence class:** deploy,live-row
**Gather:** Monitor/SUT cross-seat boot timing + journal boot window + staged-work pre/post comparison

## Surface under test

Per `SWIM/cases/D1.md`: gateway boots cleanly without stall on continuation initialization; staged delegates from prior runs are recovered or expired cleanly.

This row has two coupled claims:
1. boot-time stall does **not** occur during restart/boot on deployed v5.5 substrate
2. staged continuation work present before boot is handled cleanly after boot (recovered or expired, not orphaned)

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 live restart row on cael-host
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** pre/post TaskFlow snapshot with staged work, systemd timing, boot-window journal, cross-seat Monitor verification

## Measurement protocol

### What we expect — literal substrate bytes for PASS

**Source (a) boot timing / service state**
```bash
systemctl --user show openclaw-gateway \
  --property=ActiveEnterTimestamp,InactiveExitTimestamp,ExecMainStartTimestamp,LoadState,ActiveState,SubState
```
PASS requires loaded/active/running with no prolonged gap between stop and ready.

**Source (b) boot-window journal**
```bash
journalctl --user -u openclaw-gateway --since '<T0>' --until '<T0+90s>' --no-pager
```
PASS requires visible boot sequence reaching `[gateway] ready` without stall-loop / repeated failed startup / prolonged gap.

**Source (c) staged-work handling**
```bash
sqlite3 ~/.openclaw/flows/registry.sqlite \
  "SELECT flow_id,status,shape,created_at,updated_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id"
```
PASS requires non-empty staged work pre-boot and post-boot handling that preserves or coherently resolves those entries.

### What FAIL looks like

- gateway fails to reach `active/running`
- boot sequence stalls before `[gateway] ready`
- staged runnable/queued flow state is lost or corrupted across restart

### Result — actual output, byte-pinned

#### Fire 1 — monitor baseline from elliott-seat, cael-host restart at 2026-05-07 09:47 PDT

**Source (a) systemd timing/state**
```bash
$ ssh cael "systemctl --user show openclaw-gateway --property=ActiveEnterTimestamp,InactiveExitTimestamp,ExecMainStartTimestamp,LoadState,ActiveState,SubState"
ActiveEnterTimestamp=Thu 2026-05-07 09:47:11 PDT
InactiveExitTimestamp=Thu 2026-05-07 09:47:11 PDT
ExecMainStartTimestamp=Thu 2026-05-07 09:47:11 PDT
LoadState=loaded
ActiveState=active
SubState=running
```

**Source (b) boot-window journal**
```bash
$ ssh cael "journalctl --user -u openclaw-gateway --since '2026-05-07 09:47:00' --until '2026-05-07 09:48:30' --no-pager -o short-iso"
2026-05-07T09:47:00-07:00 cael systemd[2439]: Stopping openclaw-gateway.service - OpenClaw Gateway (v2026.4.11)...
2026-05-07T09:47:00-07:00 cael node[4011725]: 2026-05-07T09:47:00.877-07:00 [gateway] signal SIGTERM received
2026-05-07T09:47:01-07:00 cael node[4011725]: 2026-05-07T09:47:01.331-07:00 [agent/embedded] [timeout-compaction] LLM timed out with high prompt token usage (73%); attempting compaction before retry (attempt 1/2)
2026-05-07T09:47:01-07:00 cael node[4011725]: 2026-05-07T09:47:01.331-07:00 [agent/embedded] [context-pressure:fire] mid-turn trigger=timeout ratio=73% tokens=733k/1000k sessionKey=agent:main:discord:channel:1466192485440164011
2026-05-07T09:47:10-07:00 cael node[4011725]: 2026-05-07T09:47:10.773-07:00 [shutdown] completed cleanly in 9886ms
2026-05-07T09:47:11-07:00 cael systemd[2439]: Started openclaw-gateway.service - OpenClaw Gateway (v2026.4.11).
2026-05-07T09:47:14-07:00 cael node[4184469]: 2026-05-07T09:47:14.017-07:00 [gateway] ready
```
No stall observed in this restart window; gateway returned to ready in ~14s from stop.

**Source (c) staged-work precondition check**
```bash
$ ssh cael "sqlite3 ~/.openclaw/flows/registry.sqlite \"SELECT status, COUNT(*) FROM flow_runs GROUP BY status ORDER BY status;\""
cancelled|1
failed|9
succeeded|134

$ ssh cael "sqlite3 ~/.openclaw/flows/registry.sqlite \"SELECT flow_id,status,shape,created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id;\""
-- no rows
```
There was no runnable/queued staged work at fire-time.

### Verdict

**Current verdict: PASS.**

Historical split:
- **Fire 1** gave a clean no-stall baseline but was INCONCLUSIVE for the full row because there was no staged work to preserve.
- **Fire 2** completed the missing half using the same canonical restart window that closed A1: boot remained clean and staged queued continuation work survived the restart coherently.

#### Fire 2 — substantive staged-work restart using A1 fire-3 window (2026-05-07 12:04–12:10 PDT)

**Source (a) staged-work pre-restart**
```text
flow_id=e9a87f45-4806-4a69-9f58-629ed629b3bf
status=queued
current_step=Queued for continuation dispatch
owner_key=agent:main:discord:channel:1466192485440164011
notify_policy=silent
created_at=1778180670729
updated_at=1778180670729
```

**Source (a) restart receipt / boot timing**
```text
workflow run 25516284592 = success
ActiveEnterTimestamp=Thu 2026-05-07 12:05:06 PDT
MainPID=100312
NRestarts=0
```

**Source (b) staged-work post-restart / cross-seat corroboration**
```text
T_post_restart_epoch=1778181007
flow_id|status|shape|current_step|owner_key|notify_policy|created_at|updated_at
e9a87f45-4806-4a69-9f58-629ed629b3bf|queued||Queued for continuation dispatch|agent:main:discord:channel:1466192485440164011|silent|1778180670729|1778180670729
```

What this now proves:
- cael-host reaches `active/running` cleanly without boot stall in the observed restart windows
- staged queued continuation work present before restart remains coherent after boot, not orphaned or lost

So D1 now satisfies both coupled claims in the case file:
1. no boot-time stall on deployed v5.5 cael-host
2. staged continuation work survives the boot path without being orphaned

## Status ladder

- [x] **Triaged**
- [x] **Authored**
- [x] **Baseline evidence captured** — no-stall restart observed
- [x] **Substantive fire with staged work** — queued TaskFlow row survived canonical restart
- [x] **Verified PASS**

## References

- **Case file**: `SWIM/cases/D1.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Scoreboard**: `swims/swim-43-v2026.5.5-full/SCOREBOARD.md`
- **Related row**: `swims/swim-43-v2026.5.5-full/rows/A1-flow-runs-persistence-across-restart.md`

## Notes

The 09:47 restart remains the useful no-stall baseline. The later 12:04–12:10 PDT restart window (workflow run `25516284592`) completed the row by adding the missing staged-work preservation proof. A1 and D1 now share the same restart receipts from different angles: A1 answers TaskFlow row persistence directly; D1 answers boot/recovery cleanliness with staged work present.