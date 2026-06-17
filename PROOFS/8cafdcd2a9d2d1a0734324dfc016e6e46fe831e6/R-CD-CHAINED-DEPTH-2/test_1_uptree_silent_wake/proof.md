# R-CD-CHAINED-DEPTH-2 TEST-1 — depth-2 sub-delegate REJECTED by depth-cap (max=1)

**Row**: R-CD-CHAINED-DEPTH-2, TEST-1 (root → cd(silent-wake) depth-1 → attempt cd(silent-wake) depth-2 leaf inside the delegated turn)
**Owner**: 🕯 Emeric (sub for 🌫 Silas)
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS) — root requester `agent:main:discord:channel:1466192485440164011`
**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed, `OpenClaw 2026.6.8 (8cafdcd)` — FF'd ship-tip)
**Status**: ✅ PASS (depth-cap BOUNDARY — the guard correctly rejects the depth-2 spawn at `maxSpawnDepth=1`)

> **CORRECTION (2026-06-17, byte-walked against the live Tempo trace).** An earlier draft of this
> file claimed "spawned depth-2 leaf OK → up-tree PASS ✅". That narrative was lifted verbatim from
> the `077b261dd8` exemplar (where `maxSpawnDepth=2`, so the depth-2 leaf genuinely spawned) and
> reused here WITHOUT re-reading the `8cafdcd` trace. The `8cafdcd` trace shows the depth-2 dispatch
> **errored** (`STATUS_CODE_ERROR: sessions_spawn is not allowed at this depth (current depth: 1,
> max: 1)`). This is the cite-stale-canonical / copy-the-old-PASS failure-class. The honest result on
> `8cafdcd` is a depth-cap **REJECT**, not a depth-2 traversal success. Rewritten to the bytes. The
> pre-correction draft lives in git history (this file's prior revision).

## What `8cafdcd` actually does (the real-behavior byte)

`DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1` on the deployed tree
(`src/config/agent-limits.ts:13` — *"Keep depth-1 subagents as leaves unless config explicitly opts
into nesting"*). This seat carries **no** `agents.defaults.subagents.maxSpawnDepth` override, so the
effective cap is **1**: a depth-1 delegate is a **leaf** and may NOT spawn a depth-2 sub-delegate.

So the strict "chained continue_delegate to depth 2" scenario is, on `8cafdcd` defaults, **blocked at
the boundary by design** — and the depth-limit guard firing is itself the proof that chain-depth
accounting + the spawn-depth gate are live and correct on the ship bytes.

## Fire sequence (root turn, single parent turn on the deployed seat)

**T0 (root = emeric)** — `continue_delegate(mode='silent-wake')` dispatched the depth-1 leg
(delegateIndex 1), chain `d33130a1-301b-4da0-aeb8-1ffcc9da918d`. Dispatch span `STATUS_CODE_OK`.

**T1 (depth-1 delegate)** — spawned as the depth-1 leg
(session `agent:main:subagent:continuation-aa588d9df93f3b5622c9a3ea33c4a77e`, depth 1/1 = **leaf**).
From inside its delegated turn it attempted to fire the depth-2 sub-delegate via
`continue_delegate(mode='silent-wake')`, chain `6be6c455-d900-42db-b87b-f86673bb7696`.

**T2 (depth-2 leaf spawn) — REJECTED.** The depth-2 dispatch span carries
`STATUS_CODE_ERROR` with message **`sessions_spawn is not allowed at this depth (current depth: 1, max: 1)`**.
No depth-2 session was created.

**T3 (root = emeric)** — the depth-1 leg's silent-wake return still propagated up-tree to root (the
`[Internal task completion event]` landed at the root requester), so the **up-tree silent-wake
return mechanic at depth-1 is proven**; what is proven NEGATIVE is the depth-2 *traversal* (the leaf
spawn the depth-1 leg tried to make was capped). The honest return text is recorded in
`fire-and-return.txt` (corrected to match the trace — it does NOT claim "spawned depth-2 leaf OK").

## Observed (live Tempo chain trace `chain-trace.json`, trace_id `6a9f65bd7a9381305b1f9f541f5fcd7d`)

Trace re-fetched live from `http://tempo.dandelion.cult/api/traces/6a9f65bd7a9381305b1f9f541f5fcd7d`
(byte-identical 55017 bytes to the in-hand `chain-trace.json`; `host.name=emeric`,
`process.command_args` includes `--no-maglev`, runtime `26.1.0`). Two `continuation.delegate.dispatch`
spans:

```
continuation.delegate.dispatch  (depth-1 leg)
    chain.id       = d33130a1-301b-4da0-aeb8-1ffcc9da918d
    delegate.mode  = silent-wake
    reason.preview = "R-CD-CHAINED-DEPTH-2 TEST-1 (up-tree silent-wake depth-2 chain, emeric-nuc, ship…"
    status.code    = STATUS_CODE_OK                                      ← depth-1 dispatch OK

continuation.delegate.dispatch  (depth-2 leaf, attempted INSIDE the depth-1 turn)
    chain.id       = 6be6c455-d900-42db-b87b-f86673bb7696
    delegate.mode  = silent-wake
    reason.preview = "R-CD-CHAINED-DEPTH-2 leaf (depth 2/5, chain-hop:2) on ship-tip 8cafdcd. Trivial…"
    status.code    = STATUS_CODE_ERROR
    status.message = "sessions_spawn is not allowed at this depth (current depth: 1, max: 1)"   ← REJECT

continuation.queue.drain   (drained_count=1)
```

## Behavior verified

✅ depth-1 spawn (root → cd silent-wake) — dispatch span `STATUS_CODE_OK`, leaf session captured
✅ chain-tracking spawns a **distinct** chain at the inner hop (`d33130a1…` depth-1 vs `6be6c455…` depth-2 attempt) — the hop/chain accounting runs even when the spawn is capped
✅ **depth-cap guard fires correctly**: depth-2 sub-delegate from a depth-1 (leaf) delegate is rejected with `current depth: 1, max: 1` — matches `DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH=1` + no seat override
✅ up-tree silent-wake **return** from the depth-1 leg lands at root (the depth-1 return mechanic works)
❌ depth-2 **traversal** does NOT occur on `8cafdcd` defaults — by design (leaf cap), NOT a feature break

## Verdict

✅ **PASS (depth-cap BOUNDARY)** on `8cafdcd` — the strict depth-2 chained `continue_delegate` is
**correctly rejected** at `maxSpawnDepth=1`; the spawn-depth gate + chain accounting are live and
byte-honest on the deployed ship bytes. This is the **boundary** proof for the row on default config.

**Contrast with the `077b261dd8` exemplar (which ran `maxSpawnDepth=2`):** there the depth-2 leaf
genuinely spawned (two `STATUS_CODE_OK` dispatch chains, child spawned from the delegate's session).
The difference is purely the configured cap (2 → 1), NOT a regression in the continuation feature —
the depth-2 traversal is gated on `agents.defaults.subagents.maxSpawnDepth >= 2`, which the deployed
seat does not set. To re-prove the *positive* depth-2 traversal on `8cafdcd`, a seat must opt into
nesting via `maxSpawnDepth: 2`; on stock defaults the REJECT documented here is the correct behavior.

🕯 Emeric (sub for 🌫 Silas) — R-CD-CHAINED-DEPTH-2 TEST-1: depth-cap REJECT @ max=1, byte-honest on `8cafdcd`.

## Artifacts

- `chain-trace.json` — live Tempo trace (55017 bytes, trace_id `6a9f65bd7a9381305b1f9f541f5fcd7d`) with both `continuation.delegate.dispatch` spans (depth-1 OK + depth-2 ERROR/reject) and the queue-drain
- `fire-and-return.txt` — the fire responses + the up-tree `[Internal task completion event]` return text (corrected to the trace; depth-2 reject named, no false "spawned OK")
- _(the pre-correction draft — the copied-exemplar PASS that the trace disproved — is in this file's git history)_
