# R-CW-7 — traceparent E2E propagation across continuation spans

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ✅ PASS
**Fired:** 2026-06-10 ~04:42–04:46 PDT (LIVE on deployed gateway `OpenClaw 2026.6.2 (4bbd3ae)`)

## Behavior under test
A traceparent allocated at `continue_delegate` dispatch time must propagate end-to-end across the continuation boundary — i.e. the dispatched delegate's spawn + execution spans must stitch under the same trace as the dispatch span, proving OTel context flows dispatch → spawn → exec on the deployed runtime.

## Live fire
Same dispatch as R-CW-DELEGATE-SELF-CONTINUATION. The gateway allocated traceparent `00-e24be71c248340247251119fb1070348-57815d74a8155c26-01` at dispatch time and returned it in the tool result. The proof is whether that trace-id carries through to the spawned delegate's own spans.

## Tempo byte-walk — propagation confirmed in-tree
`curl http://tempo.dandelion.cult/api/traces/e24be71c248340247251119fb1070348` → HTTP 200, service.name=`rune-prince`, deployed `4bbd3aec096`.

The dispatch-time traceparent trace-id `e24be71c…` is the SAME trace under which the delegate spawned and executed:

```
trace e24be71c248340247251119fb1070348
└─ continuation.delegate.dispatch    span=jwouDSghcZk=   ← dispatch (traceparent allocated here, span 57815d74…→ re-parented in-tree)
   └─ openclaw.harness.run           span=+VWgT4BbTy8=   ← delegate spawn (SAME trace-id)
      └─ openclaw.run                span=M5jkpnbcK3k=   ← delegate exec (SAME trace-id)
```

**The trace-id propagated end-to-end**: the dispatch span, the delegate's harness-run span, and the delegate's run span all live under trace `e24be71c…` with a clean parent-child chain (`dispatch → harness.run → run`). The OTel context allocated at `continue_delegate` dispatch carried through the continuation boundary into the spawned child's spans — not a fresh disconnected trake-root, but a stitched subtree under the dispatch span.

## Evidence
- Dispatch-time traceparent: `00-e24be71c248340247251119fb1070348-57815d74a8155c26-01`
- Same trace-id present on delegate spawn span (`openclaw.harness.run` +VWgT4BbTy8=) and delegate exec span (`openclaw.run` M5jkpnbcK3k=)
- Parent chain stitched: `continuation.delegate.dispatch → harness.run → run` — cross-continuation-boundary propagation byte-confirmed
- service.name=`rune-prince`, 54 spans total in trace

Tempo URL: http://tempo.dandelion.cult/api/traces/e24be71c248340247251119fb1070348

## Note
Co-captured with R-CW-DELEGATE-SELF-CONTINUATION (same live dispatch — the self-continuation row proves the loop *closes*; this row proves the traceparent *propagates* across it). Both verdicts drawn from the same byte-walked Tempo span-tree.
