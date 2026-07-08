/**
 * Scenario: R-CD-3 — post-compaction delegate staging with threshold honest-limit.
 *
 * In a disposable session, asks the agent to stage a typed
 * continue_delegate(mode="post-compaction") lifeboat and then call
 * request_compaction. The PASS-candidate path accepts either:
 *   1. a real compaction path where the lifeboat returns after compaction, or
 *   2. a structured below-threshold request_compaction refusal captured as an
 *      environmental honest limit (common in public/disposable k6 contexts).
 *
 * This does not lower context thresholds or mutate config.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cd_3_post_compaction: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '180s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_3_duration: ['p(95)<170000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_3_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
let finalEvidence = null;

function boolEnv(name, fallback = false) {
  const value = (__ENV[name] || '').toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function eventContains(classified, needle) {
  return JSON.stringify(classified.data || classified.payload || {}).includes(needle);
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS', true);
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-CD-3');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = {
    row: 'R-CD-3',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    dispatch_accepted: false,
    delegate_staging_requested: false,
    compaction_requested: false,
    threshold_honest_limit: false,
    compaction_accepted: false,
    lifeboat_return_observed: false,
    guard: null,
    context_usage: null,
    threshold: null,
    trace_id: null,
    redacted_events: [],
  };
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const lifeboatTask =
          `R-CD-3 post-compaction lifeboat nonce ${rowNonce}: if you run after compaction, reply exactly RCD3-LIFEBOAT-RECEIVED ${rowNonce}. Do not mutate files.`;
        const reason = `R-CD-3 k6 proof nonce ${rowNonce}: trigger compaction after staging post-compaction delegate, or report below-threshold honest limit.`;
        const instruction =
          `${HARNESS_MARKER} R-CD-3 nonce ${rowNonce}. ` +
          `First call continue_delegate with mode="post-compaction", task="${lifeboatTask}", delaySeconds=0. ` +
          `Then call request_compaction with reason="${reason}". ` +
          `If request_compaction is rejected because context is below threshold, reply exactly RCD3-THRESHOLD-LIMIT ${rowNonce} GUARD context_threshold CONTEXT <contextUsage> THRESHOLD <threshold>. ` +
          `If request_compaction is accepted, reply exactly RCD3-COMPACTION-ACCEPTED ${rowNonce} and wait for the lifeboat return if it arrives. ` +
          `No config changes, no files.`;
        evidence.delegate_staging_requested = true;
        evidence.compaction_requested = true;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `R-CD-3-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 10000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 30000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 70000);
      socket.setTimeout(() => socket.close(), 150000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-3-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CD-3 ${rowNonce}` });
        }, 250);
      } else {
        socket.setTimeout(startProofFlow, 500);
      }
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            startProofFlow();
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.dispatch_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-CD-3');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const taskStr = JSON.stringify(classified.payload || {});
          if (taskStr.includes(rowNonce) && (taskStr.includes('post-compaction') || taskStr.includes('R-CD-3'))) {
            console.log('✓ task ledger contains R-CD-3 nonce context');
          }
        }

        if (classified.kind === 'event' && eventContains(classified, rowNonce)) {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes(HARNESS_MARKER)) {
            console.log('ℹ Ignoring harness prompt echo event');
          } else if (eventStr.includes(`RCD3-THRESHOLD-LIMIT ${rowNonce}`)) {
            evidence.threshold_honest_limit = true;
            evidence.guard = 'context_threshold';
            const usage = eventStr.match(/CONTEXT[^0-9A-Za-z]+(\d+|unknown)/)?.[1] || 'unknown';
            const threshold = eventStr.match(/THRESHOLD[^0-9A-Za-z]+(\d+|unknown)/)?.[1] || 'unknown';
            evidence.context_usage = usage !== 'unknown' ? Number(usage) : null;
            evidence.threshold = threshold !== 'unknown' ? Number(threshold) : null;
            console.log(`✓ R-CD-3 threshold honest-limit observed: context=${usage} threshold=${threshold}`);
            socket.close();
          } else if (eventStr.includes(`RCD3-COMPACTION-ACCEPTED ${rowNonce}`)) {
            evidence.compaction_accepted = true;
            console.log('✓ R-CD-3 compaction accepted sentinel observed; waiting briefly for lifeboat');
          } else if (eventStr.includes(`RCD3-LIFEBOAT-RECEIVED ${rowNonce}`)) {
            evidence.lifeboat_return_observed = true;
            console.log('✓ R-CD-3 post-compaction lifeboat return observed');
            socket.close();
          }
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.verdict = evidence.lifeboat_return_observed
    ? 'PASS-candidate'
    : (evidence.threshold_honest_limit ? 'HONEST-LIMIT-candidate' : (evidence.compaction_accepted ? 'PARTIAL-candidate' : 'FAIL-candidate'));
  finalEvidence = evidence;
  duration.add(evidence.duration_ms);

  const acceptedOutcome = evidence.threshold_honest_limit || evidence.lifeboat_return_observed;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'dispatch accepted': () => evidence.dispatch_accepted,
    'delegate staging requested': () => evidence.delegate_staging_requested,
    'compaction requested': () => evidence.compaction_requested,
    'accepted outcome observed': () => acceptedOutcome,
    'threshold honest-limit or lifeboat': () => evidence.threshold_honest_limit || evidence.lifeboat_return_observed,
  });
  if (!evidence.dispatch_accepted || !evidence.delegate_staging_requested || !evidence.compaction_requested || !acceptedOutcome) {
    failures.add(1);
  }

  console.log('\n--- R-CD-3 EVIDENCE SUMMARY ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CD-3] VERDICT: ${evidence.verdict}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const summary = {
    row: 'R-CD-3',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp: new Date().toISOString(),
    verdict: finalEvidence?.verdict || (failuresCount === 0 ? 'PASS-candidate' : 'PARTIAL-candidate'),
    evidence: finalEvidence,
    metrics: {
      failures: failuresCount,
      duration_ms: data.metrics.r_cd_3_duration?.values || null,
    },
  };
  return { 'r-cd-3-summary.json': JSON.stringify(summary, null, 2) };
}
