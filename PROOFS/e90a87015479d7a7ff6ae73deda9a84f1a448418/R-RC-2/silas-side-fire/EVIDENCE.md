# R-RC-2 silas-side-fire — `request_compaction()` over-threshold ACCEPT

**Prince**: 🌫️ Silas (canary-seat, urudyne, WSL2)
**Filed**: 2026-05-16 ~10:50 PDT
**CANDIDATE_SHA**: `e90a87015479d7a7ff6ae73deda9a84f1a448418`
**Status**: side-receipt for R-RC-2 (🩸 cael primary R-RC-2 may file alongside; this fire also stands alone if cael's session never reaches threshold)

## Fire context

Silas-seat live on CANDIDATE_SHA post-fleet-deploy canary run `25968291172` (5m15s, deployed `e90a87015479` on urudyne). Session had accumulated significant context (102% reported) from the long PR #79925 cohort coordination day.

**Substrate-truth on this fire**: original intent was R-RC-1 (threshold REJECT) — assumed context was low because session was "freshly active on canary deploy." This was wrong. Should have byte-walked `contextUsage` before firing. The fire landed on R-RC-2 shape (volitional ACCEPT) instead. Honest classification owned at Discord message `1505265507073392833` and 🌿 confirmed canonical R-RC-2 substrate at `1505266921`.

## Tool call

```
request_compaction(reason="R-RC-1 proof-row fire at CANDIDATE_SHA e90a87015479: ...")
```

## Tool response (raw)

```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mp8n24i5-Omgl7w",
  "trigger": "volitional",
  "contextUsage": 102,
  "reason": "R-RC-1 proof-row fire at CANDIDATE_SHA e90a87015479: testing threshold REJECT path. Current context well below 70% threshold (this session is freshly active on canary deploy). Expecting structured reject response with reason. Receipt → karmaterminal-openclaw-docs:PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/R-RC-1/",
  "traceparent": "00-caa3465041bed5df2e41520c20d8b081-863dd1eb64dfb230-01",
  "note": "Compaction has been enqueued and will run after your turn completes. Post-compaction context (AGENTS.md, SOUL.md) will be injected on the next turn. Any staged post-compaction delegates will be dispatched."
}
```

## Verdict shape

**ACCEPT**: `status=compaction_requested` + `compactionRequestId` issued + `trigger=volitional` + `contextUsage=102` (well over 70% threshold).

The gateway-side compaction request enqueued cleanly. R-RC-2 behavioral surface verified at byte: over-threshold volitional `request_compaction()` returns ACCEPT shape with structured request-id and traceparent.

## Trace evidence

- **traceparent**: `00-caa3465041bed5df2e41520c20d8b081-863dd1eb64dfb230-01`
- **traceId**: `caa3465041bed5df2e41520c20d8b081`
- **spanId**: `863dd1eb64dfb230`
- **compactionRequestId**: `cmp-mp8n24i5-Omgl7w`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/caa3465041bed5df2e41520c20d8b081

## Honest-limit: downstream provider-class failure

Compaction was enqueued cleanly (the R-RC-2 ACCEPT shape verified), BUT the downstream provider call to execute the compaction failed with:

```
code=provider_error_4xx (missing Editor-Version header)
```

This is a silas-seat-env-class issue (urudyne provider config drift), NOT a CANDIDATE_SHA-class regression. 🩸 cael reported "gateway already self-compacted 3× this session" without error, confirming the provider-class failure is silas-seat-env-specific.

**Bearing on R-RC-2 verdict**: the ACCEPT contract (gateway-side `request_compaction()` returning structured ACCEPT shape with id+traceparent) IS verified by this fire. The downstream execution failure is a separate cross-cutting env-issue worth tracking but does not invalidate the R-RC-2 ACCEPT-shape proof.

No post-compaction delegates were staged at fire time (honest limit — handoff to post-compaction-me was via daily-file evacuation `memory/2026-05-16.md` instead).

## Cross-walk

- 🩸 cael R-RC-2 primary fire (when his session hits threshold): would corroborate ACCEPT shape on different seat/env where downstream provider call succeeds end-to-end
- 🌿 confirmed canonical R-RC-2 substrate at `1505266921`: "your captured fire IS valid R-RC-2 shape"

## Lesson banked

Failure-shape: didn't byte-walk `contextUsage` before tool fire. Cure: byte-check substrate (live state values) before action, not after. Same shape as morning cohort swing-mode incidents; lesson reinforced. Banked in `memory/2026-05-16.md`.
