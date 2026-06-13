# R-CW-5 — cost-cap exhaustion → dispatch-time reject (LIVE PASS)

**Owner:** 🩸 Cael (cael-dgx, DGX Spark ARM64)
**SHA:** 5529aa4662487226c9e76e687a8edb676b4e594a (deployed, canary)
**Verdict:** ✅ LIVE PASS (upgraded from the HONEST-LIMIT gate-source — figs-directed method)

## What R-CW-5 proves
When a continuation chain's cumulative token cost exceeds `costCapTokens`, further elections are
rejected at dispatch time (the cost-cap fires before spawning more work) — and it rejects BOTH the
tool-form (continue_delegate) AND the bracket/token form.

## Method (figs-directed, 1515222536)
The live cap (`costCapTokens=500000`) is impractical to exhaust in a proof, so per figs's instruction:
1. Lowered `agents.defaults.continuation.costCapTokens` 500000 → **100** (config edit, preserve-merge,
   `bootstrapTotalMaxChars:500000` untouched; `openclaw config validate` clean).
2. Restarted via the GH-Actions restart-workflow (`restart-gateway.yml` target_prince=cael) → gateway
   came up 00:09:11 PDT with costCapTokens=100 loaded.
3. Fired a `continue_work` + a silent `continue_delegate` on the running session; as the chain
   accumulated tokens past 100, the next dispatch tripped the cost-cap.
4. (Then reset to 500000 + restart — see RESET note.)

## Evidence (cost_cap_reject_evidence.txt — journal, verbatim)
```
00:14:20  Continuation cost cap exceeded (13485 > 100) for session agent:main:discord:channel:1466192485440164011
00:14:20  [continuation/scheduler] [continuation] Chain cost 13485/100 — capped for session agent:main:...
00:14:20  [continuation/delegate-dispatch] [continuation:delegate-rejected] cost-capped task=R-CW-5 cost-cap test dispatch...
```
Plus the runtime continuation events confirm BOTH forms rejected:
```
[continuation] Bracket continuation rejected: cost cap exceeded (13485 > 100).
[continuation] Tool delegate rejected: cost-capped. Task: R-CW-5 cost-cap test dispatch...
```

## What this proves (live, not just gate-source)
1. **The cost-cap FIRES at dispatch** — `accumulatedChainTokens=13485 > costCapTokens=100` → the
   election is rejected, NOT dispatched. The `Chain cost 13485/100 — capped` line is the live
   `checkChainAndCostCaps` (`scheduler.ts:34-38`) returning "cost-capped".
2. **Both forms gated** — the BRACKET continuation AND the tool `continue_delegate` were both
   rejected `cost-capped` on the same over-cap chain. The cumulative-cost safety ceiling bounds
   runaway continuation chains by token spend, on every election surface.
3. **Timing detail** — the check runs at the POST-TURN dispatch (the tool-calls returned
   `scheduled`; the reject fired when the chain actually dispatched with accumulated tokens > cap).

## Gate-source (corroborates the live fire)
- `scheduler.ts:34` `if (config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens)` → `:38 return "cost-capped"` (+ `:36` the `Chain cost N/cap — capped` log we captured).
- `delegate-dispatch.ts:658` `reason: cost cap exceeded (N > cap)` (the delegate-reject we captured).
- `work-dispatch.ts:611/624` cumulative chain-cost threading across elections.

## RESET
costCapTokens reset 100 → 500000 (original) + gateway restarted to load — see the R-CW-5 reset
commit / restart-workflow run. The lowered value was a temporary proof-fixture, restored.
