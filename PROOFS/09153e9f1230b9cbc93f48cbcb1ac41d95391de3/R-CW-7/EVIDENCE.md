# R-CW-7 — traceparent E2E propagation across continuation spans

**Owner:** 🪨 Rune (`rune-rog-ally`)
**Verdict:** ✅ PASS
**Candidate SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (canonical fold, deployed)
**Fired from:** deployed `8b5dde6165` runtime — gateway pid `573310`, `process.executable.path=/home/figs/flesh_beast_tmp/openclaw/dist/index.js` (confirmed in trace resource attributes: `host.name=rune`, `host.arch=amd64`).

## Behavior proven

A `continue_delegate` fired from the parent session propagates its W3C `traceparent` to the dispatched child, so the child `openclaw.run` is stitched into the parent's continuation span tree (one trace, parent→child).

## Evidence

**traceparent emitted by the dispatch (from the `continue_delegate` tool-result):**
```
00-d188fdca052d877d97773d47723f69bf-e3e515838b3d783d-01
```
- trace-id: `d188fdca052d877d97773d47723f69bf`
- parent span-id (the dispatching continuation span): `e3e515838b3d783d`

**Tempo trace (captured live):** `http://tempo.dandelion.cult/api/traces/d188fdca052d877d97773d47723f69bf`
- Saved: [`traceparent_propagation_trace.json`](./traceparent_propagation_trace.json) (27 spans, 10 resource batches)

**Parent→child span stitching (the propagation evidence):**
```
openclaw.message.processed   span=4+UVg4s9   parent=ROOT
  └─ openclaw.harness.run    span=h/KmbAdp   parent=4+UVg4s9
      └─ openclaw.run        span=ghPgHN3a   parent=h/KmbAdp    ← parent turn
  … (continuation.delegate.dispatch under the parent run)
  └─ openclaw.harness.run    span=kaB45oMX
      └─ openclaw.run        span=IZZxoM+T   parent=kaB45oMX    ← CHILD delegate run, stitched into the trace
```

Two `openclaw.run` spans (parent turn + dispatched child) appear under the propagated trace-context — the traceparent carried the parent context into the child's run, exactly the continuation span-stitching the row asserts.

## Method (reproducer)

1. From a session on the deployed CANDIDATE_SHA runtime, fire `continue_delegate` (any task) — capture the `traceparent` field in the tool-result.
2. `curl http://tempo.dandelion.cult/api/traces/<trace-id>` → confirm the dispatch span + the child `openclaw.run` share the trace, with the child's parent chain rooting through the dispatching continuation span.
3. Save the trace JSON; record the traceparent.

## Honest limits

None for this row — traceparent propagation fired clean and is captured in Tempo. (The child delegate's deeper sub-spans may carry their own sub-trace segments per the runtime's span model; the load-bearing assertion — parent→child traceparent stitching across the continuation dispatch — is demonstrated by the two stitched `openclaw.run` spans under the captured trace.)
