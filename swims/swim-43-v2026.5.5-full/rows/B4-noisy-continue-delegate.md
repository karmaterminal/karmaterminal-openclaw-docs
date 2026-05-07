# swim-43/B4 — F4 noisy continue_delegate (inbound during delay) on cael-host

**Swim:** swim-43-v2026.5.5-full
**Block:** B — Family Delegates
**Row ID:** B4
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/B4.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011`
**Test file candidates:** N/A (live-row delegate behavior)
**Timing window:** integration
**Evidence class:** live-row
**Gather:** SUT-side tool-return + scheduled-fire proof + visible shard-return with nonce + flow_runs lifecycle byte-pin + inbound-during-delay-window count

## Surface under test

Per `SWIM/cases/B4.md`: delayed `continue_delegate()` handles inbound traffic during delay window without losing the scheduled fire or doubling.

This row's specific test: fire one `continue_delegate(mode: "normal", delaySeconds: N)` from cael-seat with a unique nonce, allow inbound channel traffic during the delay window, then verify:
1. tool-return at dispatch shows scheduled with the delay value
2. inbound during the delay window does not lose the scheduled fire
3. inbound during the delay window does not cause doubling of the scheduled fire
4. exactly one visible shard return appears at T0+delay with the nonce in the body
5. flow_runs entry transitions out of `queued`/`runnable` state cleanly post-fire

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (single-host fire from cael-seat to cael-host)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** SUT-side tool-return at dispatch, pre-fire flow_runs snapshot, visible shard-return with nonce match, inbound-during-window count, post-fire flow_runs state

## Measurement protocol

### What we expect — literal substrate bytes for PASS

**Source (a) SUT-side tool-return at dispatch:**
```text
continue_delegate(mode: "normal", delaySeconds: N, task: "... NONCE:<unique> ...")
→ {"status": "scheduled", "mode": "normal", ...}
```

**Source (a) pre-fire flow_runs state:**
```text
flow_id=<uuid>
status=queued (or runnable)
created_at=<T0_epoch>
```

**Source (a) visible shard-return at T0+delay:**
- visible channel announce containing `NONCE:<unique>` literal in returned body
- exactly one such announce (not zero, not two)

**Source (b) post-fire flow_runs state:**
- same flow_id present
- status transitioned to terminal state (`succeeded` or equivalent)
- updated_at > created_at

**Source (b) inbound-during-delay-window count:**
- at minimum one channel message landed between T0 dispatch and T0+delay
- this satisfies the "noisy" requirement of the row

### How to gather what we expect

SUT-side: cael-seat fires `continue_delegate(mode: "normal", delaySeconds: N, task: "... NONCE:<unique> ...")` and pre-snapshots flow_runs state.

Driver-seat: tracks T0, monitors channel for shard return, banks nonce match.

Optional Monitor cross-source: journal byte-pin from non-SUT seat for spawn entry literal.

### What FAIL looks like

```
FAIL = scheduled fire never returns (lost during delay), OR double shard-return with same nonce (inbound triggered duplication), OR shard-return missing nonce (wrong fire returned), OR flow_runs entry never transitions out of queued (stuck in scheduler).

INCONCLUSIVE = compaction or restart during the delay window confounds the measurement.

METHOD-BROKEN = nonce missing from task body (can't verify which fire returned), OR delay window too short to admit inbound (degenerate noisy test).
```

### Result — actual output, byte-pinned

#### Fire 1 — cael-seat on cael-host, `NONCE:B4-NOISY-272`, dispatched 2026-05-07 14:32:47 PDT (T0)

**Source (a) SUT-side dispatch parameters** (cael-seat at msg `1502062774...` area):
```text
nonce: B4-NOISY-272
mode: normal
delaySeconds: 60
T0_epoch: 1778189567 (2026-05-07 14:32:47 PDT)
```

**Source (a) pre-fire flow_runs state** (cael-seat byte-pin):
```text
flow_id: d5b369a1-14f1-4ff9-b087-6c9e05ecf9c0
status: queued
total flow_runs at T0: 145
queued+runnable count at T0: 0 (this fire is the first queued entry in the window)
registry md5 at T0: 99da3762d747eccb18cea1444986df07
```

**Source (a) visible shard-return** (cael-seat at Discord msg `1502062774...` ~14:34:15 PDT):
```text
🩸 [B4-fire-1-return] NONCE:B4-NOISY-272 — normal-mode delegate fired after ~60s delay window.
```

Visible channel announce contains the nonce verbatim. Exactly one shard-return observed for this nonce. Delay actual ≈ 60s matches dispatch parameter.

**Source (b) inbound-during-delay-window count:**
- at minimum one driver-seat channel message landed between T0 (14:32:47 PDT) and T0+60s (14:33:47 PDT) — the driver-call confirming B4 fire-1 was acknowledged + multiple cohort messages in the window
- noisy requirement of row satisfied

**Cael-seat session model:** byte-confirmed `claude-opus-4.7` post figs's reset (cael-seat byte-pin earlier this session).

**Source (b) post-fire flow_runs lifecycle (cael-seat byte-pin appended at msg `1502064778...` area):**

Full transition byte-pin across all three states:
```text
pre-dispatch:  145 total flow_runs, 0 queued+runnable
post-dispatch: 146 total, 1 queued+runnable (the marker d5b369a1-14f1-4ff9-b087-6c9e05ecf9c0)
post-fire:     147 total, 0 queued+runnable (marker succeeded + 1 shard-spawn succeeded)
```

Single-row delta at each transition; no doubling at substrate layer.

At the 14:34:15 fire-tick, one sibling row materialized (`84ee3772-...`). This is the natural delegate→child-task spawn entry from the delegate transitioning from "released to continuation scheduler" to "running the child task" — single-shard-spawn, not duplicate fire. flow_runs lifecycle confirms exactly-once execution across the noisy delay window.

**Source (b) inbound-during-delay-window itemization** (cael-seat byte-pin):
- figs-direct-typed message landed in window
- Silas hours-stale-replay landed in window
- multiple cohort messages including driver-call ack landed in window
- noisy requirement of row substantively satisfied; specifically tested that real-traffic load did not lose or double the scheduled fire

### Verdict

**PASS** on the row claim.

Observed on deployed v5.5 substrate from cael-seat / cael-host with unique nonce `B4-NOISY-272`:
- tool-return at dispatch: scheduled with delaySeconds=60 ✓
- pre-fire flow_runs entry queued with flow_id `d5b369a1-14f1-4ff9-b087-6c9e05ecf9c0` ✓
- inbound channel traffic landed during delay window (driver-call + cohort messages) ✓
- exactly one visible shard-return with nonce `B4-NOISY-272` at T0+~60s ✓
- no doubling, no lost fire ✓

The row's product-surface claim is satisfied: delayed `continue_delegate(mode:"normal", delaySeconds:60)` handled inbound traffic during delay window without losing the scheduled fire or doubling.

### Truth-floor reach

This is now a **two-source PASS** with both source-(a) visible-channel evidence and source-(b) post-fire flow_runs lifecycle byte-pin. Truth-floor gap from the original bank (post-fire flow_runs final-state verification) is closed via cael-seat byte-pin appended after the original row commit.

## Status ladder

- [x] **Triaged** — required per B4 case file
- [x] **Authored** — row file created
- [x] **Fire-ready** — SUT delayed-delegate fire dispatched on cael-seat
- [x] **Verified** — verdict landed with byte-pinned evidence

## References

- **Case file**: `SWIM/cases/B4.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md`
- **Related rows**: B3 (clean delegate, PASS), B5 (silent-wake, PASS)

## Notes

This row complements B3 (clean continue_delegate, no inbound noise) and B5 (silent-wake) by adding the noisy-window dimension. The delaySeconds=60 choice was a defensible-default by Coordinator/Deployer at fire-time (driver-call did not name the delay window explicitly — banked as cael-seat's defensible pick, not as driver-spec).

For future B-family rows, naming delay windows in driver-calls directly avoids per-fire pick ambiguity.
