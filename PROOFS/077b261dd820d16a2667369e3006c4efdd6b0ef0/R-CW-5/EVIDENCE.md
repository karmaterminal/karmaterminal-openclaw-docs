# R-CW-5 — continuation dispatch REJECT on cap exhaustion

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed)
**Verdict:** ✅ PASS (dispatch-reject-on-cap mechanism proven) · HONEST-LIMIT: pending-cap, not costCapTokens specifically

## Evidence (journal, `pending_cap_reject_evidence.txt`)
```
2026-06-15T17:12:03.138-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32
```

## What this proves
1. **Continuation dispatch is CAP-GATED and REJECTS at the ceiling** — on the deployed `077b261dd8` build, `continue_work` dispatch hit the per-session pending-work cap (`32/32`) and the gateway emitted `[continuation:work-rejected] pending-capped`, refusing to enqueue beyond the cap. The bounded-continuation invariant (the gateway enforces caps, not unbounded fan-out) is live + working on the deployed bytes.
2. **Graceful reject (not crash)** — the reject is a clean logged refusal at the cap boundary, exactly the cooperative-bounding the continuation design specifies.

## HONEST-LIMIT
This is the **pending-work cap** (`32/32`, a per-session in-flight ceiling), a sibling of — not identical to — the `costCapTokens` cap (`500000` on cael-seat). Both are dispatch-reject-on-cap of the same class (the gateway refuses dispatch when a configured continuation limit is reached), but this byte specifically exercises the pending-cap. Exhausting `costCapTokens=500000` to observe the cost-cap-specific reject line requires a deliberate high-token continuation chain not naturally produced in this session. The **mechanism** (cap → logged dispatch-reject) is proven; the specific cost-token-exhaustion variant is the deliberate-condition extension.
