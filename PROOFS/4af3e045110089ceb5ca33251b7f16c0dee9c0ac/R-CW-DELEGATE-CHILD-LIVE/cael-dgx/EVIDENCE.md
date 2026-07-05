# R-CW-DELEGATE-CHILD-LIVE — child self-continuation live proof (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/213

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Seat: Cael / `cael-dgx`  
Verdict: ✅ PASS

## Expected byte lock

frond-scribe locked the row method and marker on docs#213 before fire:

```text
RCW_DELEGATE_CHILD_LIVE_BCA2B0B_CAEL_20260704_0719
```

Expected method:

1. Parent live Cael session fires `continue_delegate(mode="normal", fanoutMode="tree")` with the marker.
2. Child writes hop1 receipt before self-continuation.
3. Child schedules its own `continue_work(delaySeconds=5)` without `sessions_yield`.
4. Child continuation wake writes a separate hop2 receipt with `hop2-EXECUTED`.

Expected PASS byte: child-produced hop2 receipt after the child continuation wake. Parent delegate receipt alone is not sufficient.

## Fire / parent dispatch

Parent fired `continue_delegate(mode="normal", fanoutMode="tree")` carrying the marker and child instructions.

Parent/root trace saved as:

```text
PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-CW-DELEGATE-CHILD-LIVE/cael-dgx/tempo-trace-parent-delegate-e9e66ffebfa3f0acad6c53f6d9ddfd96.json
```

Relevant parent trace attributes:

```text
SPAN=continuation.delegate.dispatch
  delay.ms=0
  chain.step.remaining=198
  delegate.delivery=immediate
  chain.id=5e7d4ef1-ea42-495b-82b4-14445b146dd9
  delegate.mode=normal
  reason.present=true
  reason.length=1089
  reason.hash=382f593ef25ec120
  reason.redacted=
```

## Child hop1

Child session:

```text
agent:main:subagent:continuation-1e5c31ad4a0cee60278f1200706b0b3e
```

Hop1 receipt saved as `hop1.txt`:

```text
marker: RCW_DELEGATE_CHILD_LIVE_BCA2B0B_CAEL_20260704_0719
session_context: subagent depth 1/5; session agent:main:subagent:continuation-1e5c31ad4a0cee60278f1200706b0b3e; requester agent:main:discord:channel:1466192485440164011; continuation chain-hop turn 2/200; host cael
turn_context: first turn before continue_work
HOP1-WROTE-BEFORE-CONTINUE_WORK
```

The child then called `continue_work(delaySeconds=5, reason="R-CW-DELEGATE-CHILD-LIVE hop2 wake marker RCW_DELEGATE_CHILD_LIVE_BCA2B0B_CAEL_20260704_0719")` and did not call `sessions_yield`.

## Child continuation wake / hop2

Child wake metadata written by the child into `hop2.txt`:

```text
wake_metadata: continuation:wake Turn 1/200; chain started 2026-07-04T14:21:16.017Z; origin run continuation-delegate-1e5c31ad4a0cee60278f1200706b0b3e; origin turn 28335628-9400-4a8e-9d74-69570d44b1b0; due 2026-07-04T14:21:21.017Z; delivered 2026-07-04T14:21:21.037Z; disposition granted; chain 57553631-5d45-4aac-bb5e-fddcf31ca63d hop 1/200; flow 57553631-5d45-4aac-bb5e-fddcf31ca63d
hop2-EXECUTED after child continuation wake
```

Child work-fire trace saved as:

```text
PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-CW-DELEGATE-CHILD-LIVE/cael-dgx/tempo-trace-child-work-b8cffa7170fd298491edacb3c7ffd84d.json
```

Relevant child work-fire trace attributes:

```text
SPAN=continuation.work.fire
  chain.id=57553631-5d45-4aac-bb5e-fddcf31ca63d
  chain.step.remaining=199
  delay.ms=5000
  reason.present=true
  reason.length=92
  reason.hash=89302185867ecc3a
  reason.redacted=
```

## Verifier receipt

`verifier-receipt.txt` confirms:

```text
hop1_exists=yes
hop2_exists=yes
5:HOP1-WROTE-BEFORE-CONTINUE_WORK
4:hop2-EXECUTED after child continuation wake
```

## Supporting artifacts

- `hop1.txt` — child-produced pre-continuation receipt.
- `hop2.txt` — child-produced post-wake receipt.
- `verifier-receipt.txt` — marker/hop1/hop2 grep receipt.
- `flow-runs.json` — local durable flow-run receipts for parent check flow, child hop2 flow, and packaging follow-through flow.
- `28335628-9400-4a8e-9d74-69570d44b1b0-filtered.jsonl` — filtered child session transcript receipt.
- `28335628-9400-4a8e-9d74-69570d44b1b0.trajectory-filtered.jsonl` — filtered child trajectory receipt.
- `tempo-attribute-receipt.txt` — extracted Tempo span attributes for parent dispatch and child work fire.
- `journal-continuation-window.txt` — supporting gateway journal excerpt for the live window.
- `version-status.txt` — runtime version/status receipt.

## Verdict

✅ PASS — the normal delegate child executed hop1, scheduled its own `continue_work` without `sessions_yield`, received the child continuation wake, and wrote a child-produced `hop2-EXECUTED` receipt after that wake. Parent delegate dispatch alone was not used as the pass condition.
