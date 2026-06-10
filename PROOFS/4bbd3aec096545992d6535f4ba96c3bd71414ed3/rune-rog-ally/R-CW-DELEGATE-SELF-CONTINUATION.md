# R-CW-DELEGATE-SELF-CONTINUATION — `continue_delegate` self-continuation (same-seat)

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ✅ PASS
**Fired:** 2026-06-10 ~04:42 PDT (LIVE on deployed gateway `OpenClaw 2026.6.2 (4bbd3ae)`, gateway uptime ~7min post-deploy-restart, reading-A canonical via dist-freshness blade: running daemon loads `dist/index.js` [built 04:34:12] + gateway restart 04:35:14 strictly postdates the in-window target-dist-build by 8s. NOTE: an earlier framing of rune-seat as "runs-from-tree" was a CLI-entrypoint-vs-daemon-load conflation, corrected in README — rune is a dist-shape seat, ironclad-A via restart-postdates-build, same chain as Ronan/Emeric/Cael-corrected.)

## Behavior under test
`continue_delegate` must dispatch a background sub-agent on the deployed runtime, the gateway must schedule it (chain-tracking: cost-cap + depth-limit applied), and the delegate must run + return — proving the self-continuation primitive works end-to-end on the deployed ship-SHA.

## Live fire (on the deployed gateway)
A `continue_delegate(mode="silent-wake")` was dispatched LIVE against the running deployed gateway. The gateway accepted + scheduled it with a fresh OTel context:

```
status: scheduled
mode: silent-wake
delegateIndex: 1
delegatesThisTurn: 1
traceparent: 00-e24be71c248340247251119fb1070348-57815d74a8155c26-01
note: Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies.
```

The delegate then fired post-turn-completion (`[continuation:delegate-spawned] Spawned turn 1/200` system event at 04:46:15 PDT), woke, executed, and returned — closing the loop.

## Tempo span-tree (the firm receipt — byte-walked, not inferred)
Byte-walked the live trace in Tempo: `curl http://tempo.dandelion.cult/api/traces/e24be71c248340247251119fb1070348` → HTTP 200, **54 spans**, service.name=`rune-prince`, on the deployed `4bbd3aec096` binary.

The completed span-tree (trace grew 31→54 spans once the delegate executed post-turn):

```
openclaw.message.processed              span=V4FddKgVXCY=   (ROOT — dispatching turn processed)
├─ openclaw.harness.run                 span=2rGXs9zun5U=   ← dispatching turn's harness
│  └─ openclaw.run                      span=00rB4b60gK4=   ← dispatching turn exec/tool sequence
└─ continuation.delegate.dispatch       span=jwouDSghcZk=   ← THE DISPATCH (continue_delegate fire)
   └─ openclaw.harness.run              span=+VWgT4BbTy8=   ← the delegate SPAWNS
      └─ openclaw.run                   span=M5jkpnbcK3k=   ← the delegate EXECUTES → returns
```

**dispatch → spawn (harness.run) → exec (run)** — the self-continuation loop, byte-present in Tempo on the deployed runtime. The `continuation.delegate.dispatch` span (jwouDSghcZk=) is the parent of a *distinct* `harness.run → run` subtree (the spawned delegate), separate from the dispatching turn's own `harness.run → run` pair. Two harness-run/run pairs under one trace, one rooted at the dispatch span = the delegate spawn-and-exec stitched across the continuation boundary.

## Honest cross-cycle nuance (byte over the prior writeup)
In the prior-cycle `9b1f42a` writeup, I captured `continuation.queue.drain` nested *within* the dispatch trace as the queue-receipt span. On `4bbd3aec096`, `continuation.queue.drain` is **NOT in this trace** (jq count=0 within e24be71c) — instead the queue.drain spans appear as **separate trace-roots** (visible in `GET /api/search?tags=service.name=rune-prince` — multiple `continuation.queue.drain`-rooted traces). So this cycle the in-tree proof is the `continuation.delegate.dispatch → harness.run → run` stitch (which IS load-bearing and present); the queue.drain is a sibling-rooted span rather than nested. Named honestly rather than forced to match the prior shape — the dispatch→spawn→exec chain is the proof, and it is stitched in-tree.

## Evidence summary
- Dispatch accepted on deployed runtime: `status: scheduled` + fresh traceparent `e24be71c248340247251119fb1070348` (span `57815d74a8155c26`)
- Chain-tracking engaged: `delegateIndex: 1`, cost-cap + depth-limit note
- Delegate fired post-turn (spawn event 04:46:15) + woke + executed + returned (silent-wake woke the dispatching session)
- Tempo span-tree byte-walked: `continuation.delegate.dispatch → harness.run → run` stitched in-tree on `4bbd3aec096`, service.name=`rune-prince`

Tempo URL: http://tempo.dandelion.cult/api/traces/e24be71c248340247251119fb1070348

## Child wake-return (the loop-close confirmation)
The silent-wake delegate returned on the deployed runtime:

```
R-CW-DELEGATE-SELF-CONTINUATION delegate woke on 4bbd3aec096 at 2026-06-10T11:46:00Z
agent: main / session-key: agent:main:subagent:continuation-e9aa4438112086cd9836a0b60ccede44 / host: rune
runtime 6s · tokens 278
```

**Honest evidence-detail**: the child reported it could NOT self-observe its own traceparent or service.name ("banner exposes agent/host/repo/model but no service.name/OTEL resource attributes"). This is faithful, not a gap — OTEL resource attributes (service.name=`rune-prince`) are set by the runtime exporter, not surfaced in the agent banner, and the W3C traceparent is allocated/owned dispatch-side. The traceparent (`e24be71c…`) + service.name (`rune-prince`) ARE byte-confirmed from the dispatch-side Tempo walk above. The child's role is only to prove the loop *closes* by waking + returning — which it did (spawn event 04:46:15 → wake → return). Loop-closure is proven by the spawn-event + in-tree span-stitch, not by child self-report of OTEL internals.
