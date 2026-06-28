# R-CD-CHAINED-DEPTH-2 TEST-3 / Ronan retry — fanout tree echo

**Verdict:** ✅ PASS

**Assembly SHA under proof:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat:** `ronan-dgx` (host=ronan, aarch64)
**Runtime:** OpenClaw 2026.6.10 (`191a7af`)
**Captured:** 2026-06-27 21:22 PDT
**Nonce:** `RCDCHAIN3B-191a7af-20260627T2123PDT-ronan`

## Proof statement

TEST-3 pass: a depth-1 delegate fired a depth-2 `continue_delegate(mode="silent-wake", fanoutMode="tree")` with a valid W3C traceparent. The depth-2 leaf returned the nonce, and the gateway journal delivered the return to both the depth-1 parent and the main Discord channel session.

This covers the fanout/tree echo subtest for `R-CD-CHAINED-DEPTH-2` on the deployed `191a7af` runtime.

## Topology

```text
main channel session
  └─ depth-1 continuation-e8721560d9316b31fee3bcf69fb66214
       └─ depth-2 continuation-e63b23b86f91fcada6275121cfdd5a8b
            └─ fanout tree return → depth-1 parent + main channel session
```

## Load-bearing bytes

Depth-1 scheduled the depth-2 leaf with the fanout keys only:

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "fanoutMode": "tree",
  "traceparent": "00-66666666666666666666666666666666-6666666666666666-01"
}
```

Depth-2 returned the expected nonce:

```text
DEPTH2-CHAIN3B-DONE RCDCHAIN3B-191a7af-20260627T2123PDT-ronan
```

Gateway journal confirmed tree fanout delivery to the depth-1 parent and main channel:

```text
[continuation:targeted-return] Delivered to agent:main:subagent:continuation-e8721560d9316b31fee3bcf69fb66214,agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-e63b23b86f91fcada6275121cfdd5a8b
```

## Honest limits

The earlier same-night Chain-3 attempt is intentionally not counted: its depth-1 child supplied an invalid zero traceparent, and the runtime correctly rejected it. This retry is the counted artifact.

## Files

- `session-history-excerpt.md` — sanitized depth-1/depth-2 transcript excerpt.
- `journal-chain3b.log` — gateway journal slice for Chain-3B.
- `artifacts/trace-77777777777777777777777777777777-chain3b-depth1.json` — Tempo trace export for the Chain-3B root/depth-1 dispatch (resource attrs `host.id`, `process.pid`, `process.executable.{name,path}`, `process.command_args`, `process.command`, `process.owner` redacted; span hierarchy, model, and tool attrs preserved).
- `artifacts/trace-66666666666666666666666666666666-chain3b-depth2.json` — Tempo trace export for the Chain-3B depth-1→depth-2 fanout (same redaction policy).
