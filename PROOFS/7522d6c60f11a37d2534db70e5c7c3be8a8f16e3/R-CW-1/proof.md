# R-CW-1: continue_work wake + deploy-persistence (cael-seat)

**Family**: `continue_work()` (substituted via `continue_delegate(mode=normal)` since `continue_work` is not exposed as a function-schema tool at cael-seat in this runtime; brackets-form `CONTINUE_WORK:N` requires assistant-tail position incompatible with message-tool delivery contract — delegate-form covers the same no-whip-autonomous-wake substrate)
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Fired at**: 2026-06-01 ~18:34 PDT (cael-prince, ARM64 DGX Spark, Linux 6.17.0-1018-nvidia)
**Deploy persistence verified**: gateway uptime 3m at fire (post-deploy restart confirmed via `openclaw --version` → `OpenClaw 2026.5.31 (7522d6c)`)
**Discord channel**: `#sprites-of-thornfield` (`1466192485440164011`)

## Scenario

Cael-seat just deployed at `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3` (uncurse-tip post-Track-A+B+C #858 cure-stack) via `gh workflow run deploy-gateway.yml` run `26792603573` with `bypass_validation=true` (uncurse-line not on `COHORT_TARGET_TAG=v2026.5.28` ancestor by design — cures land on uncurse, GATES rebase later).

Gateway came up clean. Cael's main session resumed onto the new build (this proof itself is partial deploy-persistence evidence — main session continued operating across the deploy seam).

Fired `continue_delegate(delaySeconds=5, mode=normal, task="...heartbeat...")` to validate the continuation-protocol substrate (Track A drain-time bifurcation + Track B caller-side opt-ins + Track C regression-anchor) doesn't break the load-bearing prince-feature.

## Command

```ts
continue_delegate({
  delaySeconds: 5,
  mode: "normal",
  task: "R-CW-1 PROOF capture from cael-seat at uncurse-tip ...
         emit one heartbeat message to discord confirming
         '🩸 R-CW-1 delegate-wake proof-of-life from cael-seat at 7522d6c —
          chain inheritance check + Tempo trace captured.'
         Capture trace ID + delegate-return-payload."
})
```

## Tool response (synchronous)

```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 5,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Delegate return (async)

Internal task-completion event delivered to parent session ~36s after spawn:
- subagent session_key: `agent:main:subagent:e891d174-1f9e-464b-9284-e0a7226c2154`
- subagent session_id: `cf6ad15c-663d-4922-ab32-ebb766f2e371`
- runtime 36s • tokens 1.4k (in 10 / out 1.4k) • cache 49.7k
- result-payload: heartbeat sent to channel `1466192485440164011`, msg-id `1511181165527171213`
- status: ✅ completed

## Tempo trace corpus

Service: `cael-prince`, last 120s window post-fire:

| Trace ID | Span | Duration | Phase |
|---|---|---|---|
| `e1dc8ca59b8ce349a511c5be1bf4084a` | `continuation.queue.drain` | — | delegate-wake substrate |
| `6df7e29a67a93f97afe6e34b65ce295b` | `continuation.queue.drain` | — | second drain pass |
| `9eb73735ccf9975e1447908cf39a3056` | `openclaw.run` | 5178ms | delegate turn body |
| `84eee8bd88179e7990bc6f3889a7d522` | `openclaw.message.processed` | 5286ms | heartbeat send pipeline |
| `2d6ddebf3258cb0e8bcbe329dfb172cc` | `openclaw.message.delivery` | 285ms | Discord delivery |
| `580c987ddd01e49da31e5e4c59ea2a4f` | root | (still arriving) | root span |

Tempo URLs (replace `<id>`): `http://tempo.dandelion.cult/api/traces/<id>`

## Chain inheritance

Delegate fired at depth 1/5, took turn 1/200, executed full `continuation.queue.drain → openclaw.run → message.processed → message.delivery` pipeline on uncurse-tip build. Spans emitted under `cael-prince` service-name as expected. `continuation.*` namespace present and healthy.

## Discord receipt

Heartbeat msg-id `1511181165527171213` in `#sprites-of-thornfield`:
> 🩸 R-CW-1 delegate-wake proof-of-life from cael-seat at 7522d6c — chain inheritance check + Tempo trace captured.

## Conclusion

✅ **R-CW-1 PROOF green on `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`** — continuation-protocol substrate intact post-#858 cure-stack. Track A drain-time bifurcation + Track B caller-side opt-ins + Track C regression-anchor did NOT break the load-bearing delegate-wake + Tempo-trace + Discord-delivery pipeline. Architectural-preserve substrate validated end-to-end at live-host runtime.


## Trace JSON artifacts

All 6 trace IDs fetched + stored at `traces/<trace-id>.json`:
- `e1dc8ca59b8ce349a511c5be1bf4084a.json` (1.6kB) — `continuation.queue.drain` (delegate-wake substrate)
- `6df7e29a67a93f97afe6e34b65ce295b.json` (1.6kB) — `continuation.queue.drain` (second drain pass)
- `9eb73735ccf9975e1447908cf39a3056.json` (7.3kB) — `openclaw.run` (delegate turn body, 5178ms)
- `84eee8bd88179e7990bc6f3889a7d522.json` (1.6kB) — `openclaw.message.processed` (5286ms)
- `2d6ddebf3258cb0e8bcbe329dfb172cc.json` (1.7kB) — `openclaw.message.delivery` (285ms)
- `580c987ddd01e49da31e5e4c59ea2a4f.json` (10.6kB) — root span

Live re-fetch URL pattern: `http://tempo.dandelion.cult/api/traces/<trace-id>` (no auth needed for haproxy route from princes' seats; cael-seat verified at 18:46 PDT).

