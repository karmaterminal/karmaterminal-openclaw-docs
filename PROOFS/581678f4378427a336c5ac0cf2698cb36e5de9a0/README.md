# PROOFS / 581678f4378427a336c5ac0cf2698cb36e5de9a0

Focused-proof corpus for the chosen **cure-(12)** ship SHA.

- **SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0`
- **PR**: openclaw/openclaw#79925
- **Build on elliott-seat**: `OpenClaw 2026.5.17 (581678f)`
- **Status snapshot**: `Context 145k/1.0m (15%)`, `Continuation chain 1/200 | volitional: 0`

## Elliott-seat state

- `T-2` ✅ landed from elliott-seat with fresh runtime receipt on the exact `581678f437` source tree
- `R-RC-1-addendum` 🟡 pending honest re-fire from a main-session wake above the 70% compaction gate

## Why R-RC-1-addendum is not claimed yet

This elliott-seat wake is currently **below** the ACCEPT threshold:

> `📚 Context: 145k/1.0m (15%)`

The addendum row is specifically an **ACCEPT-path** proof for `request_compaction` when `contextUsage > threshold`. Firing it now would only prove the REJECT path and would overclaim the assigned row. The row stays pending until elliott-seat is above threshold on a main-session turn.

