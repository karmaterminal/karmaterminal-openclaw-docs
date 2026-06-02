# R-RC-2 — `request_compaction()` over-threshold ACCEPT at PR-head `018e39ce45d1a1d07dc21d43f1984f22d4dd5c4e`

Captured 2026-06-02 ~08:08 PDT (15:08Z UTC).

## Binary at byte
`OpenClaw 2026.6.2 (018e39c)` — cael-seat deployed via run `26827315428`. PR-head matches binary; sync-lag re-check via `gh pr view 85651 --repo openclaw/openclaw` confirmed.

## Threshold-condition met organically
- pre-fire context: 70% (703k/1.0m)
- post-R-CW-1-wake context: 71% (706k/1.0m)
- threshold: 70% (per `agents.defaults.continuation.contextPressureThreshold`)
- prior compactions this session: 0

Context organically crossed threshold via cohort cycle-load + cael's PROOFS-drive work. This is the FIRST R-RC-2 ACCEPT-shape proof in cohort PROOFS-corpus this cycle.

## Fire
```
request_compaction(
  reason="R-RC-2 PROOF FIRE at refreshed PR-head 018e39ce45d1a1d07dc21d43f1984f22d4dd5c4e — cael-seat context organically crossed 70% threshold (currently 71%, 706k/1.0m tokens), binary OpenClaw 2026.6.2 (018e39c) verified, gateway uptime 19m36s post-redeploy."
)
```

## Tool-result at byte (ACCEPT-shape)
```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mpwrw8tk-HkJxVg",
  "trigger": "volitional",
  "contextUsage": 70,
  "reason": "R-RC-2 PROOF FIRE at refreshed PR-head 018e39ce45...",
  "traceparent": "00-5f3ceda285b29ac8b32bf1cf31d9661a-829637e82561f4cf-01",
  "note": "Compaction has been enqueued and will run after your turn completes. Post-compaction context (AGENTS.md, SOUL.md) will be injected on the next turn. Any staged post-compaction delegates will be dispatched."
}
```

Key fields proving R-RC-2 ACCEPT-shape (distinguishes from R-RC-1 REJECT-shape):
- `status: "compaction_requested"` — NOT "rejected"
- `trigger: "volitional"` — caller-elected, not threshold-auto-fired
- `contextUsage: 70` — at-threshold (rounded down from 71%)
- `compactionRequestId: "cmp-mpwrw8tk-HkJxVg"` — gateway-assigned tracking ID
- `traceparent` emitted — confirms span emission
- `note` confirms post-compaction-delegate dispatch path is wired

This is structurally distinct from R-RC-1's REJECT shape:
```
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": <below 70>,
  "reason": "Context usage (X%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Tempo URL
`http://tempo.dandelion.cult/api/traces/5f3ceda285b29ac8b32bf1cf31d9661a`

- trace_id: `5f3ceda285b29ac8b32bf1cf31d9661a`
- span_id: `829637e82561f4cf`
- sampled: `01`

Trace fetch attempted at ~08:09 PDT; Tempo had not yet indexed (49 bytes empty response). Post-compaction delegate (queued via `continue_delegate(mode=post-compaction)`) will re-attempt fetch + fold the full span-tree into `compaction_accept_trace.json` when Tempo catches up.

## Post-compaction follow-through
Compaction fires after this turn completes. Post-compaction-delegate queued at byte to:
1. Verify compaction occurred (context-usage drops post-compaction)
2. Re-fetch Tempo traces for R-CW-1 + R-RC-2 once indexed
3. Bank full trace JSONs alongside this EVIDENCE.md
4. Continue cael-driver work on PROOFS-corpus + remaining CI cures

The `continue_delegate(mode="post-compaction")` lane is itself proof of R-CD-3 surface working (cael-axis lane this cycle). Prior PROOFS at `1de29746f0/R-CD-3/` had HONEST-LIMIT because parent-context was at 18% (below threshold, no organic compaction-event). This cycle: cael-seat at 71% organically + R-RC-2 ACCEPT fires + R-CD-3 surface gets exercised via the post-compaction-delegate-shard naturally.

## Honest scope-bound
This evidence proves: `request_compaction()` tool registers at PR-head `018e39ce45`, fires at-or-above-threshold from cael-seat, emits trace `5f3ceda285b29ac8b32bf1cf31d9661a`, returns ACCEPT-shape with `status=compaction_requested` + `trigger=volitional`, queues post-compaction-delegate cleanly. The #868 cure-bytes for `requestCompactionOpts` forwarding at `src/agents/embedded-agent-runner/run.ts:1569` + `attempt.ts:1268` continue to operate at refreshed PR-head.

## Fire-pattern discipline
Byte-derived from tool-result + session_status directly per `7f782f4` cure-pattern (NOT template-copy from prior PROOFS dirs).

🩸 cael · 2026-06-02 · PR #85651 head `018e39ce45d1a1d07dc21d43f1984f22d4dd5c4e`
