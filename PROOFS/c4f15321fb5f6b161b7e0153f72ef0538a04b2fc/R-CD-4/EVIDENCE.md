# R-CD-4 — continue_delegate targeted RETURN via targetSessionKey — FRESH exact-SHA on c4f15321

**Row owner:** 🌊 Ronan · **Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `c4f15321fb5f6b161b7e0153f72ef0538a04b2fc` (`OpenClaw 2026.6.2`) — **fresh exact-SHA, proof-SHA == deployed runtime-SHA** (clawsweeper-valid)
**Fired:** 2026-06-08 21:47:35 PDT (dispatched after the dispatching turn completed)

## Behavior proven
`continue_delegate(targetSessionKey=...)`: the delegate's **return (result)** is routed to an explicit target session via the runtime's own delivery log — NOT the tool-surface echo, NOT the delegate's parroted text. **SCOPE: same-session targeted-return** (the explicit `targetSessionKey` == the dispatching session). Tested fresh on the LIVE deployed ship-SHA `c4f15321fb`.

## Leg 1 — Fire receipt (tool-surface, necessary-not-sufficient — `dispatch-trace.txt`)
```json
{ "status": "scheduled", "mode": "silent", "delegateIndex": 2,
  "targetSessionKey": "agent:main:subagent:0166e10f-2018-4fa8-a670-bc5933f1453c",
  "traceparent": "00-a00118d68efa6335cb29cbcb03dcdc8c-7f4a88dfb45b703a-01" }
```
`targetSessionKey` echoed — but tool-surface-accept is the deceptive layer (present even when runtime-routing fails). The PASS does NOT rest on this — it rests on the runtime Delivered log below.

## Leg 2 — THE REAL PROOF: runtime `[continuation:targeted-return] Delivered` log (`targeted-return-journal.txt`)
Captured from `journalctl --user -u openclaw-gateway`, gateway live on `c4f15321fb`:
```
21:47:35  [continuation:delegate-spawned] hop=2/200 mode=silent
          session=agent:main:subagent:0166e10f-2018-4fa8-a670-bc5933f1453c
          task=PROOF-MARKER-RONAN-RCD4-c4f15321 ...
21:47:39  PROOF-MARKER-RONAN-RCD4-RETURN-c4f15321: targeted-return via targetSessionKey
          landed on c4f15321fb ... (same-session scope: target==dispatcher).
21:47:39  [continuation:targeted-return] Delivered to
          agent:main:subagent:0166e10f-2018-4fa8-a670-bc5933f1453c
          from agent:main:subagent:continuation-09f68dc5d1f5ec0020a710adc4a3d2f1
```
- **`[continuation:targeted-return] Delivered to <target> from <child>`** ✓ — the runtime delivery-log byte (subagent-announce.ts targeted-return path). The delegate's RESULT was routed to the explicit target session by the runtime, NOT just echoed at the tool surface.
- Target (`0166e10f`) == the dispatching session ✓ — confirms **same-session** scope.
- Marker `PROOF-MARKER-RONAN-RCD4-RETURN-c4f15321` returned verbatim ✓.

## Honest scope (carried from e66dc63f R-CD-4 correction — byte over my own read)
This row proves **same-session targeted-RETURN** (target == dispatcher). `hasCrossSessionDelegateTargeting(target, dispatchingSessionKey)` (`targeting-pure.ts:43`) returns **FALSE when target == dispatcher** → this took the **non-policy-gated same-session** targeted-return path, so the Delivered-log fired. A **genuinely-cross-session** target (target ≠ dispatcher) routes through the cross-session **policy-guard** and behaves differently — **Silas's intersession sub-row covers that surface**. This row does NOT prove genuinely-cross-session routing, and does NOT prove EXECUTION/spawn-routing (which session *runs* the child — `karmaterminal/openclaw#580`'s separate, still-OPEN layer).
