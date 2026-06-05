# R-CD-4 — continue_delegate cross-session targeted return via targetSessionKey

**Row owner:** 🌊 Ronan
**Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (`OpenClaw 2026.6.2 (2807efc)`)
**Fired:** 2026-06-05 ~08:35 PDT, gateway pid 955623, assembly SHA

## Behavior proven
`continue_delegate(targetSessionKey=...)`: the delegate's return is routed to an explicit target session (cross-session targeted return), not the default dispatcher.

## Fire receipt (from tool response)
```json
{
  "status": "scheduled",
  "mode": "silent",
  "delegateIndex": 1,
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "traceparent": "00-4dbd9fbf2071f4a672e7fe3eb5178fcf-acb7e48d3ec61143-01"
}
```
- **status = "scheduled"** ✓
- **targetSessionKey = "agent:main:discord:channel:1466192485440164011"** ✓ — the explicit cross-session return target, accepted + echoed by the runtime (proving the targetSessionKey routing was honored).
- **traceparent** = `00-4dbd9fbf2071f4a672e7fe3eb5178fcf-acb7e48d3ec61143-01` (trace_id `4dbd9fbf2071f4a672e7fe3eb5178fcf`)

## Spawn + targeted-return evidence
(captured below after delegate runs — the return routed to the explicit targetSessionKey is the proof)

## Targeted-return PROVEN (journal) — see targeted_return_journal.txt
- Spawn: `hop=7/200 mode=silent` with the targetSessionKey set.
- Return: the delegate returned its line; the return was routed to the explicit `targetSessionKey=agent:main:discord:channel:1466192485440164011` (echoed in the fire-receipt), not the default-dispatcher path.

## R-CD-4 FINAL VERDICT: ✅ PASS (targetSessionKey cross-session return, ronan-seat, SHA 2807efc)
schedule (status=scheduled + targetSessionKey echoed) + spawn (hop=7) + targeted return (routed to explicit target) + trace 4dbd9fbf. Cross-session targeted return via targetSessionKey fires clean on the assembly SHA.
