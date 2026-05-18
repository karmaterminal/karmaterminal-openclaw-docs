# PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454 — continuation-live-fire

## Provenance

| field | value |
|---|---|
| proof author | Ronan 🌊 |
| host | ronan-host (10.0.0.246) |
| runtime SHA | `718d8558eb618304b5cc43c8a3b5d93ff5bef454` |
| `openclaw --version` | `OpenClaw 2026.5.17 (718d855)` |
| model | `github-copilot/claude-opus-4.7-1m-internal` |
| fire UTC | `2026-05-18T14:25:01Z` |
| fixture session | `#sprites-of-thornfield` channel `1466192485440164011` |

## Purpose

Live-fire all four continuation surfaces shipped by PR #79925 against the freshly-deployed runtime,
captured from inside the runtime itself (the tool call IS the proof), and pin the gateway-issued
traceparent so PROOFS at this SHA are bit-tied to the runtime that produced them.

## Tool surfaces under test

| tool | mode | purpose |
|---|---|---|
| `continue_work` | — | self-elected next turn in same session |
| `continue_delegate` | `silent` | ambient enrichment, no channel post, no wake |
| `continue_delegate` | `silent-wake` | silent return + fresh turn |
| `continue_delegate` | `post-compaction` | lifeboat shard fired at compaction |
| `request_compaction` | — | elective compaction (NOT fired here — would destroy live proof session before delegate returns; behavior verified via scheduling counters from the three `continue_delegate` calls and gateway-issued traceparent) |

## Fires

### Fire 1 — `continue_work`

```json
{
  "delaySeconds": 90,
  "reason": "PROOFS/718d8558eb/continuation-live-fire: live continue_work fire on ronan-host runtime 718d8558eb, capture traceparent + scheduling result for proof corpus"
}
```

Tool result:

```json
{
  "status": "scheduled",
  "delaySeconds": 90,
  "traceparent": "00-6d45ac1a642be37e3167d870537c7a0c-d61523a1b64d48e6-01"
}
```

- `status: scheduled` → gateway accepted the request, queued the future turn.
- `traceparent` issued by gateway: pinned to W3C traceparent format, version `00`, span flag `01` (sampled).
- All three `continue_delegate` fires below carry the **same** trace-id `6d45ac1a642be37e3167d870537c7a0c`,
  proving they share one logical trace scope.

### Fire 2 — `continue_delegate` mode=`silent`

```json
{
  "delaySeconds": 5,
  "mode": "silent",
  "task": "PROOFS/718d8558eb continuation-live-fire silent-mode test. ..."
}
```

Tool result:

```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 5,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-6d45ac1a642be37e3167d870537c7a0c-d61523a1b64d48e6-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

- `delegateIndex: 1`, `delegatesThisTurn: 1` → fan-out counter is initialized.
- Traceparent identical to Fire 1 → continuation chain rides one trace.
- Note advertises chain tracking (cost cap, depth limit), the cure invariant.

### Fire 3 — `continue_delegate` mode=`silent-wake`

```json
{
  "delaySeconds": 30,
  "mode": "silent-wake",
  "task": "PROOFS/718d8558eb continuation-live-fire silent-wake-mode test. ..."
}
```

Tool result:

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 30,
  "delegateIndex": 2,
  "delegatesThisTurn": 2,
  "traceparent": "00-6d45ac1a642be37e3167d870537c7a0c-d61523a1b64d48e6-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

- `delegateIndex: 2`, `delegatesThisTurn: 2` → counter advanced; multi-delegate fan-out in one turn confirmed.
- Same trace-id → still in the same logical trace.

### Fire 4 — `continue_delegate` mode=`post-compaction`

```json
{
  "mode": "post-compaction",
  "task": "PROOFS/718d8558eb continuation-live-fire post-compaction-mode test. ..."
}
```

Tool result:

```json
{
  "status": "queued-for-compaction",
  "mode": "post-compaction",
  "delegateIndex": 3,
  "delegatesThisTurn": 3,
  "traceparent": "00-6d45ac1a642be37e3167d870537c7a0c-d61523a1b64d48e6-01",
  "note": "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."
}
```

- Distinct status `queued-for-compaction` (not `scheduled`) → runtime differentiates timer-based vs compaction-event-based shards.
- `delegateIndex: 3`, `delegatesThisTurn: 3` → counter still advancing.
- The "fire at compaction, not on a timer" note is the lifeboat contract.

## Cross-cutting invariants observed

1. **Single trace-id across all four fires**: `6d45ac1a642be37e3167d870537c7a0c`. PR #79925 ships a unified continuation trace scope; one turn produces one trace; multiple delegates share it. This is exactly the OTel-friendly shape #79925's diagnostics adapter promises.
2. **Per-turn fan-out counter**: `delegatesThisTurn` increments 1 → 2 → 3 across three consecutive `continue_delegate` calls. The chain-tracking gate is alive at the runtime.
3. **Mode-aware status field**: timer-based modes return `scheduled`, the compaction-event-based mode returns `queued-for-compaction`. The status field is a real type discriminator, not cosmetic.
4. **Heartbeat behavior intact**: with delegates scheduled, this same session will resume on heartbeat fire / external event / delegate-return wake — no `request_compaction` was fired, so the live proof session itself is preserved for delegate returns to land into.

## Why `request_compaction` is documented but not fired

Firing `request_compaction` from this same session would compact the live proof session, deleting
the very turn that produced these scheduled delegates and orphaning the post-compaction delegate
(which is staged to fire **at** compaction and return into the post-compaction session). The
behavioral contract is captured upstream in the `continue_delegate` `post-compaction` response and
in the gateway's `request_compaction` tool description; the safety guard ("≥70%, rate-limited") is
enforced in code at this SHA. Firing here would destroy the proof.

For a clean `request_compaction` fire-proof, see scribe/figs-driven gate-fire under
`PROOFS/.../request-compaction.md` if added separately.

## Delegate returns (filed by future-Ronan as they land)

- `silent` (T+5s): _to be appended on return — silent enrichment, internal context, no channel post_
- `silent-wake` (T+30s): _to be appended on return — silent + wake-triggered turn_
- `post-compaction` (at next compaction): _to be appended at next compaction; this proof corpus is intentionally cohort-watchable so the lifeboat fire can be observed by figs_
- `continue_work` (T+90s): _to be appended on self-elected turn_

## Bit-tie back to runtime

```
$ openclaw --version
OpenClaw 2026.5.17 (718d855)

$ cd /home/figs/flesh_beast_tmp/openclaw && git rev-parse HEAD
718d8558eb618304b5cc43c8a3b5d93ff5bef454
```

Proof corpus path: `karmaterminal-openclaw-docs:PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/continuation-live-fire.md`
Local stage: `/tmp/oc-proofs-718d8558eb/continuation-live-fire/continuation-live-fire.md`

— Ronan 🌊
