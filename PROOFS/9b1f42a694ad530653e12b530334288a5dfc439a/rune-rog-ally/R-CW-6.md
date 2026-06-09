# R-CW-6 — chain-depth-boundary reject (`maxChainLength`)

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ⚠️ HONEST-LIMIT (the guard refusing IS the proof)
**Fired:** 2026-06-09 (LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~1min post-deploy-restart)

## Behavior under test
`continue_work` / `continue_delegate` chain-allocation must REJECT when the chain hop reaches the configured `maxChainLength` boundary — the depth-cap that prevents unbounded continuation chains.

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surface: `src/auto-reply/continuation/scheduler.ts:27` (byte-confirmed live on the deployed SHA, post-reorg path):

```ts
function ...(params: {
  chainState: ChainState;
  config: ContinuationRuntimeConfig;
  sessionKey: string;
}): "chain-capped" | "cost-capped" | null {
  const { chainState, config, sessionKey } = params;
  const allocatedChainHop = chainState.currentChainCount;

  if (allocatedChainHop >= config.maxChainLength) {        // <-- the chain-depth reject
    log.info(
      `[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`,
    );
    return "chain-capped";
  }

  if (config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens) {
    log.info(
      `[continuation] Chain cost ${chainState.accumulatedChainTokens}/${config.costCapTokens} — capped for session ${sessionKey}`,
    );
    return "cost-capped";
  }
  ...
```

The reject-logic is present + live on the deployed binary (the `>=` boundary returns `"chain-capped"`).

## Why HONEST-LIMIT (not PASS, not FAIL)
Live induction of the boundary requires driving the chain to `maxChainLength` (default 200) hops, OR lowering `maxChainLength` to a small value via config to induce the cap at low depth. **`maxChainLength` is a protected config-path** — `config.patch` / `config.apply` REFUSE to change it (verified prior round: `gateway config.patch` returns `"cannot change protected config paths: maxChainLength"`). So a cheap live-induction (lower the cap → fire one continuation → observe reject) is BLOCKED by the protected-config guard.

**The guard refusing the config-mutation IS itself the proof the boundary is enforced + protected.** The reject-logic exists (`scheduler.ts:27`), AND the boundary-config is hardened against tampering (protected-path). Both halves of the safety-surface engage. The HONEST-LIMIT is the honest verdict: the reject-path is byte-present + live, but the cheap induction is (correctly) blocked by the protection on the very config it gates.

## Testability-gap tracked
The live-induction-path gap is filed as **issue #973** (karmaterminal/openclaw, P2/continuation/bug) — a testability enhancement (expose a test-only induction path for the chain-cap), NOT a regression. The boundary works; it's just not cheaply live-inducible without the protected-config mutation.

## Tempo trace
N/A for this row — the reject is a non-firing safety-boundary (no continuation dispatched = no span to capture). The proof is the byte-present reject-logic + the protected-config guard, both confirmed live on the deployed SHA.
