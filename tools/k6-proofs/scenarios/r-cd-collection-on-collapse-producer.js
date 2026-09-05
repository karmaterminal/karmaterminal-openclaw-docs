import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  acceptedSpawn,
  assistantTextEvent,
  boolEnv,
  disposableSessionKey,
  eventDedupKey,
  eventIdentity,
  lifecycleEvent,
  renderTemplate,
  requireGatewayToken,
  taskRecordsForIdentity,
  uniquePush,
} from '../lib/producer-live-harness.js';

export const options = {
  scenarios: {
    r_cd_collection_on_collapse: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '210s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_collection_on_collapse_duration: ['p(95)<200000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_collection_on_collapse_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CD-COLLECTION-ON-COLLAPSE';

export default function () {
  const token = requireGatewayToken();
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const invocation = manifest?.invocation || {};
  const rowNonce = nonce('R-CD-COLLECTION');
  const bIdentity = `B-IDENTITY-${rowNonce}`;
  const bLabel = `RCD-COLLECTION-B-${rowNonce}`;
  const cIdentity = `C-IDENTITY-${rowNonce}`;
  const cTask = `${cIdentity} ${renderTemplate(invocation.promptTemplate, rowNonce)}`;
  const bTask = renderTemplate(invocation.spawnPromptTemplate, rowNonce, {
    cTaskJson: JSON.stringify(cTask),
    childDelaySeconds: invocation.childDelaySeconds ?? 5,
  });
  const identifiedBTask = `${bIdentity} ${bTask}`;
  if (!cTask || !bTask) {
    console.error('manifest invocation.promptTemplate and spawnPromptTemplate are required');
    failures.add(1);
    return;
  }

  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  let rootSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') ||
    boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const evidence = {
    row: ROW,
    producer: true,
    nonce: rowNonce,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    dispatch_accepted_at_ms: null,
    root_session_key: null,
    root_run_id: null,
    b_session_key: null,
    b_run_id: null,
    b_task_id: null,
    b_flow_id: null,
    b_terminal_at_ms: null,
    b_terminal_phase: null,
    c_session_key: null,
    c_run_id: null,
    c_task_id: null,
    c_flow_id: null,
    c_started_at_ms: null,
    c_terminal_at_ms: null,
    c_terminal_phase: null,
    root_collection_run_id: null,
    root_collected_at_ms: null,
    delegate_mode: invocation.mode || 'normal',
    fanout_mode: invocation.fanoutMode || 'tree',
    prompt_executed_exactly: true,
    redacted_events: [],
  };
  const seenEvents = {};
  const subscribed = {};
  const started = Date.now();

  const result = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function subscribe(key) {
      if (!key || subscribed[key]) return;
      subscribed[key] = true;
      tracker.send(socket, 'sessions.messages.subscribe', { key });
    }

    function pollTasks(delayMs) {
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 100 }), delayMs);
    }

    function startProof() {
      subscribe(rootSessionKey);
      const instruction =
        `[k6-proof-harness] R-CD-COLLECTION-ON-COLLAPSE nonce ${rowNonce}. ` +
        `Call sessions_spawn exactly once with runtime="subagent", mode="run", context="isolated", ` +
        `cleanup="keep", label="${bLabel}", and task=${JSON.stringify(identifiedBTask)}. ` +
        `After the accepted tool result, wait for the tree-fanout C return and then reply exactly ` +
        `ROOT-COLLECTED ${rowNonce}. Do not infer completion from this instruction.`;
      tracker.send(socket, 'sessions.send', {
        key: rootSessionKey,
        message: instruction,
        idempotencyKey: `R-CD-COLLECTION-${rowNonce}`,
      });
      for (const delayMs of [3_000, 8_000, 15_000, 30_000, 60_000, 100_000, 150_000]) {
        pollTasks(delayMs);
      }
      socket.setTimeout(() => socket.close(), 200_000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createSession) {
        socket.setTimeout(() => tracker.send(socket, 'sessions.create', {
          key: disposableSessionKey('r-cd-collection', rowNonce),
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
        if (dedupKey && seenEvents[dedupKey]) return;
        if (dedupKey) seenEvents[dedupKey] = true;
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
          rootSessionKey = classified.payload.key;
          startProof();
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (!classified.ok) failures.add(1);
          else {
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.root_session_key = rootSessionKey;
            evidence.root_run_id = classified.payload?.runId || null;
          }
        }

        const spawn = acceptedSpawn(
          classified,
          rootSessionKey,
          evidence.root_run_id,
        );
        if (spawn && spawn.mode === 'run' && spawn.context === 'isolated') {
          evidence.b_session_key = spawn.childSessionKey;
          evidence.b_run_id = spawn.childRunId;
          subscribe(spawn.childSessionKey);
        }

        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          for (const task of taskRecordsForIdentity(classified.payload, [bLabel])) {
            if (task.childSessionKey === evidence.b_session_key && task.runId === evidence.b_run_id) {
              evidence.b_task_id = task.taskId;
              evidence.b_flow_id = task.flowId;
              if (['completed', 'failed', 'cancelled', 'timed_out'].includes(task.status)) {
                evidence.b_terminal_at_ms = task.updatedAt || Date.now();
              }
            }
          }
          for (const task of taskRecordsForIdentity(classified.payload, [cIdentity])) {
            if (task.childSessionKey && task.childSessionKey !== evidence.b_session_key) {
              evidence.c_task_id = task.taskId;
              evidence.c_flow_id = task.flowId;
              evidence.c_session_key = task.childSessionKey;
              evidence.c_run_id = task.runId;
              subscribe(task.childSessionKey);
            }
          }
        }

        if (evidence.b_session_key && evidence.b_run_id) {
          const bLifecycle = lifecycleEvent(classified, evidence.b_session_key, evidence.b_run_id);
          if (bLifecycle && ['end', 'error'].includes(bLifecycle.phase)) {
            evidence.b_terminal_at_ms = bLifecycle.endedAt || Date.now();
            evidence.b_terminal_phase = bLifecycle.phase;
          }
        }
        if (evidence.c_session_key) {
          const cLifecycle = lifecycleEvent(classified, evidence.c_session_key);
          if (cLifecycle?.phase === 'start') {
            evidence.c_run_id = cLifecycle.runId;
            evidence.c_started_at_ms = cLifecycle.startedAt || Date.now();
          }
          if (cLifecycle && ['end', 'error'].includes(cLifecycle.phase)) {
            evidence.c_run_id = cLifecycle.runId;
            evidence.c_terminal_at_ms = cLifecycle.endedAt || Date.now();
            evidence.c_terminal_phase = cLifecycle.phase;
          }
        }
        const rootText = assistantTextEvent(classified, rootSessionKey);
        if (rootText?.text.includes(`ROOT-COLLECTED ${rowNonce}`)) {
          evidence.root_collection_run_id = rootText.runId;
          evidence.root_collected_at_ms = rootText.ts || Date.now();
        }

        if (evidence.b_terminal_at_ms &&
            evidence.c_started_at_ms &&
            evidence.c_terminal_at_ms &&
            evidence.root_collected_at_ms) {
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
  const distinctSessions = new Set([
    evidence.root_session_key,
    evidence.b_session_key,
    evidence.c_session_key,
  ]).size === 3;
  const bBeforeC = Number(evidence.b_terminal_at_ms) < Number(evidence.c_started_at_ms);
  const lineageBound = Boolean(
    evidence.root_run_id &&
    evidence.b_run_id &&
    evidence.b_task_id &&
    evidence.c_run_id &&
    evidence.c_task_id &&
    evidence.c_flow_id &&
    evidence.root_collection_run_id,
  );
  const ok = result?.status === 101 &&
    evidence.delegate_mode === 'normal' &&
    evidence.fanout_mode === 'tree' &&
    distinctSessions &&
    lineageBound &&
    evidence.b_terminal_phase === 'end' &&
    evidence.c_terminal_phase === 'end' &&
    bBeforeC &&
    evidence.root_collection_run_id !== evidence.root_run_id &&
    Number(evidence.root_collected_at_ms) >= Number(evidence.c_terminal_at_ms);
  check(null, {
    'supported delegate mode normal and tree fanout': () =>
      evidence.delegate_mode === 'normal' && evidence.fanout_mode === 'tree',
    'A/B/C session and run lineage bound': () => distinctSessions && lineageBound,
    'B terminalized successfully before C started': () =>
      evidence.b_terminal_phase === 'end' && bBeforeC,
    'C completed before root A collection': () =>
      evidence.c_terminal_phase === 'end' &&
      evidence.root_collection_run_id !== evidence.root_run_id &&
      Number(evidence.root_collected_at_ms) >= Number(evidence.c_terminal_at_ms),
  });
  if (!ok) failures.add(1);
  console.log(`\n--- ${ROW} EVIDENCE ---\n${JSON.stringify(evidence, null, 2)}\n--- END ---`);
  console.log(`[${ROW}] VERDICT: ${ok ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const passed = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cd-collection-on-collapse-producer-summary.json': JSON.stringify({
      row: ROW,
      producer: true,
      verdict: passed ? 'PASS-candidate' : 'PARTIAL-candidate',
    }, null, 2),
  };
}
