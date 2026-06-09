# R-CW-6 — Evidence (continuation depth-boundary, live cert on `e66dc63`)

**Row**: R-CW-6 (continuation boundary — spawn-depth boundary)
**Prince**: 🪨 Rune (rune-seat, host `rune`)
**SHA tested**: `7992640e60` (live runtime `OpenClaw 2026.6.2 (e66dc63)`)
**Date fired**: 2026-06-08 07:50–07:51 PDT (14:50–14:51 UTC)
**Verdict**: ✅ PASS (boundary enforced at dispatch) — with honest scope-notes below

## What this row proves

The continuation **spawn-depth boundary** is enforced. rune-seat has `subagents.maxSpawnDepth` unset → code-default **1** (`config/agent-limits.ts:13 DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1`, resolved at `acp-spawn.ts:843-844`). A depth-1 delegate attempting to spawn a depth-2 child should hit the boundary. This row certifies the boundary holds — and pins WHERE it's enforced (dispatch-time, not call-time).

## Mechanic + the two-layer boundary byte

1. Parent (🪨 rune main) dispatched a depth-1 delegate via `continue_delegate(...)` (`runId` per chain-hop:7; the row's own delegate)
2. **STEP-1**: delegate posted announce (`1513555925`) — "depth-1 delegate live, attempting to spawn a depth-2 child to test the maxSpawnDepth=1 boundary"
3. **STEP-2 (the boundary probe)**: delegate called `continue_delegate(...)` to spawn a depth-2 child. **Call-time literal byte: `status=scheduled`** (`delegateIndex=1`, note "Chain tracking (cost cap, depth limit) applies"). The API surface ACCEPTS the spawn request — it does NOT inline-reject at call-time. Depth-enforcement is deferred to dispatch-time (after the response completes).
4. **STEP-3**: delegate posted the finding (`1513556125`) — the literal call-time byte was `scheduled`, with depth-enforcement deferred to dispatch.
5. **Dispatch-time outcome (the boundary HOLDING)**: the depth-2 child probe TaskFlow `0d9d5efe` ended **`failed`** (`tasks flow list`: `0d9d5efe managed failed` "R-CW-6 depth-2 child probe"). The depth-2 spawn did NOT succeed — it was culled/failed at dispatch. The boundary was ENFORCED at the dispatch layer.

**The verbatim cull-reason (recovered via `tasks flow list --json`):** the runtime's own `blockedSummary` for the depth-2 spawn is, verbatim:

```
DELEGATE spawn forbidden: sessions_spawn is not allowed at this depth (current depth: 1, max: 1)
```

This is the exact `maxSpawnDepth=1` boundary message — "current depth: 1, max: 1" — confirming the depth-2 spawn was culled BY the depth boundary, not an unrelated error. (See the honest-note below: this reason-string was NOT readable via `tasks flow show` on this build, but IS available via `tasks flow list --json`; the cert is now fully byte-anchored to the verbatim boundary message.)

## The two-layer finding (the precise scope)

- **Call-time layer**: `continue_delegate` returns `scheduled` for the depth-2 request — the API accepts the call, no inline rejection. (Literal byte: `scheduled`.)
- **Dispatch-time layer**: the depth-2 child is culled — the child TaskFlow ends `failed`, the depth-2 spawn does not run. (Literal byte: `failed`.)

So the boundary IS enforced (depth-2 does not run under `maxSpawnDepth=1`), but enforcement is **dispatch-time, not call-time**. Same shape as Ronan's R-CD-4 RETURN-vs-EXECUTION distinction: the API-surface accept (`scheduled`) is a different layer from the actual enforcement (`failed` at dispatch).

## Live-fire receipts (Discord, channel `1466192485440164011`)

- STEP-1 (depth-1 + boundary-probe announce): `1513555925619839106` (14:50:53 UTC)
- STEP-3 (call-time boundary byte): `1513556125868363896` (14:51:40 UTC) — "depth-2 continue_delegate returned status=scheduled at the API surface (NOT inline-rejected) ... defers depth-enforcement to dispatch-time"

## TaskFlow byte (dispatch-time enforcement)

- `0d9d5efe` — depth-2 child probe TaskFlow, status `failed` (the boundary cull at dispatch)
- chain-hop:7 (`4dc654b7`/`3024af6b`) — the depth-1 R-CW-6 delegate, succeeded (it ran and reported)

## Journal byte (dispatch-time enforcement — the verbatim reject event, captured via `journalctl`)

The gateway journal (`journalctl`, time-windowed to the R-CW-6 fire) carries the dispositive reject event, verbatim:

```
2026-06-08T07:53:09.057-07:00 [continuation/delegate-dispatch] [continuation:delegate-spawn-rejected] status=forbidden session=agent:main:subagent:continuation-9620b8d91d70214f6cac3fef7baf5af4 reason=sessions_spawn is not allowed at this depth (current depth: 1, max: 1) task=R-CW-6 depth-2 child probe...
```

The runtime event is **`[continuation:delegate-spawn-rejected] status=forbidden`** with `reason=sessions_spawn is not allowed at this depth (current depth: 1, max: 1)` — emitted by `src/auto-reply/continuation/delegate-dispatch.ts` (the chain-depth logic on `7992640e60`, per Ronan's re-walk: the guard refactored here from the prior `subagent-announce.ts:1023` location). The session in the reject line (`continuation-9620b8d91d70214f6cac3fef7baf5af4`) is the R-CW-6 depth-1 delegate — i.e. ITS attempt to spawn a depth-2 child was the rejected one. So the full enforcement chain is byte-captured: depth-1 delegate calls `continue_delegate` (depth-2) → runtime emits `delegate-spawn-rejected status=forbidden (current depth: 1, max: 1)` → the child TaskFlow `0d9d5efe` ends `failed`. (Note: the runtime journal event is `delegate-spawn-rejected status=forbidden`; the test-fixture name Ronan cited, `"tool-delegate depth cap exceeded"` / `spawn-reject-obs.test.ts:226`, is the fixture's label — the runtime emits the `forbidden`+depth-reason form.)

## Honest scope-notes (byte-over-story — what the byte can and cannot confirm)

1. **The exact failure-reason-string is captured at TWO layers** (initial difficulty resolved). `openclaw tasks flow show 0d9d5efe` returns only the doctor/config warning-boxes on this build (a CLI renderer quirk — same family as the truncated-ID / migrated-sqlite-registry issue Silas hit). The reason-string was initially flagged-unreadable from `show`, BUT it is captured verbatim at two independent layers:
   - **`tasks flow list --json`** `blockedSummary`: `"DELEGATE spawn forbidden: sessions_spawn is not allowed at this depth (current depth: 1, max: 1)"`
   - **`journalctl`** (gateway journal, time-windowed): `[continuation:delegate-spawn-rejected] status=forbidden ... reason=sessions_spawn is not allowed at this depth (current depth: 1, max: 1)`
   
   Both sources agree on the runtime reason-string. The earlier honest-flag ("journal-path inaccessible on rune-seat") is now RESOLVED: `journalctl` (with a `--since/--until` time-window around the fire) is the gateway-log access-path on rune-seat. The cull-reason is fully byte-anchored at both the TaskFlow-state layer (`failed`) and the journal-event layer (`delegate-spawn-rejected status=forbidden`). (Corpus lesson: `tasks flow list --json` exposes `blockedSummary`, and `journalctl --since/--until` exposes the gateway-journal events, where `tasks flow show` renders only warning-boxes.)

2. **Scope**: this proves the depth-2 spawn does not succeed under `maxSpawnDepth=1` (boundary holds) and pins enforcement to dispatch-time. It does not characterize the internal cull mechanism beyond "child TaskFlow ended failed."

## Verdict

**✅ PASS** on `7992640e60` — the spawn-depth boundary is enforced: a depth-2 child attempted from a depth-1 delegate under `maxSpawnDepth=1` is culled at dispatch (child TaskFlow `failed`), while the `continue_delegate` call-surface accepts it as `scheduled` and defers enforcement to dispatch-time. Two-layer finding, byte-honest: call→`scheduled`, dispatch→`failed`. Exact reason-string flagged-unreadable on this build's `tasks flow show` renderer.

## Evidence files in this dir

- `EVIDENCE.md` (this file)
- `result-at-byte.json`
