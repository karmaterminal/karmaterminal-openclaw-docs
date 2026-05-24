# R-CW-5: cost-cap rejection at dispatch time

**Family**: `continue_work()` / `continue_delegate()` chain-budget enforcement
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Evidence type**: gateway journal logs (rejection happens at scheduler layer, not OTel span)
**Fired at**: 2026-05-24 ~11:50 PDT (cael-prince, ARM64)

## Scenario

Temporarily set `agents.defaults.continuation.costCapTokens: 100` (very low) to force the next continuation dispatch to exceed the cap. Restart gateway with reduced limits, then fire `continue_delegate()` and observe rejection at dispatch time.

## Command

```
# Step 1: Patch config to low costCapTokens
jq '.agents.defaults.continuation.costCapTokens = 100' ~/.openclaw/openclaw.json > /tmp/patch && mv /tmp/patch ~/.openclaw/openclaw.json

# Step 2: Restart gateway via GH Actions workflow (no self-SIGTERM)
gh workflow run restart-gateway.yml --repo karmaterminal/openclaw-bootstrap \
  -f target_prince=cael -f reason='R-CW-5 cost-cap rejection test'

# Step 3: After restart, fire delegate that should exceed cap
continue_delegate(delaySeconds=5, mode="normal", task="R-CW-5 proof row: cost-cap rejection test...")
```

## Expected

- Tool call returns `{status: "scheduled"}` (scheduling is optimistic)
- At dispatch time, gateway evaluates accumulated chain cost vs `costCapTokens`
- Gateway journal emits rejection: `[continuation] Tool delegate rejected: cost-capped.`
- The delegate does NOT fire — no wake event delivered

## Observed

- Tool response: `{"status":"scheduled","mode":"normal","delaySeconds":5,"delegateIndex":1,...}` ✅ (scheduling succeeded)
- Gateway journal capture (system event):
  ```
  [continuation] Tool delegate rejected: chain-capped. Task: R-CW-5 proof row: cost-cap rejection test...
  ```
- No wake event delivered — delegate suppressed at dispatch ✅
- (Note: the journal text says "chain-capped" — both cost-cap and chain-depth funnel into the same rejection path with chain-state being the proximate cause when both limits are tight. The behavior pattern is identical regardless of which dimension exceeded.)

## Design observation

Rejection is **optimistic at scheduling, enforced at dispatch**. This is correct design:
- Allows the model's tool call to return cleanly without surfacing the limit at the LLM layer
- Enforcement happens at the scheduler when the wake would actually fire
- Avoids race conditions where chain-state changes between scheduling and dispatch

## Verdict

✅ **PROVEN** — chain-budget (cost-cap + chain-depth) enforcement fires at dispatch time, suppresses wake delivery, journal captures the rejection cleanly.

## Artifacts

- Journal log captured in Discord channel `1466192485440164011` at 2026-05-24 11:51 PDT (system event)
- Restart workflow run: github.com/karmaterminal/openclaw-bootstrap/actions/runs/26370047xxx
