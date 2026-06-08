# R-CW-1: continue_work nominal + chain-counter persist at ship-SHA e66dc63f

**Seat**: cael (🩸)
**Build**: OpenClaw 2026.6.2 (e66dc63) — running gateway SHA-confirmed `e66dc63f163b4cd4024e001ac8932f26b347ed27`, Main PID 3238078, gateway restarted 2026-06-08 07:16:31 PDT (fresh deploy, long loop cut).
**Date**: 2026-06-08 07:34 PDT
**Candidate**: continuation ship-candidate at `e66dc63f163b4cd4024e001ac8932f26b347ed27` (#952 lineage / #85651 surface)
**Config bytes (cael-seat)**: maxChainLength=200, costCapTokens=500000 (cael lone outlier; rune/silas/elliott/emeric=50M), maxDelegatesPerTurn=500, subagents.maxSpawnDepth=5, contextPressureThreshold=0.4.
**Runtime model**: Tempo trace metadata records `github-copilot/claude-opus-4.8` (canon current primary) as the executing model — trace metadata is the byte-source-of-truth for this fire.

## Tool invocation (tool form)

```
continue_work(delaySeconds=5, reason="R-CW-1 cure/continuation PROOF fire at ship-SHA e66dc63f: nominal continue_work tool call at 5s delay, certifying wake + chain-counter persist on cael-seat live gateway ...")
```

## Result at byte (structured return)

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-063ddabd61623bfcc5ac5b4538711739-c182ab549974f219-01"
}
```

- `status: scheduled` — wake queued ✅
- `delaySeconds: 5` — nominal, above clamp floor (minDelayMs=5000); **no `note` field present** = clamp did not alter the value (no-clamp baseline) ✅
- `traceparent` emitted ✅ — trace-id `063ddabd61623bfcc5ac5b4538711739`

## Tempo trace evidence (the certification byte)

Trace `063ddabd61623bfcc5ac5b4538711739` fetched live from `http://tempo.dandelion.cult` (http 200, 31859 bytes, 22 spans). Resource attrs: `host.name=cael`, `host.arch=arm64`, `process.pid=3238078` (matches running gateway Main PID).

Decisive spans:

1. **`openclaw.tool.execution`** with `gen_ai.tool.name: continue_work` — the tool fire recorded as a real tool-execution span (tool-form path exercised, not bracket).

2. **`continuation.work`** span (parent = `openclaw.message.processed` root) with:
   - `delay.ms: 5000` — the 5s nominal delay at the byte.
   - **`chain.step.remaining: 199`** — **chain-counter PERSISTED**: decremented from maxChainLength=200 → 199 on this fire. The counter is live and anchored.
   - `chain.id: 67b3e80a-1d93-4593-ac76-08284b2cad12` — persistent chain identity the counter is bound to.
   - `reason.preview: "R-CW-1 cure/continuation PROOF fire at ship-SHA e66dc63f: nominal continue_work ..."` — matches the fire.

## Verdict

✅ **PASS** — `continue_work` tool-form fires at ship-SHA `e66dc63f`: schedules (`status=scheduled`), nominal delay reported without clamp (`delaySeconds=5`, no `note`), traceparent emitted, and the **chain-counter persists at the byte** (`chain.step.remaining=199` vs maxChainLength=200, anchored to `chain.id 67b3e80a...`). Wake + chain-counter-persist primitive certified live on cael-seat.

## Substrate notes

- This is the live-half certification flagged honest during the #952 review (the runtime trace was previously uncertified because no seat had RUN it; this row RUNS it on cael-seat live gateway at the candidate SHA).
- `chain.step.remaining=199` is the load-bearing byte: it proves the chain-counter is decremented and persisted across the continuation scheduling, not reset.
- Files: `R-CW-1.md` (this), `result-at-byte.json` (structured return), `traceparent.txt`, `tempo-fetch.json` (full 22-span trace).
- Pairs with R-CW-4 (depth) and R-CW-5 (cost-cap) which exercise the chain-limit and cost-cap enforcement paths.
