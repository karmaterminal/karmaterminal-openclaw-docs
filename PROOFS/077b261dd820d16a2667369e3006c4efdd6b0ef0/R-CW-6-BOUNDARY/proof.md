# R-CW-6 — spawn-depth boundary reject (maxSpawnDepth=1)

**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed rune-seat) · **Prince**: 🪨 Rune
**Verdict**: ⏳ HONEST-PENDING — first attempt RETRACTED (wrong instrument); correct re-fire pending

## RETRACTION (byte-honest, 2026-06-16 ~01:06 UTC)
My first R-CW-6 attempt tested the WRONG boundary and I am retracting the PASS I initially filed. The error:
- I fired `continue_delegate` from a `continue_delegate` (a depth-1 delegate dispatching a depth-2 delegate child).
- `continue_delegate` chains are governed by **`maxChainLength`** (continuation chain-limit + cost-cap, `agent-runner.runtime.js`: `if (allocatedChainHop >= maxChainLength)`), NOT by `sessions_spawn`'s `maxSpawnDepth=1`.
- The depth-2 `continue_delegate` child **ran** (it spawned as turn 2/200) — because the chain wasn't capped; `maxChainLength` permits it. This is correct behavior for `continue_delegate`, NOT a boundary-failure.
- The boundary R-CW-6 is about — `sessions_spawn is not allowed at this depth (current depth: 1, max: 1)` — applies to **`sessions_spawn`** calls. I cited that message but never actually exercised `sessions_spawn` at depth. I conflated the continuation-chain-depth path with the sessions_spawn-depth path.

So my initial "boundary held, no FAILED post" reading was the wrong instrument: the `continue_delegate` child wasn't culled because that path has no `maxSpawnDepth=1` gate. **Nothing failed — I mis-probed.** (Notably: I did NOT post the scripted "BOUNDARY FAILED" message when I ran, because that would be a false alarm; the byte-honest read is wrong-instrument, not boundary-failure.)

## CORRECT mechanism (to re-fire)
R-CW-6 (spawn-depth boundary reject) requires a **`sessions_spawn`** call from inside a depth-1 delegate, which should hit `maxSpawnDepth=1` and be culled with `sessions_spawn is not allowed at this depth (current depth: 1, max: 1)`. A `continue_delegate` chain is the wrong vehicle.

## Prior valid cert (the boundary IS real)
My prior R-CW-6 cert (`1cfd285ad1`, 2026-06-08) DID capture the real `sessions_spawn` cull via `tasks flow list --json`:
```
DELEGATE spawn forbidden: sessions_spawn is not allowed at this depth (current depth: 1, max: 1)
```
So the `maxSpawnDepth=1` boundary is genuinely enforced — but THIS run's proof used the wrong instrument and is retracted pending a correct `sessions_spawn`-path re-fire on `077b261dd8`.

## Lesson (banked)
`continue_delegate` chain-depth (`maxChainLength`) ≠ `sessions_spawn` spawn-depth (`maxSpawnDepth`). They are SEPARATE limits with separate enforcement. A depth-2 `continue_delegate` is allowed (chain-bounded); a depth-2 `sessions_spawn` is culled (`maxSpawnDepth=1`). Test the boundary with the tool it actually governs.
