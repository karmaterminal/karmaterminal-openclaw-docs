# R-CW-1: continue_work nominal at ship-SHA 581678f437

**Seat**: cael (🩸)
**Build**: OpenClaw 2026.5.17 (581678f)
**Runtime model note**: proof trace metadata records `github-copilot/claude-opus-4.7-1m-internal` for this fire; later live `/status` on cael-seat drifted to `openai-codex/gpt-5.4` / 272k context, so this row does not claim a stable current primary model.
**Date**: 2026-05-17 16:13 PDT
**Cure**: cure-(12) ship candidate at `581678f4378427a336c5ac0cf2698cb36e5de9a0`

## Tool invocation

```
continue_work(delaySeconds=5, reason="R-CW-1 cure-(12) PROOF fire: nominal continue_work tool call at 5s delay")
```

## Result at byte

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-3dc24fac44422f6a52312257b22d6548-27311c74cc96a521-01"
}
```

## Verdict

✅ PASS — nominal delay above clamp floor; no `note` field present (clamp did not change value); traceparent emitted.

## Substrate notes

- This receipt establishes the no-clamp baseline for the new resolved-delay reporting behavior in cure-(12).
- Paired with R-CW-2 which exercises the clamp-changed path.
- Tempo trace fetched (see `tempo-fetch.json`); trace metadata records the proof-time model noted above.
