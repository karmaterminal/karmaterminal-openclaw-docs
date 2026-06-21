# R-CD-CHAINED-DEPTH-2 TEST-2 — inter-session return — rune-rog-ally seat (substituting for Silas-canary)

**Verdict: ✅ PASS** — `continue_delegate` cross-session targeted return delivers across the session boundary on the deployed fix.

- **Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64) — **substituting for 🌫 Silas (canary-seat)** per the runbook substitution-pattern (rune-rog-ally fires from own seat, evidence banded under the canonical TEST-2 path). Substitution-pattern precedent: 2026-06-03 `9684479` R-RC-1 lamp-substitution.
- **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
- **Fire time:** 2026-06-21 01:23:19 → 01:23:24 PDT
- **Marker:** `R-CD-DEPTH2-TEST2-ISR-1782030000`
- **Traceparent / trace-id:** `0f210bc474f95498a24dc17b78c56165`
- **Child session:** `agent:main:subagent:continuation-f00ca4bdde4fae8542140baf0964a474`

## What was fired

A `continue_delegate` with `targetSessionKey` set to the dispatching session, tasked to return a marker string back to that session (the inter-session-return path). This exercises TEST-2 of the depth-2 chain: inter-session return — a child's result routed across the session boundary via the `targetSessionKey` return-targeting (`resolveContinuationReturnTargetSessionKeys` → `enqueueSessionDelivery`).

## Evidence — the cross-session return delivered

**Gateway journal (`journal_intersession_return.log`):**
```
01:23:19 [continuation:delegate-spawned] hop=1/200 mode=normal session=…channel:1466192485…  ← delegate spawned (separate child session)
01:23:24 R-CD-DEPTH2-TEST2-RETURN-OK 1782030000 inter-session-return-from-depth2               ← child returned the marker
01:23:24 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485140… ← THE CROSS-SESSION RETURN LANDED
          from agent:main:subagent:continuation-f00ca4bdde4fae8542140baf0964a474
```

The `[continuation:targeted-return] Delivered to <dispatching session> from <subagent session>` line is dispositive: a SEPARATE delegate-child session's result was routed back ACROSS the session boundary to the targeted session via the `targetSessionKey` path, on the deployed ship SHA.

**Tempo trace (`intersession_return_trace.json`, 48 spans):**
- `http://tempo.dandelion.cult/api/traces/0f210bc474f95498a24dc17b78c56165`
- Spans include: `continuation.delegate.dispatch` (the spawn) + `continuation.queue.drain` (the session-delivery-queue drain — the targeted-return delivery mechanism) + `openclaw.run` ×2 (parent + child).

## Disposition

PASS (substituted by 🪨 Rune for 🌫 Silas). Cross-session targeted return (`targetSessionKey`) delivers across the session boundary on the deployed ship SHA — the `[continuation:targeted-return] Delivered` line confirms the inter-session-return path is intact + firing. (The #1063 lane-routing fix did not touch the return-targeting surface — different mechanism, both intact.)
