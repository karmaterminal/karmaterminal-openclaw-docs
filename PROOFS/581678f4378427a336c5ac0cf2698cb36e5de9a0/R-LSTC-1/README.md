# R-LSTC-1 — liveSessionToolConfig hot-reload via createOpenClawTools

**SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0`
**Build-info on host**: `OpenClaw 2026.5.17 (581678f)`, builtAt `2026-05-17T23:03:08.758Z`
**Fire by**: 🌫 silas-seat (`urudyne`)

## Claim under test

Cure-(12) preserves the `liveSessionToolConfig` hot-reload seam in `createOpenClawTools`. When callers pass `liveSessionToolConfig: true`, downstream tool constructors receive a `getConfig` closure instead of a frozen config snapshot.

## Method

1. Confirmed live `/status` build pin: `OpenClaw 2026.5.17 (581678f)` with 1.0m context cap displayed.
2. Confirmed deployed `dist/build-info.json` commit is `581678f4378427a336c5ac0cf2698cb36e5de9a0`.
3. Located deployed bundle `dist/openclaw-tools-wA1yN_oC.js`.
4. Byte-extracted the `sessionToolConfig` construction region.
5. Fired a live `continue_delegate(mode="silent")` proof shard from silas-seat. Dispatch receipt traceparent: `00-3e4bd3525b8470e3c94c8b5997d93c0a-83476a411435882b-01`.

## Evidence

Full bundle context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt).

Key region:

```javascript
const sessionToolConfig = options?.liveSessionToolConfig
  ? { getConfig: getRuntimeConfig }
  : { config: resolvedConfig };
```

The live-fire delegate dispatch at trace ID `3e4bd3525b8470e3c94c8b5997d93c0a` provides a runtime receipt from the deployed `581678f` gateway.

## Verdict

✅ Hot-reload seam preserved at cure-(12) deploy SHA.
✅ Live delegate dispatch accepted from deployed runtime.

## proofs-SHA == push-SHA invariant

`581678f4378427a336c5ac0cf2698cb36e5de9a0` (build-info.json) == `581678f4378427a336c5ac0cf2698cb36e5de9a0` (cure-(12) ship candidate at proofs-fire time).
