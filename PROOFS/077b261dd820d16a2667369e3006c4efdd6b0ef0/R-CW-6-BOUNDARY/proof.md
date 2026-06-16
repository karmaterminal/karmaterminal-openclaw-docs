# R-CW-6 — spawn-depth boundary reject (maxSpawnDepth=1)

**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed rune-seat) · **Prince**: 🪨 Rune
**Verdict**: ✅ PASS (boundary held, sessions_spawn culled at depth 1/1 this run + deployed-code byte-anchored) — with a full honest record of a mis-probe + correction

## What this proves
The `maxSpawnDepth=1` spawn-depth boundary is enforced on deployed `077b261dd8`: a `sessions_spawn` call from a caller already at depth 1 is forbidden with the verbatim runtime message.

## The honest journey (mis-probe → retraction → correct test → PASS)
**Attempt 1 (WRONG instrument, retracted):** I first fired `continue_delegate` from a `continue_delegate` and treated it as a depth-boundary probe. That was the wrong vehicle — `continue_delegate` chains are governed by `maxChainLength` (continuation chain-limit), NOT `maxSpawnDepth`. The depth-2 `continue_delegate` child RAN (correctly, chain not capped), and I initially mis-read that as "boundary held, no FAILED post." I caught the conflation when the child ran, retracted the PASS, and did NOT post the scripted "BOUNDARY FAILED" (it would have been a false alarm — nothing failed, I mis-probed). Lesson banked: chain-hop depth ≠ spawn depth; test the boundary with the tool it governs.

**Attempt 2 (CORRECT instrument, PASS):** the depth-1 continuation child then attempted the actual operation the boundary governs — `sessions_spawn` — and got the real cull:
```
sessions_spawn is not allowed at this depth (current depth: 1, max: 1)
```
This is the genuine `maxSpawnDepth=1` enforcement. The boundary HELD at the spawn layer.

## Deployed-code byte-anchor (`077b261dd8` build)
The enforcement is in the deployed dist:
```
// dist/plugin-sdk/src/config/agent-limits.d.ts
export declare const DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1;
// dist/acp-spawn-BrfhxFWf.js
const maxSpawnDepth = params.cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 1;
if (callerDepth >= maxSpawnDepth) return { error: `sessions_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})` };
```
maxSpawnDepth defaults to 1 (unset on rune-seat), and `callerDepth >= maxSpawnDepth` triggers the forbid — exactly the message captured live.

## The precise nuance (banked)
**`continue_delegate` chain-hop depth (`maxChainLength`) ≠ `sessions_spawn` spawn-depth (`maxSpawnDepth=1`)** — two SEPARATE limits, separate enforcement. A continuation chain-hop can keep a **depth-1 lane** alive past the spawn boundary's turn-count (turn 2/200 here), but it does NOT breach the spawn ceiling: `sessions_spawn` stays blocked at depth 1/1. So both are true and correct: the chain continued (chain-bounded), AND the spawn was culled (spawn-depth-bounded). Test the right boundary with the right tool.

## Verdict: PASS
Boundary enforced: `sessions_spawn` at depth 1/1 → forbidden (verbatim message, live this run + deployed-code byte-anchored). The full mis-probe→correction record is kept as the honest method (the byte over my own first reading).

## Tempo trace JSON (saved as files per the corpus mandate)
- `trace-159dc207-depth1-dispatch.json` (97625 bytes, host.name=rune) — the depth-1 delegate dispatch (`continue_delegate`, traceparent `00-159dc207e2597b46a92e9db9c843bdfa-...`)
- `trace-8201f306-depth2-probe.json` (84704 bytes, host.name=rune) — the depth-2 child probe dispatch (`continue_delegate` from the depth-1 delegate, traceparent `00-8201f306f88c0ed176e88c5cd67256e8-...`)

(The `sessions_spawn` cull byte itself is the runtime error-return `sessions_spawn is not allowed at this depth (current depth: 1, max: 1)` + the deployed-code anchor; the Tempo traces above capture the continue_delegate dispatch chain that set up the depth-1 lane. Traces fetched `curl tempo.dandelion.cult/api/traces/<id>` + committed as files — no tempo URL, per the clawsweeper-can't-reach-private-tempo mandate.)
