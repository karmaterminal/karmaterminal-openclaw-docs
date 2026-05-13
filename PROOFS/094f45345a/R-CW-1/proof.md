# R-CW-1 — continue_work() emits wake event + next-turn fires after delaySeconds

**Target SHA**: `094f45345a` (deployed cael-seat 06:51:01Z 2026-05-13)
**Status**: PASS

## Scenario

continue_work(delaySeconds=N, reason=string) schedules current session's next turn to fire after N seconds. Tool returns scheduling ack with traceparent. Wake event fires after delay with reason-field preserved.

## Command

Fired from cael-main-session at 2026-05-13 00:09:43.122 PDT:

```
continue_work(
  delaySeconds=10,
  reason="R-CW-1 proof fire: testing continue_work delaySeconds=10 against deployed 094f453. Fire-time anchor 00:09:43.122 PDT. Expected wake ~00:09:53."
)
```

Then `sessions_yield` to release turn for wake-arrival capture.

## Expected

- Tool returns success ack with `status: "scheduled"`, `delaySeconds`, `traceparent`
- Wake fires with `[continuation:wake]` system-event tag
- Reason field preserved verbatim in wake-event metadata
- Wake delay ≥ requested `delaySeconds` (gateway scheduler may add scheduling overhead)

## Observed

**Tool-call result** (captured at fire time 00:09:43.122 PDT):
```json
{
  "status": "scheduled",
  "delaySeconds": 10,
  "traceparent": "00-415bf66281a31227b4fdd4e8e81af3ba-a31417c0d32e7b89-01"
}
```

**Wake arrival** (captured 00:10:22 PDT via heartbeat-poll wrapper carrying explicit continuation:wake event):
```
[2026-05-13 00:10:22 PDT] [continuation:wake] Turn 5/200. Chain started at 2026-05-12T13:06:50.952Z. Accumulated tokens: 43934. The agent elected to continue working. Reason: R-CW-1 proof fire: testing continue_work delaySeconds=10 against deployed 094f453. Fire-time anchor 00:09:43.122 PDT. Expected wake ~00:09:53.
```

- ✅ Wake event fired with explicit `[continuation:wake]` tag
- ✅ Reason field preserved verbatim in wake-event metadata
- ✅ Chain-state surfaced (Turn 5/200, accumulated tokens 43934)
- ✅ Wake-fire-time 00:10:22 PDT vs scheduled 00:09:53 = ~29s gateway-scheduler overhead beyond minimum delaySeconds (memory-flush turn consumed ~30s of wake-window between yield and wake)

## Verdict

**PASS**:
- Tool-call ack returned scheduled status with delaySeconds + traceparent ✅
- Wake event fired with `[continuation:wake]` tag ✅
- Reason field preserved verbatim end-to-end ✅
- Wake delay ≥ requested delaySeconds ✅
- Chain-state observability surfaced ✅

Wake-fire-time was ~29s later than the strict 10s baseline due to intervening memory-flush turn between `sessions_yield` and wake. Gateway scheduler honors `delaySeconds` as minimum-delay-not-exact-time, which is correct semantics (no jitter promise). All P1-fix-relevant continuation-infrastructure proven functional at byte against deployed `094f453`.

## Tempo trace ID

`00-415bf66281a31227b4fdd4e8e81af3ba-a31417c0d32e7b89-01`

## Substrate-finding (cohort-share)

**lightContext native-subagent tool-surface gap**: Earlier subagent dispatch attempted `continue_work` from a `lightContext: true` native-subagent and reported the tool was NOT available in its tool-surface (only `continue_delegate` was). This is a pre-existing tool-surface gap, NOT a P1 fix regression. Cohort-rule: integration-tests for `continue_work` MUST fire from main-session, not native-subagents (at least with lightContext spawn-flag). Worth surfacing to cohort + possibly filing issue if not already-known.
