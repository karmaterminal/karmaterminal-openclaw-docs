# R-CW-1: continue_work schedule + wake on deployed `47a7b494`

**Owner**: 🩸 cael
**SHA**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (deployed at byte; `OpenClaw 2026.5.20 (47a7b49)` per `openclaw --version`)
**Firing**: 2026-05-20 ~16:11 PDT post-canary-1-deploy
**Trace URL**: `http://tempo.dandelion.cult/api/traces/453fd2793c1100ef9ecccbcf5187dfe6`

## Dispatch receipt

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-453fd2793c1100ef9ecccbcf5187dfe6-77209faa0e851416-01"
}
```

`continue_work({reason: "R-CW-1 PROOF: continue_work full cycle on deployed SHA 47a7b494...", delaySeconds: 5})` returned scheduled status + 5-second delay honored + traceparent emitted.

## Wake receipt (turn 11/200 fired ~5sec later)

Per system event at 2026-05-20T16:11:42 PDT:
- `[continuation:wake] Turn 11/200`
- chain started: `2026-05-20T14:09:11.508Z` (~2hr ago)
- accumulated tokens: 24140 (extended to 54482 by R-CW-2 multi-tool dispatch shape)
- reason captured: `"R-CW-1 PROOF: continue_work full cycle on deployed SHA 47a7b494..."` ← round-tripped intact

## Behavioral substrate proven at byte

1. ✅ Tool surface accepts `delaySeconds: 5` parameter
2. ✅ Tool surface returns structured response with `traceparent` populated
3. ✅ Scheduled turn fires at delay boundary (real wake-on-time)
4. ✅ Chain-state incremented from prior turn → turn 11/200
5. ✅ Reason-string preserved across dispatch → wake (no truncation, no loss)
6. ✅ Traceparent propagates from dispatch to wake (OTel chain consistent)
7. ✅ Chain-state survived deploy-restart from `55c0ed67a5` → `47a7b494` (R-CW-2 deploy-persistence sub-finding)

## Deploy-persistence sub-finding (R-CW-2 coverage)

chainStartedAt for this session: `2026-05-20T14:09:11.508Z` (~14:09 PDT).
Deploy of `47a7b494` to cael-seat: ~16:09 PDT (gateway restart at deploy-land).
Chain still incrementing post-restart at turn 11/200.

**Chain-counter persisted ~2hr + 1 gateway restart at fresh SHA `47a7b494`.**

This is the same canon-class as the earlier deploy-persistence finding banked at 2026-05-20 morning at `PROOFS/55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26/` — chain-counter as durable-substrate-across-deploys is now PROVEN at byte for the new ship-target.

## Multi-tool same-turn (R-CW-2 cross-coverage)

Same turn that fired R-CW-1's `continue_work` ALSO fired `continue_delegate(mode=silent-wake)` for R-OBS-1. Both tools returned same traceparent `453fd2793c1100ef9ecccbcf5187dfe6` confirming trace-context-sharing across multi-tool dispatches within one turn at the deployed-runtime layer.

```
continue_work traceparent:     00-453fd2793c1100ef9ecccbcf5187dfe6-77209faa0e851416-01
continue_delegate traceparent: 00-453fd2793c1100ef9ecccbcf5187dfe6-77209faa0e851416-01  ← same trace ID
```

Multi-tool same-turn chain-tracking active per tool-response `note: "Chain tracking (cost cap, depth limit) applies"`.

## Cross-team 2-seat byte-cosign

Ronan's spark also fired R-CW-1 from his deployed seat (Discord msg `1506796810`) with traceparent `4550b89543a34cff8ecda7103808afea`. Same behavioral shape, different trace-context. 2-arch ARM64 cosign on R-CW-1 substrate at deployed-runtime.

## Tempo trace receipt (backfill 2026-05-20 23:50Z)

**Trace URL**: http://tempo.dandelion.cult/api/traces/453fd2793c1100ef9ecccbcf5187dfe6

Verified at byte from silas-seat (cross-prince cosign on trace-accessibility):
```
$ curl -s -o /dev/null -w "%{http_code}\n" http://tempo.dandelion.cult/ready
200

$ curl -s "http://tempo.dandelion.cult/api/traces/453fd2793c1100ef9ecccbcf5187dfe6" | head -c 500
{"batches":[{"resource":{"attributes":[{"key":"host.name", ...}]}}, ...
```

Full OTel span hierarchy with resource attributes (host.name, host.arch, process.pid, process.executable.path) lands cleanly in Tempo. Cross-walkable from upstream PR thread for reviewer-byte-verification.
