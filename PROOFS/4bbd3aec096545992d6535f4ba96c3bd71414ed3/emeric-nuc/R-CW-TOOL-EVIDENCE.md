# R-CW-TOOL emeric-nuc — `continue_work()` self-continuation fire on `4bbd3aec096`

**Row owner:** 🕯 Emeric (emeric-nuc) — dual-seat second to silas-lothric R-CW-TOOL
**Seat:** emeric-nuc (dist-loading shape)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified)
**Captured:** 2026-06-10 ~04:46 PDT

## Behavior proven

`continue_work(reason)` tool-call exercises the self-continuation scheduling path on the deployed `4bbd3aec096` binary — distinct from `continue_delegate`'s delegate-spawn paths. The scheduled self-continuation wakes the firing session's OWN next turn (not a subagent). delaySeconds requested 0 → clamped to 5s by continuation config (proves the clamp-floor wiring).

## Tool call emitted

```json
{
  "tool": "continue_work",
  "reason": "PROOF-FIRE R-CW-TOOL (emeric-lane, live continue_work self-continuation on deployed 4bbd3aec096). Echo token R-CW-TOOL-emeric-4bbd3aec096-1781093560. …"
}
```

Tool response:
```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "note": "Requested 0s, clamped to 5s by continuation config.",
  "traceparent": "00-417efa66d5e171d7c2f91c5b2f2f087b-906dff9bfef383d4-01"
}
```

## Round-trip

- **dispatch-half**: tool returned `status: scheduled`, delay 0→5s clamped, traceparent `417efa66d5e171d7c2f91c5b2f2f087b` allocated by the deployed binary ✓
- **wake-half**: the scheduled self-continuation woke emeric's own next turn ~5s post-dispatch (in-window) — the continuation-scheduling path fired on live `4bbd3ae` ✓
- echo `R-CW-TOOL-emeric-4bbd3aec096-1781093560` carried through the continuation reason ✓

## Verdict: ✅ PASS

`continue_work()` self-continuation scheduling path fires on the deployed `4bbd3aec096` runtime on emeric-nuc: dispatch-receipt confirmed (scheduled + traceparent + 5s clamp), self-wake landed in-window. Dual-seat confirmed with silas-lothric (whose journalctl additionally captured the granular `[continuation:work-hedge-armed] fireIn=4999ms` → `[continuation:work-wake] hop=N/200` chain).

## Honest scope

Dispatch-receipt + in-window self-wake are the primary emeric artifact; the full `continuation.*` span-tree (work-hedge-armed → work-hedge-fired → work-wake) is the scribe-side Tempo pull on `417efa66…` (emeric-seat cannot reach Tempo to self-capture). This is the self-continuation path, NOT a subagent-spawn — distinct from R-CD-TOOL/R-CD-TOKEN.
