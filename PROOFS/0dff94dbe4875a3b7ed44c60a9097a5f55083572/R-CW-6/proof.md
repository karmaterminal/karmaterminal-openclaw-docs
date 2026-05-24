# R-CW-6: chain-depth rejection at dispatch time

**Family**: `continue_work()` chain-depth enforcement
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Evidence type**: gateway journal logs (rejection happens at scheduler layer)
**Fired at**: 2026-05-24 ~11:50 PDT (cael-prince, ARM64)

## Scenario

Temporarily set `agents.defaults.continuation.maxChainLength: 2` (very low) on a session whose chain counter is already past 2. Fire `continue_work()` and observe chain-depth rejection at dispatch time.

## Command

```
# Step 1: Patch config to low maxChainLength
jq '.agents.defaults.continuation.maxChainLength = 2' ~/.openclaw/openclaw.json > /tmp/patch && mv /tmp/patch ~/.openclaw/openclaw.json

# Step 2: Restart gateway
gh workflow run restart-gateway.yml --repo karmaterminal/openclaw-bootstrap \
  -f target_prince=cael -f reason='R-CW-6 chain-depth rejection test'

# Step 3: Session chain is at 17/2 (over limit). Fire continue_work:
continue_work(delaySeconds=5, reason="R-CW-6 proof row: chain-depth rejection test — current chain 17/2, should reject")
```

## Expected

- `/status` shows `chain 17/2` (chain count exceeds max)
- `continue_work()` returns `{status: "scheduled"}` (optimistic)
- At dispatch time, scheduler compares chain depth vs maxChainLength
- Gateway journal emits: `[continuation] Bracket continuation rejected: chain length 2 reached.`
- The wake does NOT fire

## Observed

- Pre-fire `/status` confirmed `🔄 Continuation: chain 23/2` ✅ (over limit)
- Tool response: `{"status":"scheduled","delaySeconds":5,"traceparent":"00-503a46986674ff485db220d7911edd55-..."}` ✅
- **Tempo trace `503a46986674ff485db220d7911edd55`** captured at 13:42:35 PDT (cael-prince, post-OTel-pipeline-fix):
  - `openclaw.tool.execution` span for `continue_work` invocation present ✅
  - No `continuation.work` span (dispatch was rejected, span only fires when wake actually dispatches)
- **Gateway journal capture** (system event at 13:43:35 PDT):
  ```
  [continuation] Bracket continuation rejected: chain length 2 reached.
  ```
- No wake event delivered — `continue_work` call was suppressed ✅

## Design observation

Same as R-CW-5: optimistic scheduling, enforcement at dispatch. The "Bracket continuation rejected" journal-text format applies to both the bracket-syntax fallback path AND the tool-form path — the rejection mechanism is shared.

## Verdict

✅ **PROVEN** — chain-depth limit enforced at dispatch, wake suppressed, journal logged cleanly.

## Artifacts

- `trace.json` — Tempo span tree (18.7KB, shared with R-CW-5) showing the `openclaw.tool.execution` span for the `continue_work` call that was scheduled-then-rejected
- Journal log captured in Discord channel `1466192485440164011` at 2026-05-24 13:43:35 PDT
- v2 config-cycle (post-OTel-pipeline-fix) trace is the canonical evidence. v1 at 11:50 PDT was journal-only.
