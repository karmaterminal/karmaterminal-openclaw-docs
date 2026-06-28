# R-CD-CHAINED-DEPTH-2 TEST-2 / Ronan retry — inter-session targeted return

**Verdict:** ✅ PASS

**Assembly SHA under proof:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat:** `ronan-dgx` (host=ronan, aarch64)
**Runtime:** OpenClaw 2026.6.10 (`191a7af`)
**Captured:** 2026-06-27 21:22 PDT
**Nonce:** `RCDCHAIN2B-191a7af-20260627T2123PDT-ronan`

## Proof statement

TEST-2 pass: a depth-1 delegate fired a depth-2 `continue_delegate(mode="silent-wake")` with `targetSessionKeys=["agent:main:discord:channel:1466192485440164011"]`. The depth-2 leaf returned the nonce, and the gateway journal delivered the return directly to the explicit main Discord session.

This covers the inter-session targeted-return subtest for `R-CD-CHAINED-DEPTH-2` on the deployed `191a7af` runtime.

## Topology

```text
main channel session
  └─ depth-1 continuation-a321cecc5c4d954c3c7649e33448a596
       └─ depth-2 continuation-8458067c589001aeccff4dce5a327ec6
            └─ targeted return → agent:main:discord:channel:1466192485440164011
```

## Load-bearing bytes

Depth-1 scheduled the depth-2 leaf with `targetSessionKeys` only; no `fanoutMode`, no `targetSessionKey`, and no traceparent override:

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "targetSessionKeys": ["agent:main:discord:channel:1466192485440164011"],
  "traceparent": "00-55555555555555555555555555555555-4f023268e89b1d1f-01"
}
```

Depth-2 returned the expected nonce:

```text
DEPTH2-CHAIN2B-DONE RCDCHAIN2B-191a7af-20260627T2123PDT-ronan
```

Gateway journal confirmed explicit targeted return to the main session:

```text
[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-8458067c589001aeccff4dce5a327ec6
```

## Honest limits

The earlier same-night Chain-2 attempt is intentionally not counted: its depth-1 child polluted args by combining `fanoutMode` with `targetSessionKeys`, and the runtime correctly rejected it. This retry is the counted artifact.

## Files

- `session-history-excerpt.md` — sanitized depth-1/depth-2 transcript excerpt.
- `journal-chain2b.log` — gateway journal slice for Chain-2B.
- `artifacts/trace-55555555555555555555555555555555-chain2b.json` — Tempo trace export for Chain-2B targeted-return (resource attrs `host.id`, `process.pid`, `process.executable.{name,path}`, `process.command_args`, `process.command`, `process.owner` redacted; span hierarchy, model, and tool attrs preserved).
