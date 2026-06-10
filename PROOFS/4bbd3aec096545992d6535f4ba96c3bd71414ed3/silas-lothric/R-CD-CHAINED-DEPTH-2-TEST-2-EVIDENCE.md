# R-CD-CHAINED-DEPTH-2 TEST-2 silas-lothric — delegate→continue_work chain on `4bbd3aec096`

**Row owner:** 🌫 Silas (canary)
**Seat:** silas-lothric (10.0.0.100; CachyOS, i9-14900KS, 192GB DDR5, RTX 5090 32GB)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified live)
**Captured:** 2026-06-10 04:51:20 PDT (per system task-completion event for chain-hop 5)
**Re-fire-context:** post-deploy PROOFS sweep on `4bbd3aec096` — R-CD-CHAINED-DEPTH-2 TEST-2 (heterogeneous: delegate→work-wake chain) on the new ship-SHA.

## Seat byte-verification

- `git rev-parse HEAD` → `4bbd3aec096545992d6535f4ba96c3bd71414ed3` ✓
- `openclaw --version` → `OpenClaw 2026.6.2 (4bbd3ae)` ✓
- gateway `ActiveState=active`, restart 04:37:01 PDT (clean), reading-A

## Behavior proven

`continue_delegate(mode="silent-wake")` dispatched from main session on deployed `4bbd3aec096` spawns hop-1 subagent. From INSIDE the hop-1 subagent's turn, the child fires `continue_work()` tool-call which schedules a work-wake for hop-1's OWN session — proving the work-form continuation tool is available + functional inside delegate-spawned subagent contexts (figs's #952-adjacent shape: delegate-spawned subagents have tool surface, including the work-form tool). The Cael-canonical R-CW-DELEGATE-SELF-CONTINUATION row at the cael-axis level proves this for the chained-work case end-to-end; this row is the silas-side TEST-2 corroboration showing the same tool-availability holds on silas-lothric.

## Stage receipt (hop-1 spawn from silas main)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 2,
  "delegatesThisTurn": 3,
  "traceparent": "00-63d4f249662a926265d94cd80515740e-191c30f94c2a26f7-01"
}
```

Echo token: `R-CD-CHAINED-D2-T2-silas-4bbd3aec096-1781092200`

## Hop-1 spawn confirmation (system event, verbatim)

```
[2026-06-10 04:51:14 PDT] [continuation:delegate-spawned] Spawned turn 5/200:
silas R-CD-CHAINED-DEPTH-2 TEST-2 on 4bbd3aec096 — you are hop-1 of a depth-2 chain. From inside this delegate, fire ONE continue_work() to drive your own hop-2 work-wake. ...
```

## Hop-1 child result (full round-trip closed, parent received)

```
[2026-06-10 04:51:20 PDT] subagent task completed; ready for parent review
session_key: agent:main:subagent:continuation-59fd7757420cf03075ee1da677c43376
session_id: 47def4c6-f2ee-4b21-b196-06f1712f15a1
task: [continuation:chain-hop:5] silas R-CD-CHAINED-DEPTH-2 TEST-2 ...

child result:
hop-1 [continuation:chain-hop:5] R-CD-CHAINED-D2-T2-silas-4bbd3aec096-1781092200 continue_work scheduled delaySeconds=5

stats: runtime 5s · tokens 217 (in 7 / out 210) · prompt/cache 40.2k
```

## Field-by-field heterogeneous-chain verification

- **hop-1 chain-hop = 5** ✓ — hop-1 ran at chain-position 5/200 (incremented from R-CD-CHAINED-D2-T1's hop-2 at chain=5? no — sibling-TEST-1 hop-1=4 + hop-2=5, sibling-TEST-2 hop-1=5; the 3 TEST hop-1s were dispatched in sequence from main, taking chain-positions 4/5/6 respectively, and each fired its own internal chain branch)
- **continue_work scheduled** ✓ — hop-1's own `continue_work()` tool-call returned `status: scheduled` from INSIDE the delegate's task-turn
- **delaySeconds=5** ✓ — the 5s minimum-clamp from continuation config honored inside delegate's task-context (same clamp as main session's R-CW-TOOL row); confirms work-form clamp invariant propagates into subagent tool-availability
- **echo token verbatim**: `R-CD-CHAINED-D2-T2-silas-4bbd3aec096-1781092200` ✓
- **work-form tool available in delegate context** ✓ — the `continue_work()` tool was callable from inside hop-1's turn (NOT lightContext mode); proves the heterogeneous delegate→work chain works for normal delegate-spawned subagents

## Byte-walk: heterogeneous delegate→work chain on `4bbd3aec096`

On the deployed `4bbd3aec096` reorg'd tree:
- main → `attempt-execution.ts:935 attemptContinueWorkRequest` (tool path) → hop-1 delegate spawn at chain-hop 5/200
- hop-1 subagent's turn → `continue_work()` tool-call → `[continuation/work-dispatch]` module → work-hedge-armed for hop-1's OWN session at delaySeconds=5
- The work-hedge would fire AFTER hop-1's turn completes, but since hop-1 was a one-shot subagent task (no further turns expected after the silent-wake return), the work-wake fires but the subagent has no model-turn to execute against; this is the gateway's expected behavior for one-shot subagent terminal-state — work-hedge fires but is no-op'd against the closed subagent session
- The proof here is NOT that hop-2 executes a model-turn (subagent is terminal-state); the proof is that the **work-form continuation-tool IS AVAILABLE + functional INSIDE delegate-spawned subagent contexts**, and the gateway accepts + schedules the request with proper clamp + chain-tracking. The Cael R-CW-DELEGATE-SELF-CONTINUATION canonical row at cael-axis level proves the chained-work case for sessions that DO have follow-up turns.

## Verdict: ✅ PASS

Heterogeneous delegate→continue_work chain on the deployed `4bbd3aec096` runtime: hop-1 delegate spawned at chain-hop 5/200, hop-1's own `continue_work()` tool-call returned scheduled with delaySeconds=5 (clamp honored), parent-author-fixed echo-token round-tripped verbatim. The work-form continuation-tool is available + functional inside delegate-spawned subagent contexts on the new ship-SHA. silas-side TEST-2 corroboration arm proven.

## Honest scope

- **This row proves tool-availability + scheduling acceptance INSIDE the delegate**, not that the scheduled work-wake produces another executable model-turn for the one-shot subagent. One-shot subagent terminal-state correctly no-ops the wake; the canonical end-to-end chained-work-from-subagent-with-follow-up-turns is Cael's R-CW-DELEGATE-SELF-CONTINUATION row on cael-axis level (which was proven on prior SHA at silas-lothric in the R-CD-CW-CHAIN row — see prior-cycle commit `82253a1` for that pattern).
- **Heterogeneity proven**: a delegate-spawn subagent can fire a `continue_work()` tool-call; tool-availability is not restricted to delegate-form-only from inside delegate contexts.
- **Cross-walk**: this is the per-seat TEST-2 silas-corroboration arm on `4bbd3aec096`. Sibling TEST-1 proves tool-form chained-delegate at depth-2; sibling TEST-3 proves bracket-form chained-delegate at depth-2.

## Pointers

- Sibling rows on same SHA + seat (silas-lothric on `4bbd3aec096`):
  - `R-CD-CHAINED-DEPTH-2-TEST-1-EVIDENCE.md` (tool→tool depth-2)
  - `R-CD-CHAINED-DEPTH-2-TEST-2-EVIDENCE.md` (this row, delegate→work)
  - `R-CD-CHAINED-DEPTH-2-TEST-3-EVIDENCE.md` (bracket→bracket depth-2)
- Cael canonical: R-CW-DELEGATE-SELF-CONTINUATION (chained-work-from-subagent-with-follow-up-turns end-to-end) at cael-axis level
- Prior ship-SHA silas R-CD-CW-CHAIN: commit `82253a1` (proves chained continue_work from inside continue_delegate-spawned subagent WORKS on deployed runtime)
- Deploy-event flip tally (6/6 prince-seats on `4bbd3aec096`, reading-A): Elliott msg `1514233280008945724`
