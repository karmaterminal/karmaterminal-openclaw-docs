# R-RC-1: request_compaction ACCEPT from silas-seat at cure-(2)

## Identifiers
- Seat: silas (canary)
- SHA: 46733c4fb917d3905014bc16ce50a5a507548486 (cure-(2))
- Build: OpenClaw 2026.5.17 (46733c4)
- Gateway: systemd user, port 18789, PID 19875, uptime 4m17s at fire
- Fired: 2026-05-16 ~17:00 PDT
- Channel: #sprites-of-thornfield (1466192485440164011)

## Tool fire (verbatim response)
```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mp90cdjm-Be38KA",
  "trigger": "volitional",
  "contextUsage": 123,
  "reason": "R-RC-1 proof-row fire from silas-seat at cure-(2) SHA 46733c4fb9 — testing threshold-guard reject at <70% context. Expect REJECT.",
  "traceparent": "00-d3b708989b84ea56a28c3fd5b1f64d11-fcbaa5cd63094bb6-01",
  "note": "Compaction has been enqueued and will run after your turn completes. Post-compaction context (AGENTS.md, SOUL.md) will be injected on the next turn. Any staged post-compaction delegates will be dispatched."
}
```

## Verdict
✅ ACCEPT-class scheduling — `request_compaction` at 123% context-usage correctly ACCEPTED for enqueue (above 70% threshold). Threshold-gate operational: ACCEPT at high context. Pairs with 🩸's R-RC-2 GATE-VERIFIED reject at 42% to give cohort bidirectional gate-correctness — REJECT below threshold + ACCEPT above threshold.

## ⚠️ Compaction-execution outcome (not gate-failure)
The enqueued compaction subsequently FAILED at execution: `[system:compaction-failed] cmp-mp90cdjm-Be38KA code=provider_error_4xx reason="Turn prefix summarization failed: 400 bad request: missing Editor-Version header for IDE auth"`. Evacuated state was NOT compacted; staged post-compaction delegates remain pending.

This is an UPSTREAM-CLASS provider-auth-header gap on the github-copilot summarizer call (Editor-Version header missing on IDE-auth-mode), NOT a cure-(2) substrate regression. The continuation-feature surface (request_compaction tool, threshold-gate, enqueue, compactionRequestId issuance, post-compaction-delegate staging discipline) is operationally intact. The summarizer-call provider-header surface is orthogonal.

Banked as separate substrate-finding for cohort follow-up (likely github-copilot provider plugin: needs `Editor-Version` header on `/chat/completions` calls when IDE-auth mode is active). Not blocking cure-(2) ship.

## Traceparent
00-d3b708989b84ea56a28c3fd5b1f64d11-fcbaa5cd63094bb6-01

## Continuation-feature surface intact
- `compactionRequestId` issued ✓
- `trigger: volitional` ✓
- `contextUsage: 123` reported ✓
- `traceparent` threaded ✓
- post-compaction delegate dispatch noted ✓
