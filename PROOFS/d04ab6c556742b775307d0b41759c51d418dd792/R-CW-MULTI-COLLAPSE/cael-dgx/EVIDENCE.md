# R-CW-MULTI-COLLAPSE — cael-dgx: partial-success-on-cap-trip via high-N bypass (ship-SHA 749f95b)

**Seat:** cael-dgx (DGX Spark GB10, ARM64)
**Ship-SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772`
**Row:** R-CW-MULTI-COLLAPSE — when a later election trips the cap, the EARLIER valid elections MUST stay scheduled (no silent-all-drop). The `work-dispatch.ts` regression-guard: "when a later election trips the cap, the earlier valid elections MUST stay scheduled — silently dropping them is exactly the regression this batches against."
**Verdict:** ✅ PASS — partial-success-on-cap-trip proven: 32 scheduled + 8 capped, ZERO silently-dropped. Bypass-able via high-N child (NOT drain-gated).

## The fire (N=40 in one fresh-subagent turn, to exceed the cap)
Fired 40 `continue_work` in one fresh-subagent turn (`agent:main:subagent:9d29dcd5...`, own key), intended to exceed the per-session continuation cap (32).

## DISPOSITIVE BYTE (from flow_runs DB — the byte CAUGHT what the subagent surface-report MISSED)
```
status         distinct_flow_runs
succeeded      9    (driving — earlier elections matured + drove their hop-2)
queued         23   (scheduled, releasing)
distinct_total 32   ← THE CAP
```
**40 fired → exactly 32 distinct flow_runs scheduled (the cap) + 8 capped (fires 33-40 tripped the cap, no flow_runs created).** This IS the partial-success-on-cap-trip: the earlier 32 valid elections stayed scheduled (9 already drove `succeeded`), the later 8 tripped the cap, **ZERO silently dropped** — every fire accounted for. The exact regression-guard the work-dispatch.ts comment describes.

## Byte-discipline note
The fresh-subagent's SELF-REPORT claimed "40 scheduled, collapse-to-one continuation." The flow_runs DB byte shows **32 distinct = the cap-trip**. Verdict taken from the DB (the byte), not the surface-report (the relay). The high-N child tripped the cap WITHOUT the drain → bypass-able, drain-INDEPENDENT.

## Disposition
Bypass-able via high-N child (fire N > cap headroom from a fresh subagent). The cap-trip partial-success path exercised + proven without the #552 drain. drain unblocks ZERO rows.
