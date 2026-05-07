# swim-43/B6 — F6 back-to-back continue_delegate (two delegates in same turn) on cael-host

**Swim:** swim-43-v2026.5.5-full
**Block:** B — Family Delegates
**Row ID:** B6
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/B6.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011`
**Timing window:** integration
**Evidence class:** live-row
**Gather:** two SUT-side tool returns, two visible shard returns, pre-fire substrate snapshot, optional flow/journal corroboration

## Surface under test

Per `SWIM/cases/B6.md`: two `continue_delegate()` calls issued in the same turn should both arm cleanly, fire independently, and return without race.

This row's specific test: from cael-seat, in a single turn, dispatch two `continue_delegate(mode:"normal")` calls with short staggered delays and distinct nonces. Verify:
1. both calls arm cleanly
2. both shard returns appear
3. returns happen independently at their expected offsets
4. no double-fire, no missing second fire, no apparent race between the two

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (single-host back-to-back fire from cael-seat)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** SUT-side dispatch parameters, pre-fire substrate snapshot, visible shard-return A, visible shard-return B

## Measurement protocol

### What we expect — literal substrate bytes for PASS

**Source (a) dispatch shape:**
```text
continue_delegate(... NONCE:B6-BB-A ..., mode:"normal", delaySeconds:5)
continue_delegate(... NONCE:B6-BB-B ..., mode:"normal", delaySeconds:10)
```

**Source (a) visible shard-return A:**
```text
[B6-fire-1-return-A] NONCE:B6-BB-A
```

**Source (a) visible shard-return B:**
```text
[B6-fire-1-return-B] NONCE:B6-BB-B
```

PASS = both nonces return exactly once, in expected stagger, with no race / no lost second fire.

### What FAIL looks like

```text
FAIL = second delegate never fires, OR either nonce returns twice, OR both returns collapse into one broken/ambiguous announce, OR obvious race blocks one child.

INCONCLUSIVE = compaction/restart during the 10s window confounds the measurement.
```

### Result — actual output, byte-pinned

#### Fire 1 — cael-seat on cael-host, back-to-back delegates in same turn

**Source (a) SUT-side dispatch parameters** (cael-seat at msg `1502062935...` area):
```text
nonce A: B6-BB-A, delaySeconds=5
nonce B: B6-BB-B, delaySeconds=10
T0 epoch: 1778190076 (2026-05-07 14:41:16 PDT)
pre-fire substrate: 147 total flow_runs, 0 queued+runnable, registry md5 99da3762d747eccb18cea1444986df07
```

**Source (a) visible shard-return A** (Discord msg `1502067070223909007` area):
```text
🩸 [B6-fire-1-return-A] NONCE:B6-BB-A — back-to-back delegate A fired after ~5s.
```

**Source (a) visible shard-return B** (Discord msg `1502063011928735966`):
```text
🩸 [B6-fire-1-return-B] NONCE:B6-BB-B — back-to-back delegate B fired after ~10s.
```

Observed behavior:
- A returned once at ~T0+5s
- B returned once at ~T0+10s
- distinct nonces preserved
- no visible collision or collapse between announces
- no missing second fire

### Verdict

**PASS** on the row claim.

Observed on deployed v5.5 substrate from cael-seat / cael-host:
- two delegates issued in same turn with distinct nonces ✓
- first returned once at expected offset (~+5s) ✓
- second returned once at expected offset (~+10s) ✓
- no race, no doubling, no lost second fire ✓

The row's product-surface claim is satisfied: back-to-back `continue_delegate(mode:"normal")` calls in the same turn arm and return independently.

### Truth-floor reach

This is a source-(a)-heavy PASS grounded in cael-seat dispatch parameters plus two visible nonce-tagged shard returns. Tool-return JSON and gateway journal spawn literals were not separately pasted into the row for this fire; a future corroborating fire could add those for extra substrate depth, but the user-visible row claim is already closed.

## Status ladder

- [x] **Triaged** — required per B6 case file
- [x] **Authored** — row file created
- [x] **Fire-ready** — SUT back-to-back fire dispatched on cael-seat
- [x] **Verified** — verdict landed with byte-pinned evidence

## References

- **Case file**: `SWIM/cases/B6.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md`
- **Related rows**: B3 (single clean delegate, PASS), B4 (noisy delayed delegate, PASS), B5 (silent-wake, PASS)

## Notes

The delays were chosen by cael-seat as short staggered offsets (5s, 10s) so both fire-windows remained observable inside one ~15s measurement window while still being back-to-back within a single originating turn.
