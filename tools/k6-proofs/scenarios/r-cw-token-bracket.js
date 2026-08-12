/**
 * Scenario: R-CW-TOKEN — bare CONTINUE_WORK token path from lightContext subagent.
 *
 * Proves that a child subagent final response ending in a bare CONTINUE_WORK
 * token does more than parse/strip: it schedules and drives hop-2, which emits
 * an explicit TOKEN-HOP2-DONE sentinel on wake.
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session. The parent session is instructed to call
 * sessions_spawn(lightContext=true, mode=run) for a child that emits the token.
 *
 * Required proof byte before PASS fold: hop-2 execution sentinel. Journal/Tempo
 * receipts are still expected for human review; this k6 scenario captures WS
 * session evidence and trace ids when surfaced.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#118
 *   - Manifest: tools/k6-proofs/manifests/r-cw-token.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent, assertConnected } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cw_token_bracket: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '180s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_token_duration: ['p(95)<150000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_token_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  tokenDelaySeconds: 5,
  idempotencyKeyPrefix: 'R-CW-TOKEN',
  taskNamePrefix: 'r-cw-token',
};
const HARNESS_MARKER = '[k6-proof-harness]';
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS || 1500);

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tokenDelaySeconds: Number(inv.tokenDelaySeconds ?? __ENV.OPENCLAW_TOKEN_DELAY_SECONDS ?? DEFAULTS.tokenDelaySeconds),
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    taskNamePrefix: inv.taskNamePrefix || DEFAULTS.taskNamePrefix,
    lightContext: inv.lightContext !== false,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-TOKEN');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const evidence = {
    row: 'R-CW-TOKEN',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Required receipts
    parent_dispatch_accepted: false,
    subagent_spawn_requested: false,
    subagent_spawn_accepted: false,
    token_emitted_or_stripped: false,
    hop_2_executed: false,
    parent_return: false,
    dispatch_accepted_at_ms: null,
    hop_2_at_ms: null,
    trace_id: null,
    child_session_key: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      socket.setTimeout(() => {
        const inv = invocationCfg();
        const taskName = `${inv.taskNamePrefix}-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
        const childTask =
          `k6 proof R-CW-TOKEN nonce ${rowNonce}. ` +
          `First turn: reply exactly TOKEN-HOP1 ${rowNonce}, then end your entire response with a bare CONTINUE_WORK:${inv.tokenDelaySeconds} token on its own final line. ` +
          `Do not call the continue_work tool. Do not wrap the token in brackets. ` +
          `On the continuation wake/hop-2, reply exactly TOKEN-HOP2-DONE ${rowNonce}. ` +
          `Do not mutate files. Do not post externally.`;
        const agentInstruction =
          `${HARNESS_MARKER} Call sessions_spawn exactly once with runtime="subagent", mode="run", ` +
          `taskName="${taskName}", label="k6 R-CW-TOKEN ${rowNonce}", lightContext=${inv.lightContext ? 'true' : 'false'}, ` +
          `context="isolated", cleanup="delete", and task=${JSON.stringify(childTask)}. ` +
          `After the sessions_spawn tool result is accepted, reply exactly PARENT-SPAWNED ${rowNonce}. ` +
          `This is a proof run.`;
        evidence.subagent_spawn_requested = true;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}`,
        });
      }, 500);

      // Child run plus token delay may be slow on a busy seat; keep the socket up.
      socket.setTimeout(() => socket.close(), 150000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cw-token-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CW-TOKEN ${rowNonce}`,
          });
        }, 250);
      } else {
        socket.setTimeout(() => startProofFlow(socket), 500);
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
            startProofFlow(socket);
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.parent_dispatch_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — parent agent turn triggered');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'event') {
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          const eventName = classified.event || '';

          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          if (eventData.childSessionKey) evidence.child_session_key = eventData.childSessionKey;

          if (eventStr.includes(rowNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) {
              console.log('ℹ Ignoring harness prompt echo event');
            } else if (evidence.parent_dispatch_accepted && evidence.dispatch_accepted_at_ms &&
              (Date.now() - evidence.dispatch_accepted_at_ms) >= POST_DISPATCH_EVIDENCE_GATE_MS) {
              if (eventStr.includes('PARENT-SPAWNED') || eventStr.includes('sessions_spawn') || eventStr.includes('childSessionKey')) {
                evidence.subagent_spawn_accepted = true;
                console.log('✓ parent sessions_spawn acceptance signal observed');
              }

              // The token is normally stripped before visible delivery; TOKEN-HOP1
              // or a continuation journal/event containing CONTINUE_WORK is enough
              // to establish the child reached the token-emitting turn.
              if (eventStr.includes(`TOKEN-HOP1 ${rowNonce}`) || eventStr.includes('CONTINUE_WORK')) {
                evidence.token_emitted_or_stripped = true;
                console.log('✓ token-emitting child turn observed');
              }

              if (eventStr.includes(`TOKEN-HOP2-DONE ${rowNonce}`)) {
                evidence.hop_2_executed = true;
                evidence.hop_2_at_ms = Date.now();
                evidence.parent_return = true;
                console.log('✓ TOKEN-HOP2-DONE sentinel observed — hop-2 executed');
              }

              if (eventName === 'session.message' && eventStr.includes(rowNonce) && eventStr.includes('TOKEN-HOP2-DONE')) {
                evidence.parent_return = true;
              }
            }
          }
        }

        if (evidence.parent_dispatch_accepted &&
            evidence.subagent_spawn_accepted &&
            evidence.token_emitted_or_stripped &&
            evidence.hop_2_executed &&
            evidence.parent_return) {
          console.log('All required R-CW-TOKEN evidence gathered, closing early');
          socket.close();
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
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'parent dispatch accepted': () => evidence.parent_dispatch_accepted,
    'subagent spawn requested': () => evidence.subagent_spawn_requested,
    'subagent spawn accepted': () => evidence.subagent_spawn_accepted,
    'token turn observed': () => evidence.token_emitted_or_stripped,
    'hop-2 executed (required)': () => evidence.hop_2_executed,
    'parent return received': () => evidence.parent_return,
  });

  if (!evidence.parent_dispatch_accepted ||
      !evidence.subagent_spawn_requested ||
      !evidence.subagent_spawn_accepted ||
      !evidence.token_emitted_or_stripped ||
      !evidence.hop_2_executed ||
      !evidence.parent_return) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.parent_dispatch_accepted &&
    evidence.subagent_spawn_requested &&
    evidence.subagent_spawn_accepted &&
    evidence.token_emitted_or_stripped &&
    evidence.hop_2_executed &&
    evidence.parent_return;

  console.log(`\n--- R-CW-TOKEN EVIDENCE SUMMARY ---`);
  // Rig-fault guard (see assertConnected): a refused WS upgrade yields an
  // artefact identical to a genuine failure — 0 ms, every flag false. Record
  // it explicitly so this row is never published as evidence about the feature.
  const connectFault = assertConnected(res);
  if (connectFault) evidence.connect_failed = connectFault;

  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CW-TOKEN] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CW-TOKEN',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cw_token_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CW-TOKEN] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cw-token-bracket-summary.json': JSON.stringify(summary, null, 2),
  };
}
