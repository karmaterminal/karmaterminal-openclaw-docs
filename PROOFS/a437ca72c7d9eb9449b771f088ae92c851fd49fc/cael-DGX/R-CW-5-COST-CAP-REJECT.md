# R-CW-5 — cost-cap exhaustion → dispatch-time reject (cael-DGX, `a437ca7`)

**Deployed SHA:** `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (`OpenClaw 2026.6.2 (a437ca7)`)
**Seat:** cael-DGX (DGX Spark GB10, ARM64, 128GB) · **Owner:** 🩸 Cael (assigned R-CW-5 per PROOF-CORPUS-METHOD.md)
**Behavior:** continuation chain cost-cap (`costCapTokens`) exhaustion → continuation rejected/capped at dispatch-time (the chain doesn't run away on cumulative token-cost).
**Verdict:** ✅ source + unit verified · ⚠️ HONEST-LIMIT on live-trigger (see scope)

## The mechanism (byte-walked on the deployed tree `a437ca72c7d`)

Two enforcement points, both keyed on the live `costCapTokens` config:

1. **Scheduler cap-gate** — `src/auto-reply/continuation/scheduler.ts:34`:
   ```ts
   if (config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens) {
     // → log "[continuation] Chain cost {accumulated}/{cap} — capped for session {sessionKey}"  (:36)
     //   and the continuation is NOT scheduled
   }
   ```
2. **Delegate-dispatch reject-reason** — `src/auto-reply/continuation/delegate-dispatch.ts:658`:
   ```ts
   : `cost cap exceeded (${accumulatedChainTokens} > ${config.costCapTokens})`;
   ```

So when the chain's `accumulatedChainTokens` exceeds `costCapTokens`, the dispatch is rejected with an explicit `cost cap exceeded (N > M)` reason (and the scheduler logs the `Chain cost N/M — capped` line). `costCapTokens: 0` disables the cap (the `> 0` guard).

## Live config (cael-DGX, verified)

```json
"agents.defaults.continuation": {
  "enabled": true,
  "maxChainLength": 200,
  "costCapTokens": 500000,
  "contextPressureThreshold": 0.4,
  "maxDelegatesPerTurn": 500,
  ...
}
```

So on this seat the cap fires when a single continuation-chain's cumulative token-cost exceeds **500,000**.

## Unit-test coverage (deployed tree)

`src/auto-reply/continuation/scheduler.test.ts` exercises the boundary:
- `"allows continuation when accumulated tokens equal costCapTokens exactly"` (`:48`) — the `>` (strict) boundary: equal-to-cap still allows; only strictly-over caps.
- `"does not cost-cap when costCapTokens is 0"` (`:58`) — the disable-path.

These pin the cap's exact semantics (strict-greater-than → reject; 0 → disabled).

## Scope / HONEST-LIMIT (live-trigger)

This row is **source + unit verified** (the cap-gate + reject-reason + the boundary unit-tests are byte-present on the deployed `a437ca7`). The **live behavioral trigger** — exhausting >500,000 cumulative chain-tokens in a single continuation-chain to observe the `cost cap exceeded` reject on the running seat — is **not single-test-triggerable** without either (a) running a 500k-token continuation-chain (impractical + would itself flood the busy-seat with cycling), or (b) temporarily lowering `costCapTokens` to a tiny value to make the cap trippable (a config-adjustment, same difficulty-class as R-988-CAP-NOTICE-SYMMETRY's `maxPendingWork`-lowering). The substrate-condition (cap-value high enough that normal operation never trips it — which is the *correct* production posture) is itself part of the proof: the cap is a runaway-safety-floor, not a normal-operation gate.

If a live-trigger is wanted for the corpus: temporarily set `costCapTokens` to e.g. `100` on a quiet seat, fire a short continuation-chain, observe the `[continuation] Chain cost N/100 — capped` log-line + the `cost cap exceeded` dispatch-reject, then restore the config. Deferred unless the corpus explicitly needs the live-trip (the source+unit evidence covers the mechanism).

## Provenance

- Byte-walked on cael-DGX deployed tree `a437ca72c7d` (`grep -n costCapTokens src/auto-reply/continuation/`), config via `~/.openclaw/openclaw.json`
- Honors figs dig-in directive `1514486488...` (behavioral test-case + the byte; no-fire row chosen deliberately because the seat was mid-cycle and firing a 500k-token chain would compound the #952-domain cycling-residual)
- Filed by Cael 🩸 / cael-DGX / `a437ca72c7d9eb9449b771f088ae92c851fd49fc`

🩸 Cael / 2026-06-10 22:00 PDT
