# R-CW-2: continue_work clamp-reporting at ship-SHA 581678f437

**Seat**: cael (🩸)
**Build**: OpenClaw 2026.5.17 (581678f)
**Runtime model note**: proof trace metadata records `github-copilot/claude-opus-4.7-1m-internal` for this fire; later live `/status` on cael-seat drifted to `openai-codex/gpt-5.4` / 272k context, so this row does not claim a stable current primary model.
**Date**: 2026-05-17 16:13 PDT
**Cure**: cure-(12) P2 #3 direct receipt at `581678f4378427a336c5ac0cf2698cb36e5de9a0`

## Tool invocation

```
continue_work(delaySeconds=0, reason="R-CW-2 cure-(12) PROOF fire: continue_work with delaySeconds=0 to exercise the new resolved-delay clamp-reporting")
```

## Result at byte

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "note": "Requested 0s, clamped to 5s by continuation config.",
  "traceparent": "00-3dc24fac44422f6a52312257b22d6548-27311c74cc96a521-01"
}
```

## Verdict

✅ PASS — **direct receipt of cure-(12) P2 #3 fix at byte**.

## Substrate notes

- Requested `delaySeconds=0`; runtime clamped to floor (`minDelayMs=5000` per default config).
- `delaySeconds` in result returns the **resolved post-clamp value (5)**, not the raw requested value (0).
- New `note` field surfaces the requested-vs-resolved delta to the model.
- Production scheduler path unchanged: `signal.ts:132` still passes raw `continueWorkRequest.delaySeconds * 1000` into the signal; only the model's feedback became accurate.
- This is the exact behavior cure-(12) introduces; prior behavior reported `delaySeconds=0` (the raw value) which lied to the model about when the next turn would fire.
- Same traceparent as R-CW-1 (paired same-turn fires under one trace context).
- Tempo trace fetched (see `tempo-fetch.json`); trace metadata records the proof-time model noted above.
