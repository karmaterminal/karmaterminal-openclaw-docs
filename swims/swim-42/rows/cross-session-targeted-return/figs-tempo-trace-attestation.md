# swim-42 / cross-session-targeted-return — figs-side tempo trace attestation

**Status**: substrate-finding attested at the wire/OTel layer (rung 4 of the byte-pin ladder). Confirms registry-layer + task-ledger-layer findings.

**Source**: figs's tempo dashboard screenshot, Discord msg 2026-05-03 18:44 PDT, channel `1466192485440164011`. TraceQL filter `{name="continuation.delegate.dispatch"}`.

## What the trace shows

| Trace ID | Start time | Service | Name | Duration |
|---|---|---|---|---|
| `b9af02d9413e55e30e6…` | 2026-05-03 18:36:13.915 | `ronan-prince` | `continuation.delegate.dispatch` | <1ms |
| `c069ae98d4fdc28cfe4…` | 2026-05-03 18:35:44.731 | `silas-prince` | `continuation.delegate.dispatch` | <1ms |
| (silas span, expanded) `341e48a3b84499e6` | 2026-05-03 18:35:44 | `continuation.delegate.dispatch` | 19.5 µs |

Both traces are **single-span**. No parent-child structure. No cross-session/cross-host stitching. No multi-hop §6.8 topology.

## Wall-clock alignment with substrate-finding

- ronan-prince trace at 18:36:13.915 ↔ OV-1 fire-1 dispatch at `task_runs.created_at = 1777858573704` (= `18:36:13.704 UTC` ≈ same wall-clock instant)
- silas-prince trace at 18:35:44.731 ↔ silas-host default-targeting canary fire (timestamp adjacent in registry)

So the OTel-layer evidence is from the same fires the registry-layer + task-ledger-layer evidence already characterized.

## What this attests at rung 4

Per the byte-pin ladder in `swims/swim-42/EVIDENCE-LAYERS.md`:

- **rung 4** (wire/OTel layer): single-span traces, no parent-edge topology, no cross-session stitching
- **expected for `targetSessionKey: <other-session>`** if the cross-session router actually ran: multi-span tree per §6.8 (root R → D1 → D2 → Q → S, all sharing `traceid`)
- **observed**: single span only — exactly what plain-subagent-spawn-with-silently-discarded-`targetSessionKey` produces at the wire layer

This is the wire-layer attestation of the same substrate-finding closed at rung 3 (`task_runs.runtime = subagent`, `child_session_key = <new subagent>` instead of `<named target>`). The (intended/bug) discriminator is now closed at rungs 3 AND 4 simultaneously, both pointing at (bug)-shape: `targetSessionKey` is accepted on the tool surface, persisted in `state_json`, and silently discarded at runtime spawn-routing — and consequently no multi-span trace topology forms either.

## Why this matters for §6.8

§6.8's verification contract specifically promises:

> A single integration test that traces a 3-hop chain across one cross-session targeted return + one fan-out broadcast + one post-restart replay, and asserts the rendered trace tree has the expected parent-edge topology, is sufficient to validate the contract end-to-end.

The wire-layer evidence here shows the contract is **not yet satisfiable end-to-end on canonical `f39b8c9751`**: the 3-hop chain doesn't form because the cross-session router doesn't fire. The §6.8 wiring landed (#560) and the trace-context propagation contract (#555) is in canonical, but the substrate that consumes `targetSessionKey` and routes the spawn to the named session — the layer that would produce D1→D2→Q→S parent edges — is not wired through.

This is the runtime-fix-needed-before-ship branch of the cohort decision shape (option 1 in `state.md`'s closure section), with both registry-layer AND wire-layer evidence behind it.

## Verdict at rung 4

🔴 wire/OTel layer confirms (bug)-shape: single-span traces only, no §6.8 multi-span topology forms. Substrate-finding now has 5-layer convergent attestation (status / flow_runs / task_runs / OTel / cohort multi-seat byte-pin), all consistent with `targetSessionKey` silently discarded at runtime spawn-routing.

## Sharpening: dispatcher/drain visibility is real; the stitched multi-span story is what's missing

elliott-seat phrasing (msg `1500678...`): *"so dispatcher/drain visibility is real in Tempo now; what's still missing is the stitched multi-span story. That's a good narrower state than 'nothing there.'"*

The OTel-emit side from #560 is **working as designed** for plain subagent spawn. `continuation.delegate.dispatch` and `continuation.queue.drain` spans really do emit, really do show up in Tempo, and really do carry per-span attributes. That's not where the gap is.

The gap is one layer up: the spawn-routing layer that would actually consume `state_json.targetSessionKey` and route the dispatch through a cross-session router. Without that layer firing, no D1→D2→Q→S parent edges form, and the trace tree never grows past depth 1 — not because the wiring is broken, but because the work that would create the children never runs.

This sharpens the cohort-decision-shape: option (1) (runtime fix before ship) is **specifically a fix at the spawn-routing layer** (rung 3), NOT at the OTel-emit layer (rung 4). #560 / #555 are doing their jobs correctly. #580's surface-of-fix is `dispatchToolDelegates(...)` + `spawnSubagentDirect(...)`-adjacent code, not the tracer adapter.

Cohort decision pending figs's eye on (1) runtime fix before ship vs (2) tool description re-cast.
