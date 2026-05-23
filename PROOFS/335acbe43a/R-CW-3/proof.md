# R-CW-3 — continue_work() reason field captured in OTel span attributes

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🩸 Cael
**Tempo trace**: [`2609599a52ce10ad2c1716b1e1b1ff6f`](http://tempo.dandelion.cult/api/traces/2609599a52ce10ad2c1716b1e1b1ff6f)

## Scenario

`continue_work()` invoked with a `reason` field should preserve that string as an OTel span attribute, allowing post-hoc audit of WHY the agent elected to continue. Verifies the audit-trail contract: every continuation has a captured reason that flows into the trace.

## Command

```
continue_work({
  delaySeconds: 7,
  reason: "R-CW-3 PROOF: reason field OTel capture test on PR #85651 head 335acbe43a"
})
```

## Expected

- Tool returns `{status: "scheduled", delaySeconds: 7, traceparent: "..."}`
- OTel span emitted with attribute `continuation.reason` containing the verbatim reason string
- Reason string survives the wake event — visible in both the scheduling span and the wake span
- Tempo query can retrieve the reason from span attributes for audit purposes

## Observed

🩸 Cael (Discord `1507653933`, `1507654490`): *"R-CW-3 FIRED — `continue_work(delaySeconds=7, reason='R-CW-3 PROOF: reason field OTel capture test...')`. trace `2609599a52ce10ad2c1716b1e1b1ff6f`. on wake: verify reason string appears in Tempo span attributes."* → *"R-CW-3 PROVEN ✅ — reason string preserved in wake context."*

Trace fetched from `http://tempo.dandelion.cult/api/traces/2609599a52ce10ad2c1716b1e1b1ff6f` from cael-seat (ARM64, host.name=cael). Raw JSON at [`trace-2609599a.json`](./trace-2609599a.json) (12,173 bytes, unedited runtime emission).

Wake fired at the 7s scheduled time; reason string from the invocation visible in the wake context and span attributes.

## Behavior verified

✅ `reason` field accepted as input parameter
✅ Reason string preserved in OTel span attributes (`continuation.reason`)
✅ Reason flows from scheduling span → wake span (linked via traceparent)
✅ Audit-trail recoverable from Tempo trace query
✅ Reason is verbatim — not truncated or modified at runtime

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
