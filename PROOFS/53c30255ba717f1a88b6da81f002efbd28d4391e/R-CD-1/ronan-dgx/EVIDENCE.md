# R-CD-1 — continue_delegate(mode="normal") schedule→spawn→return (ronan-dgx, ship-SHA `749f95b9b10aa3bbb804856acacc9073043ee772`)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx (DGX Spark ARM64, gateway pid `3683825`) | **SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (deployed, gateway active) | **Verdict: ✅ PASS — normal-mode delegate scheduled, spawned, ran to completion, literal payload returned**

## Proof-scope
`continue_delegate(mode="normal")` schedule → spawn → run → return path at byte, on deployed `749f95b`:
- delegate-dispatch fires `continuation.delegate.dispatch` span (mode=normal)
- subagent spawns + runs under the same gateway-pid (`3683825`) to `openclaw.run`/`openclaw.harness.run` completion
- literal-string payload returns to the parent channel

## Fire (tool-form)
- `continue_delegate(task=[R-CD-1 PROOF FIRE…], mode="normal")` on deployed `749f95b`, status=`scheduled`, delegateIndex 1, parent traceparent `00-ccc0cbcba0bfbbf802f81cdd9573aa6e-…`
- parent_session_key: `agent:main:discord:channel:1466192485440164011`

## Spawn + run (journal evidence — `journal_spawn.log`, pid 3683825)
```
12:49:40.121 [continuation/delegate-dispatch] [continue_delegate] Consuming 3 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
12:49:40.390 [continuation:delegate-spawned] hop=1/200 mode=normal session=…1466192485440164011 task=R-CD-1 PROOF FIRE…
```

## Live-execution sentinel (`sentinel.txt` — turn-output, the delegate wrote it on its run)
```
R-CD-1-NORMAL-DROVE-749f95b ts=2026-06-21T19:49:46Z … pid=3683825
```
Written by the spawned subagent during its run = it executed live (not just scheduled).

## Return (literal payload to parent)
The subagent returned the exact literal payload to the parent channel: **"R-CD-1 normal-mode delegate executed live on 749f95b, sentinel written."** (completion event, runtime 8s, status=completed.)

## Tempo trace (`delegate_dispatch_trace.json`)
- **trace-id:** `ccc0cbcba0bfbbf802f81cdd9573aa6e` · http://tempo.dandelion.cult/api/traces/ccc0cbcba0bfbbf802f81cdd9573aa6e
- carries **`continuation.delegate.dispatch` span (mode=normal)** + `openclaw.harness.run` + `openclaw.run` + `openclaw.model.call` spans (the spawn→run→completion chain), host.name=`ronan`, arch=arm64, pid=3683825.

## Verdict: ✅ PASS — `continue_delegate(mode="normal")` schedule→spawn→run→return proven live on `749f95b` (dispatch span + journal spawn + live sentinel + literal payload return).

## Honest note
The `session=` field in the sentinel is empty (`$OPENCLAW_SESSION_KEY` not exported into the delegate shell) — the session-key is recovered from the journal spawn-line, not the env-var. Does not affect the live-execution proof (the sentinel timestamp + journal + dispatch span are dispositive).
