# R-CW-1 — continue_work chain persistence across deploy-restart
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸, 2026-06-09T14:01:08Z
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx)

## Proof: continue_work chain survives the gateway redeploy onto the ship-SHA
A live `continue_work` chain (chain started 2026-06-09T11:16:22.938Z) was active on cael-dgx during the fleet deploy of `8b5dde6165`. The gateway received SIGTERM (~06:50 PDT) and redeployed onto `8b5dde6165`. The continuation chain **survived the restart** and continued firing its scheduled turns (Turn 4/200) on the new deployed base — confirming continue_work's chain-state persistence across a gateway lifecycle event on the ship-SHA.

- chain.id: stable across restart (Turn 4/200, chain started 11:16:22Z)
- gateway version pre-restart: `2807efc` → post-restart: `8b5dde6` (verified `openclaw --version`)
- the continue_work return fired post-restart on the deployed ship-SHA

## Verdict: ✅ PASS
continue_work chain-continuation is durable across the deploy-restart onto `8b5dde6165` — the continuation survived the gateway lifecycle event and resumed on the proof-correct base.
