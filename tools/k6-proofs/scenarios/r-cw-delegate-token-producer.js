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
  uniquePush,
} from '../lib/producer-live-harness.js';

export const options = {
  scenarios: {
    r_cw_delegate_token: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '190s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_delegate_token_duration: ['p(95)<180000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_delegate_token_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-DELEGATE-TOKEN';

export default function () {
  const token = requireGatewayToken();
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const invocation = manifest?.invocation || {};
  const rowNonce = nonce('R-CW-DELEGATE-TOKEN');
  const tokenDelaySeconds = invocation.tokenDelaySeconds ?? 5;
  const exactToken = `[[CONTINUE_WORK:${tokenDelaySeconds}]]`;
  const childTask = renderTemplate(invocation.promptTemplate, rowNonce, {
    token: exactToken,
  });
  if (!childTask) {
    console.error('manifest invocation.promptTemplate is required');
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
    child_session_key: null,
    child_initial_run_id: null,
    spawn_tool_call_id: null,
    spawn_mode: null,
    spawn_context: null,
    light_context_requested: true,
    child_tool_inventory: [],
    child_continue_work_tool_present: null,
    typed_continue_work_observed: false,
    token: exactToken,
    token_grammar_valid: /^\[\[CONTINUE_WORK(?::\d+)?\]\]$/u.test(exactToken),
    raw_final_text_token_observed: false,
    message_tool_body_token_observed: false,
    parser_origin_required: 'bracket',
    hop_two_run_id: null,
    hop_two_started: false,
    hop_two_completed: false,
    hop_two_terminal_phase: null,
    hop_two_sentinel_bound: false,
    prompt_executed_exactly: true,
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
        `[k6-proof-harness] R-CW-DELEGATE-TOKEN nonce ${rowNonce}. ` +
        `Call sessions_spawn exactly once with runtime="subagent", mode="run", context="isolated", ` +
        `lightContext=true, cleanup="keep", label="RCW-DELEGATE-TOKEN-${rowNonce}", ` +
        `and task=${JSON.stringify(childTask)}. After its accepted result, reply exactly ` +
        `PARENT-SPAWNED ${rowNonce}.`;
      tracker.send(socket, 'sessions.send', {
        key: parentSessionKey,
        message: instruction,
        idempotencyKey: `${invocation.idempotencyKeyPrefix || ROW}-${rowNonce}`,
      });
      socket.setTimeout(() => socket.close(), 180_000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createSession) {
        socket.setTimeout(() => tracker.send(socket, 'sessions.create', {
          key: disposableSessionKey('r-cw-delegate-token', rowNonce),
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
        const spawn = acceptedSpawn(classified, parentSessionKey, evidence.parent_run_id);
        if (spawn) {
          evidence.child_session_key = spawn.childSessionKey;
          evidence.child_initial_run_id = spawn.childRunId;
          evidence.spawn_tool_call_id = spawn.toolCallId;
          evidence.spawn_mode = spawn.mode;
          evidence.spawn_context = spawn.context;
          subscribe(spawn.childSessionKey);
          tracker.send(socket, 'tools.effective', { sessionKey: spawn.childSessionKey });
        }
        if (classified.kind === 'response' && classified.method === 'tools.effective') {
          if (!classified.ok || !Array.isArray(classified.payload?.groups)) {
            failures.add(1);
            evidence.child_continue_work_tool_present = null;
            return;
          }
          const tools = classified.payload.groups.flatMap((group) =>
            Array.isArray(group?.tools) ? group.tools : []);
          for (const tool of tools) {
            const name = typeof tool === 'string' ? tool : tool?.id;
            if (typeof name === 'string') uniquePush(evidence.child_tool_inventory, name);
          }
          evidence.child_continue_work_tool_present =
            evidence.child_tool_inventory.includes('continue_work');
        }
        if (identity &&
            identity.sessionKey === evidence.child_session_key &&
            identity.runId === evidence.child_initial_run_id &&
            identity.stream === 'tool') {
          if (identity.data?.name === 'continue_work') evidence.typed_continue_work_observed = true;
          if (identity.data?.name === 'message' &&
              JSON.stringify(identity.data).includes(exactToken)) {
            evidence.message_tool_body_token_observed = true;
          }
        }
        const initialOutput = assistantTextEvent(
          classified,
          evidence.child_session_key,
          evidence.child_initial_run_id,
        );
        if (initialOutput?.text.trimEnd().endsWith(exactToken)) {
          evidence.raw_final_text_token_observed = true;
        }
        if (evidence.child_session_key) {
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
          if (output?.text.includes(`TOKEN-HOP2-COMPLETE ${rowNonce}`)) {
            evidence.hop_two_sentinel_bound = true;
          }
        }
        if (evidence.child_continue_work_tool_present === false &&
            !evidence.typed_continue_work_observed &&
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
  const childBound = Boolean(evidence.child_session_key && evidence.child_initial_run_id);
  const distinctHop = Boolean(
    evidence.hop_two_run_id &&
    evidence.hop_two_run_id !== evidence.child_initial_run_id,
  );
  const ok = result?.status === 101 &&
    childBound &&
    evidence.spawn_mode === 'run' &&
    evidence.spawn_context === 'isolated' &&
    evidence.child_continue_work_tool_present === false &&
    !evidence.typed_continue_work_observed &&
    !evidence.message_tool_body_token_observed &&
    distinctHop &&
    evidence.hop_two_started &&
    evidence.hop_two_completed &&
    evidence.hop_two_terminal_phase === 'end' &&
    evidence.hop_two_sentinel_bound;
  check(null, {
    'supported light-context sessions_spawn child captured': () =>
      childBound && evidence.spawn_mode === 'run' && evidence.spawn_context === 'isolated',
    'child inventory denies typed continue_work': () =>
      evidence.child_continue_work_tool_present === false && !evidence.typed_continue_work_observed,
    'message-tool body cannot satisfy token proof': () =>
      !evidence.message_tool_body_token_observed,
    'token grammar is exact product grammar': () => evidence.token_grammar_valid,
    'hop two is a distinct completed child run': () =>
      distinctHop && evidence.hop_two_started && evidence.hop_two_completed &&
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
    'r-cw-delegate-token-producer-summary.json': JSON.stringify({
      row: ROW,
      producer: true,
      verdict: passed ? 'PASS-candidate' : 'PARTIAL-candidate',
      requiresParserOriginReceipt: true,
    }, null, 2),
  };
}
