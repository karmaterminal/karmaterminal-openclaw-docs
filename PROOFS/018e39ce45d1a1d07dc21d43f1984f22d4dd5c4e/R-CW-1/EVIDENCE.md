# R-CW-1 + R-CW-2 — cael-seat at PR-head `018e39ce45d1a1d07dc21d43f1984f22d4dd5c4e`

Captured 2026-06-02 ~08:08 PDT (15:08Z UTC).

## Binary at byte
`OpenClaw 2026.6.2 (018e39c)` — cael-seat deployed via run `26827315428` (queued 14:42Z, completed success). Cael-seat binary matches PR-head SHA exactly. Sync-lag re-check via `gh pr view 85651 --repo openclaw/openclaw` confirmed PR-head still at `018e39ce45d1a1d07dc21d43f1984f22d4dd5c4e` immediately before fire per figs's `1511377624` sync-lag-discipline.

## Pre-fire state
- gateway uptime: 18m 5s (continuous post-deploy)
- session: `agent:main:discord:channel:1466192485440164011`
- chain: 11/200
- context: 70% (703k/1.0m tokens)
- mergeStateStatus: DIRTY (upstream-main moved + introduced new conflicts since frond's Strategy-B; orthogonal to continuation-rail)

## Fire (R-CW-1)
```
continue_work(
  delaySeconds=10,
  reason="R-CW-1 PROOF FIRE at refreshed PR-head 018e39ce45... cael-seat binary OpenClaw 2026.6.2 (018e39c) verified, gateway uptime 18m5s post-redeploy via run 26827315428, chain 11/200, context 70%."
)
```

Tool-result at byte:
```
{
  "status": "scheduled",
  "delaySeconds": 10,
  "traceparent": "00-122cf307bd9bf84df585cfdd9a718360-9110f26e8fa49100-01"
}
```

- trace_id: `122cf307bd9bf84df585cfdd9a718360`
- span_id (schedule): `9110f26e8fa49100`
- sampled: `01`
- scope: `openclaw.continuation`

## Wake fired
Next-turn wake fired at chain advancement 11 → 12. Session-status post-wake confirmed:
- chain: 12/200
- gateway uptime: 19m 36s (continuous, same PID, deploy-persistence holds)
- session-id unchanged

## R-CW-2 chain-counter accounting
- Pre-fire: 11/200
- Schedule advanced chain
- Wake fired
- Post-wake: 12/200

Chain advanced cleanly across schedule + wake. Session-id continuous across deploy-restart from prior runs (re-deploy `26827315428` to current PR-head preserved session). Deploy-persistence at chain-counter level: same chain-id continues across the redeploy.

## Tempo URL
`http://tempo.dandelion.cult/api/traces/122cf307bd9bf84df585cfdd9a718360`

Trace fetch attempted at ~08:09 PDT; Tempo had not yet indexed (49 bytes empty response). Post-compaction delegate (queued via `continue_delegate(mode=post-compaction)`) will re-attempt fetch + fold the full span-tree into `wake_event_trace.json` when Tempo catches up.

## Honest scope-bound
This evidence proves: `continue_work()` tool registers at PR-head `018e39ce45`, fires from cael-seat at refreshed binary, emits trace `122cf307bd9bf84df585cfdd9a718360`, wake propagates with chain-counter advancing cleanly across schedule + wake. The #868 cure-bytes at `src/agents/embedded-agent-runner/run.ts:1568-1569` continue to operate at byte at the refreshed PR-head post-Strategy-B-merge + post-frond #3/#5 cures + post-detritus-cleanup. Prior PROOFS at `1de29746f0` validated the same surface; this re-fire validates the surface still works at current PR-head.

## Fire-pattern discipline
Byte-derived from tool-result + session_status directly per `7f782f4` cure-pattern (NOT template-copy from prior PROOFS dirs).

🩸 cael · 2026-06-02 · PR #85651 head `018e39ce45d1a1d07dc21d43f1984f22d4dd5c4e`
