# R-CW-DELEGATE-SELF-CONTINUATION — rune-rog-ally seat

**Verdict: ✅ PASS** — a `continue_delegate` child self-continues via `continue_work` (hop-1 → elect → hop-2 drives) on the deployed fix.

- **Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64)
- **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5` (gateway working tree HEAD == ship SHA, verified `git rev-parse HEAD`)
- **Gateway:** pid 1782640, OpenClaw 2026.6.8, deployed at the ship SHA
- **Fire time:** 2026-06-21 01:09:59 → 01:10:20 PDT
- **Marker:** `R-CW-DELEGATE-SELFCONT-1782029353`
- **Traceparent / trace-id:** `9327d6531a29ebb9ad56e2ffba70a24f`
- **Child session:** `agent:main:subagent:continuation-3a6454fb930decead15851b17e76c4da`

## What was fired

A `continue_delegate` whose child (a subagent) was tasked to: (1) write a hop-1 marker file via exec, (2) elect a `continue_work` for itself (`delaySeconds=0`), (3) on the self-continued hop-2 turn, write a hop-2 marker file. This is the canonical #1057 self-continuation pattern: a delegate-child claims another turn under its own steam via `continue_work`.

## Evidence — the chain fired end-to-end

**Marker files (`hop1.txt` / `hop2.txt`):**
```
HOP1 R-CW-DELEGATE-SELFCONT-1782029353 1782029403          ← hop-1 ran (01:10:03)
HOP2-DROVE R-CW-DELEGATE-SELFCONT-1782029353 1782029420    ← hop-2 DROVE (01:10:20)
```
Both files present → the child self-continued past hop-1. The #1057 regression (hop-1-only, no hop-2 drive) is GONE on the deployed head.

**Gateway journal (`journal_continuation.log`) — the self-continuation sequence:**
```
01:10:11 [continuation:trace] effective-signal: origin=tool-call kind=work session=…continuation-3a6454fb…   ← child elected continue_work (TOOL form)
01:10:11 [continuation:work-hedge-armed] fireIn=4998ms                                                        ← hedge armed (5s, the delaySeconds=0 clamp)
01:10:16 [continuation:work-hedge-fired]                                                                      ← hedge fired
01:10:16 [continuation:work-wake] hop=1/200                                                                   ← work-wake → hop-2 drove
```
`origin=tool-call kind=work` confirms the TOOL-form `continue_work()` election (not bracket). The wake fired + drove the hop-2 turn (which wrote `hop2.txt`). No `work-drive-skipped` — the subagent drove on its own session lane (the #1063 lane-routing: `continuationLane = resolveSessionLane`, the gate's first clause false for the subagent → bypassed → drives).

**Tempo trace (`selfcont_trace.json`, 32 spans):**
- `http://tempo.dandelion.cult/api/traces/9327d6531a29ebb9ad56e2ffba70a24f`
- Span hierarchy includes: `continuation.delegate.dispatch` (the spawn) → `openclaw.run` ×2 (hop-1 + hop-2 turns) → `continuation.work` (the continue_work election/drive) → `openclaw.harness.run` ×2, `openclaw.model.call` ×12, `openclaw.tool.execution` ×10.
- The `continuation.delegate.dispatch` → `continuation.work` → second `openclaw.run` chain is the byte-stitched proof of the self-continuation across the two hops.

## Disposition

PASS. On the deployed ship SHA `93ace21`, a delegate-child's `continue_work` (tool-form) self-continuation drives hop-2 to completion. The thing figs named broken ("keeps stranding subagents past hop-1") runs and drives.

(Note: this row covers the **tool-form** `continue_work()` self-continuation. The **token-form** `[[CONTINUE_WORK]]`-from-subagent path is a separate row — `R-CW-DELEGATE-TOKEN` / the #952 token-row — and is blocked on a figs ship-decision: the token-fix `b1dc30e6f0` rode the un-deployed `3ae2d4c` line, so token-form-from-child is DECLINED on `93ace21` (`subagent-announce.ts:977`). See the R-CW-DELEGATE-TOKEN row.)
