# R-CW-5 — continuation dispatch REJECT on cap exhaustion

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed — `OpenClaw 2026.6.8 (8cafdcd)`, FF'd ship-tip)
**Seat:** cael-dgx (DGX Spark GB10, arm64, MainPID 57194)
**Verdict:** ✅ PASS (dispatch-reject-on-cap mechanism proven, live on ship-tip) · HONEST-LIMIT: pending-cap variant, not `costCapTokens`-specific

## Evidence (journal, `pending_cap_reject_evidence.txt`)
```
2026-06-17T04:00:10.287-07:00 [continuation:trace] effective-signal: origin=tool-call kind=work session=agent:main:discord:channel:1466192485440164011
2026-06-17T04:00:10.313-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32
```
A live `continue_work` tool-call (`origin=tool-call kind=work`) fired on the deployed `8cafdcd` runtime → dispatch hit the per-session pending-work ceiling (`32/32`) → gateway emitted `[continuation:work-rejected] pending-capped` and refused to enqueue beyond the cap.

## What this proves
1. **Continuation dispatch is CAP-GATED and REJECTS at the ceiling** — on the deployed `8cafdcd` build, `continue_work` dispatch hit the per-session pending-work cap (`32/32`) and the gateway refused to enqueue beyond it. The bounded-continuation invariant (the gateway enforces caps, not unbounded fan-out) is live + working on the deployed bytes.
2. **Graceful reject (not crash)** — the reject is a clean logged refusal at the cap boundary, exactly the cooperative-bounding the continuation design specifies. The session continued normally.

## HONEST-LIMIT
This is the **pending-work cap** (`32/32`, a per-session in-flight ceiling), a sibling of — not identical to — the `costCapTokens` cap (`500000` on cael-seat, byte-confirmed in live config). Both are dispatch-reject-on-cap of the same class (the gateway refuses dispatch when a configured continuation limit is reached); this byte specifically exercises the **pending-cap**. Exhausting `costCapTokens=500000` to observe the cost-cap-specific reject line requires a deliberate high-token continuation chain not naturally produced in this corpus-fill session. The **mechanism** (cap → logged dispatch-reject) is proven on `8cafdcd`; the specific cost-token-exhaustion variant is the deliberate-condition extension. This matches the `077b261dd8` exemplar's R-CW-5 honest-limit exactly (the exemplar likewise captured the `32/32` pending-cap as the dispatch-reject-on-cap representative).

🩸 Cael — R-CW-5 dispatch-reject-on-cap PASS on `8cafdcd`; `[continuation:work-rejected] pending-capped 32/32`, graceful logged refusal.
