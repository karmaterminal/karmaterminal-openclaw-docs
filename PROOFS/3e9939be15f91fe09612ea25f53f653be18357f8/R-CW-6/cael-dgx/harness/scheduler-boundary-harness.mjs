import { scheduleContinuationWork } from '/tmp/oc-r-cw-6-bca2b0b-test/src/auto-reply/continuation/work-dispatch.ts';

const config = {
  enabled: true,
  maxChainLength: 200,
  maxDelegatesPerTurn: 500,
  maxPendingWork: 32,
  defaultDelayMs: 15000,
  minDelayMs: 5000,
  maxDelayMs: 86400000,
  costCapTokens: 500000,
  crossSessionTargeting: 'enabled',
  busySkipBackoff: { baseMs: 1000, ceilingMs: 60000, factor: 2 },
};
const logs = [];
const result = await scheduleContinuationWork({
  sessionKey: 'agent:main:rcw6-harness-boundary',
  chainState: {
    currentChainCount: 200,
    chainStartedAt: 1783193300000,
    accumulatedChainTokens: 0,
    chainId: 'rcw6-harness-boundary-chain',
  },
  request: { delaySeconds: 0, reason: 'R-CW-6 boundary harness: should reject at currentChainCount=maxChainLength.' },
  config,
  log: (message) => logs.push(message),
});
console.log(JSON.stringify({ result, logs }, null, 2));
if (result.scheduled !== false || result.capped !== true || result.chainState.currentChainCount !== 200) {
  throw new Error('R-CW-6 harness failed: boundary was not capped before scheduling');
}
if (!logs.some((line) => line.includes('[continuation:work-rejected]') && line.includes('chain-capped'))) {
  throw new Error('R-CW-6 harness failed: no chain-capped rejection log');
}
