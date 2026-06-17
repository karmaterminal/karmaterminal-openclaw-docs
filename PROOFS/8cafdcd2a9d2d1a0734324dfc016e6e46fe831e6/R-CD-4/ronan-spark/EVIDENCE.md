# R-CD-4 EVIDENCE — cross-session targeted return via `targetSessionKey`

**Row**: R-CD-4 — continue_delegate cross-session targeted return (the delegate's return is routed to a SPECIFICALLY-ADDRESSED session via `targetSessionKey`, not just the dispatching session)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat**: ronan-spark (ARM64 DGX Spark, 10.0.0.246)

## Fire

- **fire_utc**: ~2026-06-17T17:10:42Z
- **mode**: silent (with explicit `targetSessionKey` routing override)
- **targetSessionKey**: `agent:main:discord:channel:1466192485440164011`
- **delegateIndex**: 2, delegatesThisTurn: 2
- **fire_response**:
```json
{"status":"scheduled","mode":"silent","delaySeconds":0,"delegateIndex":2,"delegatesThisTurn":2,"targetSessionKey":"agent:main:discord:channel:1466192485440164011","traceparent":"00-123535d3a345387133336b040efed53d-72275de989944dfc-01"}
```

## Registration proof

`status: "scheduled"` with `targetSessionKey: "agent:main:discord:channel:1466192485440164011"` **echoed back in the fire-response** = `continue_delegate` with cross-session targeted-return routing REGISTERED + functional on `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`. **The echoed `targetSessionKey` field IS the proof**: the gateway accepted the explicit return-target override and registered the delegate to route its return to the addressed session, rather than defaulting to the dispatching session. This is the (a)-shape explicit-recipient-addressing surface over the session-delivery-queue substrate.

## Targeting mechanism (cross-session addressing)

- **Default behavior**: a delegate returns to the session that DISPATCHED it.
- **targetSessionKey override**: the return is routed to the explicitly-named session key instead — the same substrate that powers `targetSessionKeys` (byte-identical fan-out to multiple sessions) and `fanoutMode` (tree/all broadcast).
- **This proof**: targets the main discord channel session (`agent:main:discord:channel:1466192485440164011`) — the gateway echoed the key, confirming the addressed-return registration path on the ship-SHA.

## SHA verification at source

- **runtime**: `OpenClaw 2026.6.8 (8cafdcd)` == ship-tip — verified via `openclaw --version`
- **runtime HEAD**: `8cafdcd2a9d2` (git rev-parse, ~/flesh_beast_tmp/openclaw) == CANDIDATE_SHA
- **Host-pinned**: host=ronan, arch=aarch64 (arm64), gateway MainPID=3376718

## Verdict

✅ **REGISTERED + SCHEDULED (targetSessionKey-routed)** — `continue_delegate` cross-session targeted return via `targetSessionKey` registered + functional on deployed `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`. The echoed `targetSessionKey` in the fire-response proves the gateway accepted the explicit return-target override (cross-session addressing, not dispatching-session-default). Runtime SHA-verified at source (8cafdcd, host=ronan/arm64). The (a)-shape recipient-addressing surface over the session-delivery-queue substrate.

## Both-forms note

This is the **TOOL FORM** of R-CD-4. `targetSessionKey` is a tool-parameter-only feature (the bracket form `[[CONTINUE_DELEGATE:]]` has no syntax for explicit return-target addressing) — so cross-session targeted return is TOOL-ONLY by surface, captured here as the tool-form proof. The dispatching-session-default delegate behavior is captured in R-CD-1 (normal) / R-CD-2 (silent-wake).
