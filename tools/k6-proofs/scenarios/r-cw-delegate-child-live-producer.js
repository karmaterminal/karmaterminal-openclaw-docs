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
  taskRecordsForIdentity,
  toolEvent,
} from '../lib/producer-live-harness.js';

export const options = {
  scenarios: {
    r_cw_delegate_child_live: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '190s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_delegate_child_live_duration: ['p(95)<180000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_delegate_child_live_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-DELEGATE-CHILD-LIVE';

export default function () {
  const token = requireGatewayToken();
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const invocation = manifest?.invocation || {};
  const rowNonce = nonce('R-CW-CHILD-LIVE');
  const childTask = renderTemplate(invocation.promptTemplate, rowNonce, {
    reason: renderTemplate(invocation.reason, rowNonce),
    delaySeconds: invocation.cwDelaySeconds ?? 5,
  });
  const reason = renderTemplate(invocation.reason, rowNonce);
  if (!childTask || !reason) {
    console.error('manifest invocation.promptTemplate and reason are required');
    failures.add(1);
    return;
  }
  let parentSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') ||
    boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const evidence = {
    row: ROW,
    producer: true,
    nonce: rowNonce,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    dispatch_accepted_at_ms: null,
    parent_session_key: null,
    parent_run_id: null,
    parent_delegate_tool_call_id: null,
    parent_delegate_tool_started: false,
    parent_delegate_tool_scheduled: false,
    child_session_key: null,
    child_initial_run_id: null,
    delegate_task_id: null,
    delegate_flow_id: null,
    work_tool_call_id: null,
    work_tool_started: false,
    work_tool_scheduled: false,
    hop_two_run_id: null,
    hop_two_started: false,
    hop_two_completed: false,
    hop_two_terminal_phase: null,
    hop_two_sentinel_bound: false,
    reason_hash: crypto.sha256(reason, 'hex').slice(0, 16),
    reason_length: reason.length,
    delegate_mode: invocation.mode || 'normal',
    redacted_events: [],
  };
  const seen = {};
  const subscribed = {};
  const started = Date.now();
  const result = ws.connect(__ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789', {}, (socket) => {
    const tracker = new RequestTracker();

    function subscribe(key) {
      if (!key || subscribed[key]) return;
      subscribed[key] = true;
      tracker.send(socket, 'sessions.messages.subscribe', { key });
    }

    function startProof() {
      subscribe(parentSessionKey);
      const instruction =
        `[k6-proof-harness] R-CW-DELEGATE-CHILD-LIVE nonce ${rowNonce}. ` +
        `Call continue_delegate exactly once with mode="${evidence.delegate_mode}", delaySeconds=${invocation.delaySeconds ?? 0}, ` +
        `task=${JSON.stringify(childTask)}. After the accepted tool result, reply exactly PARENT-DELEGATED ${rowNonce}.`;
      tracker.send(socket, 'sessions.send', {
        key: parentSessionKey,
        message: instruction,
        idempotencyKey: `${invocation.idempotencyKeyPrefix || ROW}-${rowNonce}`,
      });
      for (const delayMs of [3_000, 8_000, 15_000, 30_000, 60_000, 100_000, 150_000]) {
        socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 100 }), delayMs);
      }
      socket.setTimeout(() => socket.close(), 180_000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createSession) {
        socket.setTimeout(() => tracker.send(socket, 'sessions.create', {
          key: disposableSessionKey('r-cw-child-live', rowNonce),
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
        if (dedupKey && seen[dedupKey]) return;
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
          parentSessionKey = classified.payload.key;
          startProof();
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (!classified.ok) failures.add(1);
          else {
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.parent_session_key = parentSessionKey;
            evidence.parent_run_id = classified.payload?.runId || null;
          }
        }
        if (evidence.parent_run_id) {
          const delegated = toolEvent(
            classified,
            parentSessionKey,
            evidence.parent_run_id,
            'continue_delegate',
          );
          if (delegated?.phase === 'start') {
            evidence.parent_delegate_tool_call_id = delegated.toolCallId;
            evidence.parent_delegate_tool_started = true;
          }
          if (delegated?.phase === 'result' &&
              delegated.toolCallId === evidence.parent_delegate_tool_call_id &&
              !delegated.isError) {
            evidence.parent_delegate_tool_scheduled = true;
          }
        }
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const records = taskRecordsForIdentity(classified.payload, [rowNonce]);
          if (records.length === 1) {
            const task = records[0];
            evidence.child_session_key = task.childSessionKey;
            evidence.child_initial_run_id = task.runId;
            evidence.delegate_task_id = task.taskId;
            evidence.delegate_flow_id = task.flowId;
            subscribe(task.childSessionKey);
          }
        }
        if (evidence.child_session_key && evidence.child_initial_run_id) {
          const work = toolEvent(
            classified,
            evidence.child_session_key,
            evidence.child_initial_run_id,
            'continue_work',
          );
          if (work?.phase === 'start') {
            evidence.work_tool_started = true;
            evidence.work_tool_call_id = work.toolCallId;
          }
          if (work?.phase === 'result' &&
              work.toolCallId === evidence.work_tool_call_id &&
              !work.isError) {
            evidence.work_tool_scheduled = true;
          }
          const lifecycle = lifecycleEvent(classified, evidence.child_session_key);
          if (lifecycle && lifecycle.runId !== evidence.child_initial_run_id) {
            evidence.hop_two_run_id = lifecycle.runId;
            if (lifecycle.phase === 'start') evidence.hop_two_started = true;
            if (['end', 'error'].includes(lifecycle.phase)) {
              evidence.hop_two_completed = true;
              evidence.hop_two_terminal_phase = lifecycle.phase;
            }
          }
          const output = evidence.hop_two_run_id
            ? assistantTextEvent(
              classified,
              evidence.child_session_key,
              evidence.hop_two_run_id,
            )
            : null;
          if (output?.text.includes(`CHILD-HOP2-COMPLETE ${rowNonce}`)) {
            evidence.hop_two_sentinel_bound = true;
          }
        }
        if (evidence.work_tool_scheduled &&
            evidence.hop_two_started &&
            evidence.hop_two_completed &&
            evidence.hop_two_sentinel_bound) {
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
  const childBound = Boolean(
    evidence.child_session_key &&
    evidence.child_initial_run_id &&
    evidence.delegate_task_id &&
    evidence.delegate_flow_id &&
    evidence.parent_delegate_tool_started &&
    evidence.parent_delegate_tool_scheduled,
  );
  const distinctHop = Boolean(
    evidence.hop_two_run_id &&
    evidence.hop_two_run_id !== evidence.child_initial_run_id,
  );
  const ok = result?.status === 101 &&
    childBound &&
    evidence.work_tool_started &&
    evidence.work_tool_scheduled &&
    distinctHop &&
    evidence.hop_two_started &&
    evidence.hop_two_completed &&
    evidence.hop_two_terminal_phase === 'end' &&
    evidence.hop_two_sentinel_bound;
  check(null, {
    'child session/run/task/flow identity captured': () => childBound,
    'continue_delegate schedule bound to parent run': () =>
      evidence.parent_delegate_tool_started && evidence.parent_delegate_tool_scheduled,
    'continue_work schedule bound to initial child run': () =>
      evidence.work_tool_started && evidence.work_tool_scheduled,
    'hop two is a distinct run in the same child session': () => distinctHop,
    'hop two lifecycle completed with bound output': () =>
      evidence.hop_two_started && evidence.hop_two_completed &&
      evidence.hop_two_terminal_phase === 'end' && evidence.hop_two_sentinel_bound,
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
    'r-cw-delegate-child-live-producer-summary.json': JSON.stringify({
      row: ROW,
      producer: true,
      verdict: passed ? 'PASS-candidate' : 'PARTIAL-candidate',
    }, null, 2),
  };
}
