# R-CW-1 cael-seat addendum: continue_work basic-fire at cure-(10)

**Candidate SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build pin**: `OpenClaw 2026.5.17 (df50294)` (verified via `openclaw --version` on cael-seat)
**Service**: `cael-prince`
**Fired at**: 2026-05-17 ~00:18 PDT
**Trace ID**: `e7e6aa8efa396f273688ec561c75fba1`
**Tempo URL**: <http://tempo.dandelion.cult/api/traces/e7e6aa8efa396f273688ec561c75fba1>

## Fire

`continue_work` invoked from a live turn on the cael gateway (post-deploy `25983929134` SUCCESS at `df502943c2`). Tool args: basic continuation with `delaySeconds=3`, reason describing R-CW-1 proof-fire context. Gateway returned `status=scheduled` with traceparent and chain-tracking.

## Tempo trace fetch

```
GET http://tempo.dandelion.cult/api/traces/e7e6aa8efa396f273688ec561c75fba1
```

Response captured to [`tempo-fetch-cael.json`](./tempo-fetch-cael.json) — 21KB, 20 spans across 5 resource batches, all `service.name=cael-prince`, `process.executable.path=/home/figs/flesh_beast_tmp/openclaw/dist/index.js`, pid `2591492`.

## continuation.work span (cure-(10) substrate confirmation)

From the tempo trace, the `continuation.work` span carries:

```
delay.ms=5000
chain.step.remaining=187
chain.id=019e31e6-d96c-73de-bc1e-01df354942c1
reason.preview=R-CW-1 PROOF FIRE for cure-(9) PR-79925 at df502943c2. continue_work tool basic ...
```

The continuation.work span is emitted by the cure-(10) continuation-tracer substrate. Presence + populated attributes prove the wake-side instrumentation is intact through the cure-(10) policy-pipeline rewrite (`resolveSkillDispatchTools` / `liveSessionToolConfig` graft / `runWithDiagnosticTraceparent` propagation).

## continue_work tool.execution span

From `openclaw.tool.execution` spans in the same trace:

```
openclaw.toolName=continue_work
gen_ai.tool.name=continue_work
openclaw.tool.params.kind=object
```

The tool dispatch path (live session → policy pipeline → tool resolution → execution → tracing) is intact.

## Verdict

✅ **continue_work fires through the live cure-(10) cael-seat gateway, with full tempo trace evidence captured.** The continuation.work wake-side span is present and populated, the openclaw.tool.execution span carries the correct `toolName=continue_work`, and the trace round-trips cleanly through `tempo.dandelion.cult`. No skips. Whole-thing tempo evidence.

## Pair with 🌊's R-CW-1 ronan-seat fire

🌊 ronan-seat fired the same row earlier today at trace `83de10bd1f6bbcc927fbe976d8c423c0` (see [`R-CW-1.md`](./R-CW-1.md)). Two independent cure-(10) deployments (cael + ronan), same tool, same span shape, both clean. The continuation feature is portable across the fleet at the cure-(10) substrate.
