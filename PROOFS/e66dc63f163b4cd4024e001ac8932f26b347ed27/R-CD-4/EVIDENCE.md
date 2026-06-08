# R-CD-4 — continue_delegate cross-session targeted return via targetSessionKey

**Row owner:** 🌊 Ronan · **Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `e66dc63f163b4cd4024e001ac8932f26b347ed27` (`OpenClaw 2026.6.2`)
**Deployed gateway:** pid 1581565, restarted 2026-06-08 07:18:28 PDT (fresh, clean)
**Fired:** 2026-06-08 ~07:43 PDT

## Behavior proven
`continue_delegate(targetSessionKey=...)`: the delegate's **return (result)** is routed to an explicit target session (cross-session targeted RETURN), proven by the runtime's own delivery log — NOT the tool-surface echo, NOT the delegate's parroted text. Tested against the LIVE deployed candidate `e66dc63f`.

**Scope discipline (carried from the `2807efc` history of this row):** this row proves **RETURN-routing** (where the delegate's *result* lands), code at `subagent-announce.ts:1333-1365`, proof = the `[continuation:targeted-return] Delivered to <target> from <child>` log. It does **NOT** prove EXECUTION/spawn-routing (which session *runs* the child) — that is `karmaterminal/openclaw#580`'s separate layer, which stays **OPEN** (its "recipient-owned flow_run" premise predates the flows-registry migration; re-eval flagged, not asserted-closed).

## Leg 1 — Fire receipt (targetSessionKey echoed — tool-surface, necessary-not-sufficient)
```json
{
  "status": "scheduled",
  "mode": "silent",
  "delegateIndex": 2,
  "delegatesThisTurn": 2,
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "traceparent": "00-45e5bc5416b86cc65f6b5e18cf01b50d-5fc6851830660d9f-01"
}
```
- **targetSessionKey echoed** ✓ — but per this row's own #580 finding, tool-surface-accept is EXACTLY the deceptive layer #580 names (present even when runtime-routing fails). The PASS does NOT rest on this — it rests on the runtime Delivered log below.

## Leg 2 — THE REAL PROOF: runtime `[continuation:targeted-return] Delivered` log (subagent-announce.ts:1365)
Captured from `journalctl --user -u openclaw-gateway` (full causal block in `targeted_return_delivery_journal.txt`), gateway pid 1581565, live `e66dc63f`:
```
07:43:10.248 [continuation:delegate-spawned] hop=5/200 mode=silent session=… task=[R-CD-4 RETURN-ROUTING certification child | echo-token: RCD4-e66dc63f]
07:43:13.742 RCD4-RETURN echo=RCD4-e66dc63f child→target routed          ← leaf's parroted echo (DELIBERATELY NOT the evidence)
07:43:13.840 [subagent-chain-hop] Accumulated 32 tokens … to parent chain cost
07:43:13.843 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-f0e624b208780c018c1900d8d432221a   ← THE PROOF
```
- **`to` = `agent:main:discord:channel:1466192485440164011`** — the explicit cross-session `targetSessionKey` I set ✓
- **`from` = `agent:main:subagent:continuation-f0e624b2...`** — my distinct subagent session ✓
- **to ≠ from** (distinct sessions) = genuine cross-session RETURN, not a self-loop ✓
- **`[continuation:targeted-return]`** (not the dispatcher-default `[continuation:enrichment-return]` at `:1414`) — the targeted-return path ✓
- The Delivered line is emitted by the runtime **independent of the delegate's text**. The leaf's `RCD4-RETURN echo=…` line is the delegate parroting my instruction and is **deliberately NOT the evidence** (heeding the hollow-TEST-2 coverage-faking trap — the delegate's words can be made to say anything; the runtime's own Delivered log cannot).

## Leg 3 — flows-migration scoping re-verified on e66dc63f (load-bearing for the #580 layer-distinction)
- `~/.openclaw/flows/registry.sqlite.migrated` (+ `-shm`/`-wal` `.migrated`) — flows registry renamed-dormant (May 31), no active `registry.sqlite`.
- `grep -rnE 'owner_key|flows/registry|flowRun|flow_run' src/auto-reply/continuation/ src/agents/subagent-announce.ts` → **zero hits** (re-verified this turn on `e66dc63f`). The active return-routing path uses subagent-registry + delivery-queue (`subagent-announce.ts:1333` resolve → `:1341` resolveContinuationReturnTargetSessionKeys → `:1352` enqueueContinuationReturnDeliveries → `:1365` Delivered-log), NOT the flows registry.
- ∴ #580's "recipient-owned flow_run" premise probes a migrated-away mechanism; moot for the *active* RETURN-routing path, orthogonal to the EXECUTION/spawn layer #580 concerns. #580 stays correctly **OPEN + separate-layer**.

## Tempo trace captured
- trace_id: `45e5bc5416b86cc65f6b5e18cf01b50d`
- Fetched: `http://tempo.dandelion.cult/api/traces/45e5bc5416b86cc65f6b5e18cf01b50d` → `r-cd-4_targetsession_trace.json` (39496 bytes)
- Resource: `process.pid=1581565` (the deployed gateway on `e66dc63f`), 15 batches.
- The `continuation.delegate.dispatch` span carries **mode=silent + reason.preview="[R-CD-4 RETURN-ROUTING certification child | echo-token: RCD…"** — the in-band echo-token confirms the trace corresponds to exactly this fire. Span set: `continuation.delegate.dispatch` → `continuation.queue.drain` → `continuation.work` → `openclaw.harness.run`/`run`/`model.call`/`tool.execution`.

## R-CD-4 FINAL VERDICT: ✅ PASS — RETURN-routing (scoped, certified to the runtime delivery log)
`continue_delegate(targetSessionKey)` **return-routing** works live on the deployed candidate `e66dc63f` (pid 1581565): the return delivered to the explicit cross-session target via the runtime's own `[continuation:targeted-return] Delivered to <target> from <child>` log (distinct to/from sessions), independent of the delegate's parroted echo. Certified to the TRUE bar — the runtime delivery log, NOT the tool-surface echo (the masked-regression trap this exact row taught the cohort at `2807efc`). Scope precise: proves RETURN-routing (result→target); makes NO claim about EXECUTION-routing (#580's separate layer, stays OPEN). The byte RUN is the cert.
