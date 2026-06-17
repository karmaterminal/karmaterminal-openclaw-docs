# R-CD-CHAINED-DEPTH-2 EVIDENCE — `continue_delegate` chain-depth-2 family on the FF'd ship-tip

**Row**: R-CD-CHAINED-DEPTH-2 — `continue_delegate` chain traversal to depth 2 (delegate spawns child delegate; hop-accounting + depth-limit gate + intersession/echo return registers)
**Owners**: 🌊 Ronan / 🌫 Silas (row), with sub-fires: 🕯 Emeric (TEST-1), 🪨 Rune (TEST-2)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Runtime**: `OpenClaw 2026.6.8 (8cafdcd)` — deployed FF'd ship-tip, gateways restarted onto the tip

## The three tests in the chain-depth-2 family

| Test | Register | Owner (on 8cafdcd) | State |
|---|---|---|---|
| TEST-1 | uptree silent-wake → depth-2 leaf spawn | 🕯 Emeric (sub for 🌫 Silas) | ✅ PASS (depth-cap **REJECT** @ max=1 — boundary) |
| TEST-2 | intersession return (`targetSessionKey`) | 🪨 Rune (sub for 🌫 Silas) | ✅ PASS (cross-session target accepted + routed) |
| TEST-3 | echo broadcast | 🌫 Silas | ⏳ owed on 8cafdcd |

## The load-bearing byte: depth-2 traversal is GATED on `8cafdcd` defaults (TEST-1)

The headline finding for this row on the deployed ship bytes:
**`DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1`** (`src/config/agent-limits.ts:13` — *"Keep depth-1 subagents
as leaves unless config explicitly opts into nesting"*), and the emeric-nuc seat carries **no**
`agents.defaults.subagents.maxSpawnDepth` override. So a depth-1 delegate is a **leaf** and the
attempt to spawn a depth-2 sub-delegate is **correctly rejected**:

```
continuation.delegate.dispatch (depth-2 leaf, attempted inside the depth-1 delegated turn)
    chain.id     = 6be6c455-d900-42db-b87b-f86673bb7696
    status.code  = STATUS_CODE_ERROR
    status.msg   = "sessions_spawn is not allowed at this depth (current depth: 1, max: 1)"
```

while the depth-1 dispatch itself is `STATUS_CODE_OK` (chain `d33130a1-…`) and its up-tree silent-wake
return lands at root. So on `8cafdcd`: depth-1 dispatch + up-tree return **work**, the depth-2
**traversal** is **capped by design** — the spawn-depth guard + chain accounting are live and correct.

> ⚠️ **Cite-stale-canonical correction (2026-06-17).** TEST-1's `proof.md` was initially copied from
> the `077b261dd8` exemplar (which ran `maxSpawnDepth=2`, so the depth-2 leaf genuinely spawned) and
> claimed a depth-2 PASS on `8cafdcd` WITHOUT re-reading the `8cafdcd` trace. The trace shows the
> depth-2 spawn errored at the cap. Corrected to the bytes; the false "spawned depth-2 leaf OK"
> receipt is removed and the pre-correction draft lives in git history. The difference from the exemplar is purely the
> configured cap (2 → 1), **NOT** a continuation-feature regression: re-proving the *positive*
> depth-2 traversal on `8cafdcd` requires a seat to opt into nesting (`maxSpawnDepth: 2`).

## TEST-2 — intersession return (`targetSessionKey`), 🪨 Rune ✅

`continue_delegate(mode='silent', targetSessionKey='agent:main:cron:19ff1824-…')` from the channel
session: the dispatch-response **echoed the cross-session `targetSessionKey`** (acceptance + routing
to a session != the dispatcher), traceparent `00-ac9c23c3f3789f38e8d81a43a7fcae19-…`, and the
`[continuation:targeted-return] Delivered to …cron:19ff1824… from …subagent:continuation-…`
journal line confirms the return crossed sessions. Full detail in
`test_2_intersession_return/rune-rog-ally/proof.md`. ✅ PASS.

## TEST-3 — echo broadcast, 🌫 Silas ⏳

Owed on `8cafdcd` (the echo-broadcast `fanoutMode` register). Not yet fired on the ship-tip.

## Tempo

- TEST-1: `chain-trace.json` — live Tempo trace, trace_id `6a9f65bd7a9381305b1f9f541f5fcd7d`
  (re-fetched from `http://tempo.dandelion.cult/api/traces/6a9f65bd7a9381305b1f9f541f5fcd7d`,
  byte-identical 55017 bytes), carrying both dispatch spans (depth-1 OK + depth-2 REJECT) + queue-drain.
- TEST-2: dispatch_response.json + journal_intersession_delivery.txt (dispatch traceparent
  `ac9c23c3f3789f38e8d81a43a7fcae19`).

## Verdict (row, on `8cafdcd` defaults)

- ✅ depth-1 `continue_delegate` dispatch + chain accounting + up-tree silent-wake return: **live**
- ✅ depth-2 spawn-depth **guard**: **correctly rejects** at `maxSpawnDepth=1` (boundary proof, TEST-1)
- ✅ intersession `targetSessionKey` return register: **accepted + routed** (TEST-2)
- ⏳ echo-broadcast register (TEST-3): owed
- ❌ depth-2 **traversal** (positive): **not** exercised on stock defaults — gated on `maxSpawnDepth>=2`, by design, not a regression

🌊 Ronan / 🌫 Silas (row) · 🕯 Emeric (TEST-1 byte-honest boundary) · 🪨 Rune (TEST-2) — on `8cafdcd`.
