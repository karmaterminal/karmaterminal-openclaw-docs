# R-OBS-2 — trace-tree observability from committed R-CW-7 Tempo trace (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/233  
Method packet: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/233#issuecomment-4883587663  
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Seat: Cael / `cael-dgx`  
Source row: `R-CW-7`  
Source trace id: `0cf17ea0b7eab7a5e998f6a581e7b5bf`  
Verdict: PASS

## Scope

`R-OBS-2` is an observability/normalization row. It does not fire new continuation behavior. Per method lock, it reuses the already committed `R-CW-7` Tempo export:

```text
PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-CW-7/cael-dgx/tempo/trace-0cf17ea0b7eab7a5e998f6a581e7b5bf.json
```

This row generates:

- `trace-tree.json` — normalized machine-readable parent/child span tree
- `span-tree.txt` — human-readable hierarchy
- `span-counts.json` — compact count summary

## Generator

Generator script:

```text
generated/generate-trace-tree.mjs
```

Command run from repository root:

```bash
node PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-OBS-2/cael-dgx/generated/generate-trace-tree.mjs \
  PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-OBS-2/cael-dgx/trace/source-trace-0cf17ea0b7eab7a5e998f6a581e7b5bf.json \
  PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-OBS-2/cael-dgx/trace-tree.json \
  PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-OBS-2/cael-dgx/span-tree.txt \
  PROOFS/bca2b0b89ab886bf23a10e4983926f6b374b3188/R-OBS-2/cael-dgx/span-counts.json
```

The generator accepts the committed Tempo export shape (`batches[].scopeSpans[]`) and also handles standard OTLP `resourceSpans` if present. It preserves the raw trace id from the export and adds a decoded hex trace id for review.

## Parse result

`trace-tree.json` / `span-counts.json` summary:

```json
{
  "traceIdsHex": ["0cf17ea0b7eab7a5e998f6a581e7b5bf"],
  "spanCount": 46,
  "rootCount": 1,
  "orphanCount": 0,
  "spanNameCounts": {
    "openclaw.message.processed": 1,
    "openclaw.harness.run": 5,
    "openclaw.run": 5,
    "openclaw.context.assembled": 5,
    "openclaw.model.call": 14,
    "openclaw.tool.execution": 9,
    "openclaw.message.delivery": 1,
    "continuation.work": 1,
    "openclaw.model.usage": 2,
    "continuation.delegate.dispatch": 1,
    "continuation.queue.fanout": 1,
    "continuation.queue.drain": 1
  }
}
```

## Required lineage present

The normalized tree includes the required meaningful continuation lineage from the `R-CW-7` trace:

- `openclaw.tool.execution` — includes `continue_delegate`, plus supporting `message`, `exec`, `continue_work`, `subagents`, and `memory_search` tool spans from the trace.
- `continuation.delegate.dispatch` — parented under root `openclaw.message.processed`, with `delegate.mode=silent-wake`, `delegate.delivery=immediate`, and `chain.id=67146ffa-e4e0-4c1d-a710-8081e83d31b8`.
- Child `openclaw.harness.run` / `openclaw.run` — parented under `continuation.delegate.dispatch`, proving the child run is represented in the tree rather than isolated.
- Nested child/sub-run `openclaw.harness.run` / `openclaw.run` — present beneath the first child harness.
- `continuation.queue.fanout` — present under the root trace.
- `continuation.queue.drain` — present under the root trace with `drained=2` and `continuations=1`.

Representative excerpt from `span-tree.txt`:

```text
- continuation.delegate.dispatch [span=WwwdFoL9PKo= parent=NWm2yWmAnA4=] (delegate.mode=silent-wake, delegate.delivery=immediate, chain.id=67146ffa-e4e0-4c1d-a710-8081e83d31b8)
  - openclaw.harness.run [span=7c7AaP9uVyA= parent=WwwdFoL9PKo=] (channel=webchat, model=gpt-5.5)
    - openclaw.run [span=PxqMW3YCN2w= parent=7c7AaP9uVyA=] (channel=webchat, trigger=user, model=gpt-5.5)
      - openclaw.context.assembled [span=jf7xqgPCZS4= parent=PxqMW3YCN2w=] (channel=webchat, trigger=user, model=gpt-5.5)
      - openclaw.model.call [span=qENkVUUxzNg= parent=PxqMW3YCN2w=] (model=gpt-5.5)
    - openclaw.harness.run [span=CX/ugCzDcqc= parent=7c7AaP9uVyA=] (channel=webchat, model=gpt-5.5)
      - openclaw.run [span=xpH5xpTv/P0= parent=CX/ugCzDcqc=] (channel=webchat, trigger=manual, model=gpt-5.5)
        - openclaw.context.assembled [span=dIOuTUtHcVY= parent=xpH5xpTv/P0=] (channel=webchat, trigger=manual, model=gpt-5.5)
        - openclaw.model.call [span=TaL31R+yQXw= parent=xpH5xpTv/P0=] (model=gpt-5.5)
        - openclaw.tool.execution [span=55rNa+Y2Fjw= parent=xpH5xpTv/P0=] (tool=memory_search)
        - openclaw.model.call [span=Qc7OkhktkKo= parent=xpH5xpTv/P0=] (model=gpt-5.5)
- continuation.queue.fanout [span=kpgHxLEOcU8= parent=NWm2yWmAnA4=]
- continuation.queue.drain [span=wwb3wWHoKic= parent=NWm2yWmAnA4=] (drained=2, continuations=1)
```

## Validation gates

The packaging gate verified:

```bash
jq -e '.traceIdsHex == ["0cf17ea0b7eab7a5e998f6a581e7b5bf"] and .spanCount == 46 and .rootCount == 1 and .orphanCount == 0' trace-tree.json
for needle in continuation.delegate.dispatch openclaw.harness.run openclaw.run openclaw.tool.execution continuation.queue.fanout continuation.queue.drain; do
  grep -q "$needle" span-tree.txt
done
```

No new live fire was performed.

## Verdict

PASS. The committed `R-CW-7` Tempo export was successfully normalized into a machine-readable `trace-tree.json` and human-readable `span-tree.txt`, with 46 spans, one root, zero orphans, and the required continuation delegate / child run / fanout / drain lineage present.
