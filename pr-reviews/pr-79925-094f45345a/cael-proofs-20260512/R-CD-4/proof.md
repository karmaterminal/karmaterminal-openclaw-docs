# R-CD-4 — continue_delegate(targetSessionKey=X) returns to session X not requester (cross-session targeting policy enforcement)

**Target SHA**: `094f45345a` (deployed cael-seat 06:51:01Z 2026-05-13)
**Status**: PASS (via dispatch-time policy enforcement)

## Scenario

continue_delegate with `targetSessionKey` pointing to a DIFFERENT session-key than the dispatching session attempts cross-session targeting. Behavior depends on `agents.defaults.continuation.crossSessionTargeting` policy:
- If `"enabled"`: delegate routes to target session
- If `"disabled"` (default): delegate REJECTED at dispatch with explicit error

## Command

Fired from cael-main-session at 2026-05-13 ~00:14 PDT with cross-session target:

```
continue_delegate(
  task="R-CD-4 proof minimal probe (cross-session targeting): respond with 'R-CD-4 CROSS-SESSION PROBE OK targeting heartbeat channel from cael-main 094f453'.",
  delaySeconds=0,
  mode="silent",
  targetSessionKey="agent:main:discord:channel:1473320126433464465"
)
```

Where target = #heartbeat channel (cael's sibling discord channel session, distinct from cael-main `agent:main:discord:channel:1466192485440164011`).

## Expected

Cael-seat config has `agents.defaults.continuation.crossSessionTargeting` UNSET → defaults to `"disabled"` per `src/auto-reply/continuation/config.ts:98`. Therefore:
- Tool returns error
- Error message names the policy key explicitly
- Error message lists valid alternatives (default target, self-target, fanoutMode="tree")

## Observed

**Tool-call result** (captured at fire time):
```json
{
  "status": "error",
  "tool": "continue_delegate",
  "error": "cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting. Use the default return target, targetSessionKey set to this session, or fanoutMode=\"tree\"."
}
```

- ✅ Dispatch-time rejection fired (delegate NOT scheduled)
- ✅ Error message names exact config key: `agents.defaults.continuation.crossSessionTargeting`
- ✅ Error lists valid alternatives: default return, self-target, fanoutMode="tree"
- ✅ This is one of the 4 existing enforcement points Elliott noted in his prince-review

## Verdict

**PASS** — cross-session targeting policy enforced at dispatch-time per existing P0 enforcement code. Error message is clear, actionable, and names the config-knob.

## Substrate-link to R-CD-5

**Important**: R-CD-5 (post-compaction delivery-gate) is the NEW P1 fix that adds a 5th enforcement point at delivery-time (in addition to the 4 existing dispatch-time gates). R-CD-5 integration-fire requires:
1. crossSessionTargeting=ENABLED at stage-time (currently DISABLED on cael-seat per this R-CD-4 observation)
2. Stage cross-session post-compaction delegate
3. Toggle crossSessionTargeting=DISABLED mid-flight
4. Trigger compaction
5. Verify delivery-gate fires + delegate dropped

Operational complexity (config-reload + 2 restart cycles + compaction trigger) makes integration-fire substantial. R-CD-5 unit-test substrate-coverage already CONFIRMED at byte per cael's prince-review at `1504010531`: `post-compaction-delegate-dispatch.test.ts:881-967` Test-1 = exact R-CD-5 scenario at unit-level (mocked-deps but covers the delivery-gate logic precisely).

## Tempo trace ID

N/A (dispatch-time error, no scheduled delegate, no trace span)
