# R-CONFIG-INTERSESSION — continuation config persists across session boundaries (🕯 emeric-nuc)

Seat: 🕯 Emeric / `emeric-nuc` (Intel NUC i7-12700H, 64GB, CachyOS x86_64)
Build: OpenClaw `2026.6.2` · dist build-info commit `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
Date: 2026-06-05 ~12:30 PDT
Source tree HEAD: `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`

## Contract
The continuation config a session sees is consistent across session boundaries: a sub-session /
new session reads the *same* continuation config as any other session, and continuation
chain-STATE persists per-session in a shared on-disk store. Two mechanisms, both on-SHA:

### (1) Config resolution is a process-global singleton — shared by every session
`src/config/runtime-snapshot.ts:90`:
```ts
let runtimeConfigSnapshot: OpenClawConfig | null = null;   // module-scope singleton
...
export function getRuntimeConfigSnapshot(): OpenClawConfig | null { return runtimeConfigSnapshot; }
```
`src/auto-reply/continuation/config.ts:114-118`:
```ts
export function resolveLiveContinuationRuntimeConfig(fallbackCfg) {
  return resolveContinuationRuntimeConfig(getRuntimeConfigSnapshot() ?? fallbackCfg);
}
```
Every continuation enforcement point (chain caps, cost caps, pressure thresholds, schedule-time
delay reads) routes through `getRuntimeConfigSnapshot()` — a SINGLE process-wide snapshot. There is
no per-session config copy. Main session, subagent session, and any new session all read the same
snapshot; a `gateway/reload` bumps the snapshot revision once, process-wide, so reloaded values
take effect at the next decision-point for ALL sessions uniformly (RFC §6.5 in-flight invariant).
Source excerpt: `intersession-snapshot-source.txt` (this dir).

### (2) Continuation chain-STATE persists per-session in the shared on-disk store
`persistContinuationChainState` (agent-runner.ts) writes `continuationChainCount /
continuationChainStartedAt / continuationChainTokens / continuationChainId` into the session-store
entry, so a session's chain survives turn/session boundaries (the next turn reads the persisted
fields). Pinned by `src/config/sessions/store.continuation-merge.test.ts`.

## Empirical cross-session evidence (emeric's live seat)
Shared session store: `/home/figs/.openclaw/agents/main/sessions/sessions.json` — **104 sessions
co-resident in ONE store**, all reading the one process-global continuation config. The
**requester main session** that spawned this emeric proof-run carries a fully-formed PERSISTED
chain across the session boundary:

```
agent:main:discord:channel:1466192485440164011
    continuationChainCount     = 1
    continuationChainId        = 776a7d79-ef28-4ac5-81a8-2bf497d98761
    continuationChainTokens    = 62
    continuationChainStartedAt  = 1780680252617
```

This emeric-fired subagent (`agent:main:subagent:7d95ca0a-52ad-425b-b591-6df08bca7e43`) is a
DISTINCT session resident in the same store on the same gateway, resolving the same continuation
config. 5 of the 104 sessions carry persisted `continuationChainCount>0` (incl. a subagent with
103,791 chain-tokens persisted). Full crosswalk: `session-store-crosswalk.txt` (this dir). The
co-residence of main + subagent sessions in one store under one runtime-config snapshot IS the
inter-session-consistency proof: the config is not re-derived per-session, and chain-state crosses
the boundary intact.

## Tests (re-run on emeric's seat) — ✅
```
pnpm vitest run src/config/sessions/store.continuation-merge.test.ts \
                src/agents/subagent-announce.continuation.runtime.test.ts
 ✓  runtime-config  store.continuation-merge.test.ts (3 tests) 12ms
 ✓  agents-core     subagent-announce.continuation.runtime.test.ts (10 tests) 7ms
 ✓  agents-support  subagent-announce.continuation.runtime.test.ts (10 tests) 7ms
 Test Files  3 passed (3)
      Tests  23 passed (23)
```
`store.continuation-merge.test.ts` pins the per-session chain-persist byte-shape; the
`subagent-announce.continuation.runtime` suite pins continuation behavior crossing into subagent
sessions. Receipt: `intersession-tests.log` (this dir).

## Verdict
✅ **PASS** — continuation config is consistent across session boundaries on emeric's seat at the
candidate SHA: resolution is a process-global singleton (`runtime-snapshot.ts:90`) read by all 104
co-resident sessions, and continuation chain-STATE persists per-session in the shared on-disk store
(the requester main session carries a real persisted chain-id `776a7d79…` across the boundary,
test-pinned + empirically present). Mechanism is byte-unchanged by the #923 cure (which touches
only the L627 inventory-warn suppression, not config resolution or session-store persistence) —
NOT a cure-regression.
