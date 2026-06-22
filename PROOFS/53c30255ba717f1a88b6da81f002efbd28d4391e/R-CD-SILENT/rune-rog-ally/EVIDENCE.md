# R-CD-SILENT — continue_delegate(mode="silent") negative-wake-guard (rune-rog-ally)

**Seat:** rune-rog-ally (Ryzen Z1 Extreme, x86)
**SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (OpenClaw 2026.6.9)
**Disposition:** ✅ **PASS** — silent-mode delegate returns via `enqueueSystemEvent()` with the wake (`requestHeartbeatNow`) STRUCTURALLY gated off; proven empirically (dispatch + trace) AND at the source byte.
**Filed by:** rune-dandelion-cult
**Substitution:** rune-rog-ally firing for ronan-dgx (R-CD-family canonical owner) per figs's split-not-lock (`1518337097`); Ronan retained R-CD-3 (post-compaction) + the vitest/ARM64 worker-probe. Closes the silent/non-wake register-mode gap Frond identified (`1518339219`, PR openclaw-bootstrap#1226) so `continue_delegate` register-mode coverage has zero gaps per figs's "no gaps on signature-feature elements."

## What R-CD-SILENT tests
The **silent / non-wake** register mode of `continue_delegate` — distinct from silent-**wake** (R-CD-2). Both return the child's result silently (via the system-event queue, invisible to channel); the **load-bearing difference is the NEGATIVE wake-guard**: mode=silent must NOT wake the parent (no `requestHeartbeatNow` / no heartbeat span) — the parent consumes the return on its own later turn. That absence-of-wake is what splits silent from silent-wake.

## Proof — three converging bytes

### 1. Dispatch tool-return (empirical, the silent-mode dispatch)
`continue_delegate(mode="silent")` returned:
```json
{
  "status": "scheduled",
  "mode": "silent",                       ← silent, NOT silent-wake
  "delaySeconds": 0,
  "traceparent": "00-9f8e139f555ca6a32d60eb0c5986d701-0a809d1d783ed58b-01",
  "note": "Delegate will be dispatched after your response completes."   ← dispatched AFTER the turn, no mid-turn wake
}
```
Marker: `R-CD-SILENT-rune-20260621T214201Z-66880873` (`marker-id.txt`). The "dispatched after your response completes" + mode=silent (not silent-wake) = the silent return does not pre-empt/wake the parent's turn.

### 2. Trace (empirical, the negative guard) — `silent_dispatch_trace.json`
traceId `9f8e139f555ca6a32d60eb0c5986d701`, 9 spans, pulled live from Tempo. Span names: `openclaw.context.assembled`, `openclaw.model.call`, `openclaw.tool.execution`, `openclaw.message.delivery` — **ZERO wake/heartbeat spans** (no `requestHeartbeatNow`, no heartbeat-wake). The negative wake-guard is observable as the absence of any wake span on the silent-dispatch path.

### 3. Source byte (structural, the DISPOSITIVE negative-wake-guard) — `subagent-announce.ts:1571-1589`
```js
// Inject completion as system event (invisible to channel).
const enrichmentText = triggerMessage || `[continuation:enrichment-return] Delegate completed: ${taskLabel}`;
enqueueSystemEventLazy(enrichmentText, {            // ← the SILENT return — ALWAYS happens (silent AND silent-wake)
  sessionKey: targetRequesterSessionKey, trusted: true, ...
});
...
if (params.wakeOnReturn) {                           // ← THE GATE: wake ONLY when wakeOnReturn (= silent-wake)
  const { requestHeartbeatNow } = await import("../infra/heartbeat-wake.js");
  requestHeartbeatNow({                              // ← the WAKE, gated behind wakeOnReturn
    sessionKey: targetRequesterSessionKey,
    reason: "silent-wake-enrichment", ...
  });
}
```
The `enqueueSystemEventLazy` (the silent return) is **unconditional**; the `requestHeartbeatNow` (the wake) is **gated behind `if (params.wakeOnReturn)`**. So:
- **mode=silent** → `wakeOnReturn=false` → `enqueueSystemEvent` return, **`requestHeartbeatNow` SKIPPED** = NO wake ✅ (negative guard)
- **mode=silent-wake** (R-CD-2) → `wakeOnReturn=true` → `enqueueSystemEvent` return **+ `requestHeartbeatNow`** = wakes the parent

The `if (params.wakeOnReturn)` branch IS the structural split Frond named. The wake's `reason: "silent-wake-enrichment"` confirms the wake belongs to silent-wake only.

## Net
`continue_delegate(mode="silent")` returns silently via `enqueueSystemEvent()` and does NOT wake the parent — the wake (`requestHeartbeatNow`) is structurally gated behind `wakeOnReturn` (`:1582`), which silent does not set. Proven three ways: the dispatch tool-return (mode=silent, dispatched-after-turn), the live trace (zero wake spans), and the source byte (the `if(wakeOnReturn)` gate). The negative wake-guard holds. R-CD-SILENT PASS — the silent/non-wake register mode is gap-closed; `continue_delegate` register-mode coverage (normal=R-CD-1 / silent=R-CD-SILENT / silent-wake=R-CD-2 / post-compaction=R-CD-3) is complete.
