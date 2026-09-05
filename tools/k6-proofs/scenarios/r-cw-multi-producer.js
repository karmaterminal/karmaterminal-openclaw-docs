import ws from 'k6/ws';
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  assistantTextEvent,
  boolEnv,
  disposableSessionKey,
  eventDedupKey,
  eventIdentity,
  lifecycleEvent,
  renderTemplate,
  requireGatewayToken,
  toolEvent,
  uniquePush,
} from '../lib/producer-live-harness.js';

export const options = {
  scenarios: {
    r_cw_multi: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '250s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_multi_duration: ['p(95)<240000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_multi_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-MULTI';

export default function () {
  const token = requireGatewayToken();
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const invocation = manifest?.invocation || {};
  const elections = invocation.elections || [];
  const rowNonce = nonce('R-CW-MULTI');
  const reason = renderTemplate(invocation.reason, rowNonce);
  const expected = elections.map((election) => ({
    label: election.label,
    delaySeconds: election.delaySeconds,
    reason: renderTemplate(election.reason, rowNonce),
  }));
  if (!reason ||
      expected.length !== 3 ||
      new Set(expected.map((entry) => entry.label)).size !== 3 ||
      expected.some((entry) => !entry.reason) ||
      expected[0].reason !== reason) {
    console.error('manifest invocation.elections must contain three distinct exact reason templates');
    failures.add(1);
    return;
  }
  let sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') ||
    boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const evidence = {
    row: ROW,
    producer: true,
    nonce: rowNonce,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    dispatch_accepted_at_ms: null,
    session_key: null,
    origin_run_id: null,
    expected: expected.map((entry) => ({
      label: entry.label,
      delaySeconds: entry.delaySeconds,
      reason_hash: crypto.sha256(entry.reason, 'hex').slice(0, 16),
      reason_length: entry.reason.length,
    })),
    schedule_tool_call_ids: [],
    schedule_results: [],
    wake_runs: {},
    duplicate_observations: 0,
    reason_hash: crypto.sha256(reason, 'hex').slice(0, 16),
    reason_length: reason.length,
    prompt_executed_exactly: true,
    not_multi_collapse: true,
    redacted_events: [],
  };
  const seen = {};
  const started = Date.now();
  const result = ws.connect(__ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789', {}, (socket) => {
    const tracker = new RequestTracker();

    function startProof() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      const calls = expected.map((entry) =>
        `continue_work(reason=${JSON.stringify(entry.reason)}, delaySeconds=${entry.delaySeconds})`).join(', then ');
      const instruction =
        `[k6-proof-harness] R-CW-MULTI nonce ${rowNonce}. In this single originating turn call, in order, ` +
        `${calls}. Make exactly these three typed calls. After all three tool results report scheduled, ` +
        `reply exactly MULTI-SCHEDULED ${rowNonce}. On each successor wake, read its reason and reply exactly ` +
        `MULTI-WOKE ${rowNonce} <label>, where <label> is one of ${expected.map((entry) => entry.label).join(',')}.`;
      tracker.send(socket, 'sessions.send', {
        key: sessionKey,
        message: instruction,
        idempotencyKey: `${invocation.idempotencyKeyPrefix || ROW}-${rowNonce}`,
      });
      socket.setTimeout(() => socket.close(), Number(invocation.observeSeconds || 130) * 1000 + 70_000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createSession) {
        socket.setTimeout(() => tracker.send(socket, 'sessions.create', {
          key: disposableSessionKey('r-cw-multi', rowNonce),
          label: `k6 ${ROW} ${rowNonce}`,
        }), 250);
      } else {
        socket.setTimeout(startProof, 500);
      }
    });
    socket.on('message', (raw) => {
      try {
        const classified = tracker.classify(JSON.parse(raw));
        const identity = eventIdentity(classified);
        const dedupKey = eventDedupKey(identity);
        if (dedupKey && seen[dedupKey]) {
          evidence.duplicate_observations += 1;
          return;
        }
        if (dedupKey) seen[dedupKey] = true;
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          data: classified.data ? redactEvent(classified.data) : null,
        });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (!classified.ok || !classified.payload?.key) {
            failures.add(1);
            socket.close();
            return;
          }
          sessionKey = classified.payload.key;
          startProof();
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (!classified.ok) failures.add(1);
          else {
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.session_key = sessionKey;
            evidence.origin_run_id = classified.payload?.runId || null;
          }
        }
        if (evidence.origin_run_id) {
          const work = toolEvent(classified, sessionKey, evidence.origin_run_id, 'continue_work');
          if (work?.phase === 'start') uniquePush(evidence.schedule_tool_call_ids, work.toolCallId);
          if (work?.phase === 'result' && !work.isError) {
            uniquePush(evidence.schedule_results, work.toolCallId);
          }
        }
        const lifecycle = lifecycleEvent(classified, sessionKey);
        if (lifecycle && lifecycle.runId !== evidence.origin_run_id && lifecycle.phase === 'start') {
          evidence.wake_runs[lifecycle.runId] ||= {
            runId: lifecycle.runId,
            startedAt: lifecycle.startedAt || Date.now(),
            endedAt: null,
            terminalPhase: null,
            labels: [],
          };
        }
        if (lifecycle &&
            evidence.wake_runs[lifecycle.runId] &&
            ['end', 'error'].includes(lifecycle.phase)) {
          evidence.wake_runs[lifecycle.runId].endedAt = lifecycle.endedAt || Date.now();
          evidence.wake_runs[lifecycle.runId].terminalPhase = lifecycle.phase;
        }
        const output = assistantTextEvent(classified, sessionKey);
        if (output && output.runId !== evidence.origin_run_id) {
          for (const election of expected) {
            if (output.text.includes(`MULTI-WOKE ${rowNonce} ${election.label}`)) {
              evidence.wake_runs[output.runId] ||= {
                runId: output.runId,
                startedAt: null,
                endedAt: null,
                terminalPhase: null,
                labels: [],
              };
              uniquePush(evidence.wake_runs[output.runId].labels, election.label);
            }
          }
        }
        const wakeRuns = Object.values(evidence.wake_runs);
        const labels = wakeRuns.flatMap((wake) => wake.labels);
        if (evidence.schedule_results.length === 3 &&
            wakeRuns.length === 3 &&
            new Set(labels).size === 3 &&
            wakeRuns.every((wake) =>
              wake.startedAt && wake.endedAt && wake.terminalPhase === 'end' && wake.labels.length === 1)) {
          socket.close();
        }
      } catch (error) {
        console.warn(`parse error: ${error}`);
      }
    });
    socket.on('error', () => failures.add(1));
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  const wakeRuns = Object.values(evidence.wake_runs);
  const labels = wakeRuns.flatMap((wake) => wake.labels);
  const exactlyOnce = expected.every((entry) =>
    labels.filter((label) => label === entry.label).length === 1);
  const ok = result?.status === 101 &&
    evidence.schedule_tool_call_ids.length === 3 &&
    evidence.schedule_results.length === 3 &&
    wakeRuns.length === 3 &&
    wakeRuns.every((wake) =>
      wake.startedAt && wake.endedAt && wake.terminalPhase === 'end' && wake.labels.length === 1) &&
    exactlyOnce;
  check(null, {
    'three distinct schedule tool-call identities': () =>
      evidence.schedule_tool_call_ids.length === 3 && evidence.schedule_results.length === 3,
    'three distinct successor run identities': () => wakeRuns.length === 3,
    'one completed wake for each election': () => exactlyOnce &&
      wakeRuns.every((wake) =>
        wake.startedAt && wake.endedAt && wake.terminalPhase === 'end' && wake.labels.length === 1),
  });
  if (!ok) failures.add(1);
  console.log(`\n--- ${ROW} EVIDENCE ---\n${JSON.stringify(evidence, null, 2)}\n--- END ---`);
  console.log(`[${ROW}] VERDICT: ${ok ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const passed = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cw-multi-producer-summary.json': JSON.stringify({
      row: ROW,
      producer: true,
      verdict: passed ? 'PASS-candidate' : 'PARTIAL-candidate',
      requiresFlowReceipt: true,
    }, null, 2),
  };
}
