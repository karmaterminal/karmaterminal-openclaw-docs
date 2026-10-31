// Independent review of the sentinel-echo fixes (karmaterminal/openclaw-bootstrap#1727):
// R-CD-3's context fill. Neither defect yields a false PASS; both weaken the
// fill's own safety claims ("runs only in a disposable session", "stops well
// below automatic compaction").
//
// 1. The disposable-session guarantee rests on the sessions.create response
//    carrying `key`. scenarios/r-cd-3-post-compaction.js:544 does
//      sessionKey = classified.payload.key || sessionKey;
//    and sessionKey starts as the manifest/env session (manifests/r-cd-3.json
//    "${OPENCLAW_SESSION_KEY:-main}"). A create acknowledgement without `key`
//    therefore sends up to six large filler turns (300k-token budget) and the
//    compaction proof itself into the configured live session. At openclaw
//    f15237ec92 sessions.create does answer a top-level `key`
//    (src/gateway/server-methods/sessions-create.ts:669-680), so this is
//    latent; R-CD-TOKEN already refuses a missing or non-distinct created key
//    (scenarios/r-cd-token-bracket-delegate.js:488,563).
//
// 2. The fill can aim past the automatic-compaction line. At f15237ec92 the
//    compaction reserve is max(configured, 20,000) capped at 25% of the window
//    (src/agents/agent-settings.ts:11,29-32; src/agents/agent-compaction-constants.ts:2-13),
//    so the line is window - min(20,000, window/4): 90% of 200k, 84.4% of 128k,
//    75% of <= 80k. planFillStep aims at target + 2% (77% by default) and caps
//    at an 85% ceiling (lib/r-cd-3-lifeboat.mjs:102-104), so for windows below
//    about 87k its own plan crosses the line, and its ceiling is no guard for
//    any window below about 133k. The fill's only compaction detector is a
//    measured total that falls (r-cd-3-post-compaction.js:280); a preflight
//    compaction caused by a large filler turn leaves summary + kept tail + the
//    new filler, which can exceed the previous total, so it is not detected.
//    sessions.describe exposes no compaction counter
//    (src/gateway/session-utils-row.ts; compactionCount is not projected), so
//    prevention is the dependable guard.
//
// These tests assert the desired contract and FAIL on codeagent/harness-review
// at 3283454d.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { planFillStep } from '../lib/r-cd-3-lifeboat.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_SESSION = 'agent:main:main';

test('REVIEW R-CD-3: a sessions.create answer without `key` never routes the fill to the live session', async () => {
  const sendKeys = [];
  const gateway = (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-3']] } });
      // Accepted, but the acknowledgement carries no `key`.
      case 'sessions.create': return ok({ ok: true, sessionId: 'review-session-id' });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send':
        sendKeys.push(frame.params?.key);
        return ok({ runId: `run-${sendKeys.length}`, status: 'started' });
      case 'sessions.describe': return ok({ session: null });
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
  await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-3-post-compaction.js'),
    gateway,
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-3.json'),
      OPENCLAW_GATEWAY_TOKEN: 'review-r-cd-3-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'review-seat',
      OPENCLAW_SESSION_KEY: LIVE_SESSION,
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  assert.deepEqual(sendKeys.filter((key) => key === LIVE_SESSION), [],
    `the fill sent ${sendKeys.length} turn(s) to the configured live session ${LIVE_SESSION}`);
});

test('REVIEW R-CD-3: the fill never plans past the automatic-compaction line (window - min(20000, window/4))', () => {
  const crossings = [];
  for (const contextTokens of [64_000, 80_000, 100_000, 128_000, 200_000]) {
    const autoLine = contextTokens - Math.min(20_000, Math.floor(contextTokens * 0.25));
    const totalTokens = Math.round(contextTokens * 0.3);
    const step = planFillStep({
      measurement: { measured: true, usage: totalTokens / contextTokens, totalTokens, contextTokens, reason: null },
      turnsUsed: 1,
      filledTokens: 0,
      tokensPerChar: 0.25,
    });
    if (step.action !== 'fill') continue;
    const planned = totalTokens + step.stepTokens;
    if (planned >= autoLine) crossings.push(`${contextTokens}: plans ${planned} >= line ${autoLine}`);
  }
  assert.deepEqual(crossings, [], 'the planner aims at or past automatic compaction for these windows');
});
