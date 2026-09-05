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
    wake_runs: [],
    token_phase_requested: false,
    token: 'CONTINUE_WORK:0',
    token_grammar_valid: true,
    raw_final_text_token_observed: false,
    raw_final_text: null,
    raw_final_text_run_id: null,
    token_origin_terminal_phase: null,
    token_typed_tool_observed: false,
    schedule_calls: [],
    token_origin_run_id: null,
    token_wake_run_id: null,
    token_wake_started: false,
    token_wake_completed: false,
    token_wake_terminal_phase: null,
    token_wake_sentinel_bound: false,
    duplicate_observations: 0,
    reason_hash: crypto.sha256(reason, 'hex').slice(0, 16),
    reason_length: reason.length,
    redacted_events: [],
  };
  const seen = {};
  const started = Date.now();
  const result = ws.connect(__ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789', {}, (socket) => {
    const tracker = new RequestTracker();
    let tokenPhaseRequested = false;

    function typedPhaseComplete() {
      const labels = evidence.wake_runs.flatMap((wake) => wake.labels);
      return evidence.schedule_results.length === 3 &&
        evidence.wake_runs.length === 3 &&
        new Set(labels).size === 3 &&
        evidence.wake_runs.every((wake) =>
          wake.startedAt && wake.endedAt &&
          wake.terminalPhase === 'end' && wake.labels.length === 1);
    }

    function startTokenParity() {
      if (tokenPhaseRequested) return;
      tokenPhaseRequested = true;
      evidence.token_phase_requested = true;
      const instruction =
        `[k6-proof-harness] R-CW-MULTI token parity nonce ${rowNonce}. ` +
        `Do not call continue_work. Reply with exactly CONTINUE_WORK:0 as terminal text. ` +
        `On the resulting successor wake, reply exactly MULTI-TOKEN-WOKE ${rowNonce}.`;
      tracker.send(socket, 'sessions.send', {
        key: sessionKey,
        message: instruction,
        idempotencyKey: `${invocation.idempotencyKeyPrefix || ROW}-token-${rowNonce}`,
      });
    }

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
          else if (tokenPhaseRequested) {
            evidence.token_origin_run_id = classified.payload?.runId || null;
          }
          else {
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.session_key = sessionKey;
            evidence.origin_run_id = classified.payload?.runId || null;
          }
        }
        if (evidence.origin_run_id) {
          const work = toolEvent(classified, sessionKey, evidence.origin_run_id, 'continue_work');
          if (work?.phase === 'start') {
            uniquePush(evidence.schedule_tool_call_ids, work.toolCallId);
            evidence.schedule_calls.push({ toolCallId: work.toolCallId, ...work.args });
          }
          if (work?.phase === 'result' && !work.isError &&
              evidence.schedule_tool_call_ids.includes(work.toolCallId)) {
            uniquePush(evidence.schedule_results, work.toolCallId);
          }
        }
        const lifecycle = lifecycleEvent(classified, sessionKey);
        if (lifecycle?.runId === evidence.token_origin_run_id &&
            ['end', 'error'].includes(lifecycle.phase)) evidence.token_origin_terminal_phase = lifecycle.phase;
        if (lifecycle &&
            lifecycle.runId !== evidence.origin_run_id &&
            lifecycle.runId !== evidence.token_origin_run_id &&
            !tokenPhaseRequested &&
            lifecycle.phase === 'start') {
          let wake = evidence.wake_runs.find((entry) => entry.runId === lifecycle.runId);
          if (!wake) {
            wake = {
            runId: lifecycle.runId,
            startedAt: lifecycle.startedAt || Date.now(),
            endedAt: null,
            terminalPhase: null,
            labels: [],
            };
            evidence.wake_runs.push(wake);
          }
        }
        const lifecycleWake = lifecycle
          ? evidence.wake_runs.find((entry) => entry.runId === lifecycle.runId)
          : null;
        if (lifecycle &&
            lifecycleWake &&
            ['end', 'error'].includes(lifecycle.phase)) {
          lifecycleWake.endedAt = lifecycle.endedAt || Date.now();
          lifecycleWake.terminalPhase = lifecycle.phase;
        }
        const output = assistantTextEvent(classified, sessionKey);
        if (output && output.runId === evidence.token_origin_run_id) {
          evidence.raw_final_text = output.text;
          evidence.raw_final_text_run_id = output.runId;
          evidence.raw_final_text_token_observed = output.text.trim() === 'CONTINUE_WORK:0';
        }
        if (identity?.runId === evidence.token_origin_run_id &&
            identity?.sessionKey === sessionKey && identity.stream === 'tool' &&
            identity.data?.name === 'continue_work') evidence.token_typed_tool_observed = true;
        if (output && output.runId !== evidence.origin_run_id) {
          for (const election of expected) {
            if (output.text.includes(`MULTI-WOKE ${rowNonce} ${election.label}`)) {
              let wake = evidence.wake_runs.find((entry) => entry.runId === output.runId);
              if (!wake) {
                wake = {
                  runId: output.runId,
                  startedAt: null,
                  endedAt: null,
                  terminalPhase: null,
                  labels: [],
                };
                evidence.wake_runs.push(wake);
              }
              uniquePush(wake.labels, election.label);
            }
          }
        }
        if (typedPhaseComplete()) startTokenParity();
        if (tokenPhaseRequested &&
            evidence.token_origin_run_id &&
            lifecycle &&
            lifecycle.runId !== evidence.token_origin_run_id &&
            lifecycle.runId !== evidence.origin_run_id &&
            lifecycle.phase === 'start' &&
            !evidence.token_wake_run_id) {
          evidence.token_wake_run_id = lifecycle.runId;
          evidence.token_wake_started = true;
        }
        if (lifecycle && lifecycle.runId === evidence.token_wake_run_id) {
          if (['end', 'error'].includes(lifecycle.phase)) {
            evidence.token_wake_completed = true;
            evidence.token_wake_terminal_phase = lifecycle.phase;
          }
        }
        if (output &&
            output.runId === evidence.token_wake_run_id &&
            output.text.includes(`MULTI-TOKEN-WOKE ${rowNonce}`)) {
          evidence.token_wake_sentinel_bound = true;
        }
        if (typedPhaseComplete() &&
            evidence.token_wake_started &&
            evidence.token_wake_completed &&
            evidence.token_wake_terminal_phase === 'end' &&
            evidence.token_wake_sentinel_bound) {
          socket.close();
        }
      } catch {
        failures.add(1);
        console.error('producer event processing failed');
        socket.close();
      }
    });
    socket.on('error', () => failures.add(1));
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  const wakeRuns = evidence.wake_runs;
  const labels = wakeRuns.flatMap((wake) => wake.labels);
  const exactlyOnce = expected.every((entry) =>
    labels.filter((label) => label === entry.label).length === 1);
  const ok = result?.status === 101 &&
    evidence.schedule_tool_call_ids.length === 3 &&
    evidence.schedule_results.length === 3 &&
    wakeRuns.length === 3 &&
    wakeRuns.every((wake) =>
      wake.startedAt && wake.endedAt && wake.terminalPhase === 'end' && wake.labels.length === 1) &&
    exactlyOnce &&
    evidence.token_phase_requested &&
    evidence.raw_final_text_token_observed &&
    evidence.raw_final_text_run_id === evidence.token_origin_run_id &&
    evidence.token_origin_terminal_phase === 'end' &&
    !evidence.token_typed_tool_observed &&
    evidence.token_origin_run_id &&
    evidence.token_wake_run_id &&
    evidence.token_wake_run_id !== evidence.token_origin_run_id &&
    evidence.token_wake_started &&
    evidence.token_wake_completed &&
    evidence.token_wake_terminal_phase === 'end' &&
    evidence.token_wake_sentinel_bound;
  check(null, {
    'three distinct schedule tool-call identities': () =>
      evidence.schedule_tool_call_ids.length === 3 && evidence.schedule_results.length === 3,
    'three distinct successor run identities': () => wakeRuns.length === 3,
    'one completed wake for each election': () => exactlyOnce &&
      wakeRuns.every((wake) =>
        wake.startedAt && wake.endedAt && wake.terminalPhase === 'end' && wake.labels.length === 1),
    'response-token parity produces a separately bound completed wake': () =>
      evidence.token_phase_requested &&
      evidence.token_origin_run_id &&
      evidence.token_wake_run_id &&
      evidence.token_wake_run_id !== evidence.token_origin_run_id &&
      evidence.token_wake_started &&
      evidence.token_wake_completed &&
      evidence.token_wake_terminal_phase === 'end' &&
      evidence.token_wake_sentinel_bound,
  });
  if (!ok) failures.add(1);
  console.log(`\n--- ${ROW} EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
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
