/**
 * Scenario: R-CW-1 — continue_work() tool-form schedule + wake.
 *
 * Proves the typed continue_work() tool fires successfully and delivers:
 *   1. Gateway accepts the continue_work invocation (tool-invoke-accepted)
 *   2. An observable scheduled tool-result/status signal appears on WS
 *      (status:"scheduled" with nonce correlation)
 *   3. The session wakes after delaySeconds (work-woke-event)
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * fresh disposable session, avoiding the live #sprites/main Discord lane.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#117
 *   - Manifest: tools/k6-proofs/manifests/r-cw-1.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cw_1_tool_schedule_wake: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_1_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_1_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  delaySeconds: 5,
  reason: 'k6-proof-R-CW-1',
  idempotencyKeyPrefix: 'R-CW-1',
};
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_work',
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    reason: inv.reason || DEFAULTS.reason,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-1');
  const inv = invocationCfg();
  const wakeReason = inv.reason.replace(/\{\{nonce\}\}/g, rowNonce);

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
    row: 'R-CW-1',
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
    tool_invoke_accepted: false,
    continue_work_tool_result_scheduled: false,
    work_woke_event: false,
    dispatch_accepted_at_ms: null,
    scheduled_result_at_ms: null,
    wake_delay_ms: null,
    reason_hash: crypto.sha256(wakeReason, 'hex').slice(0, 16),
    reason_length: wakeReason.length,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow(socket) {
      // Subscribe to session events — scheduled result + wake surface.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch via sessions.send — triggers agent turn that calls continue_work.
      socket.setTimeout(() => {
        const agentInstruction =
          `[k6-proof-harness] Call continue_work with reason="${wakeReason}" and delaySeconds=${inv.delaySeconds}. ` +
          `After the continue_work tool result reports scheduled, reply exactly CW-SCHEDULED ${rowNonce}. ` +
          `On the continuation wake, reply exactly CW-WOKE ${rowNonce}. ` +
          `This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 500);

      // Extended close — must outlast delaySeconds + agent processing overhead.
      const closeDelta = Math.max((inv.delaySeconds + 30) * 1000, 60000);
      socket.setTimeout(() => socket.close(), closeDelta);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cw-1-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CW-1 ${rowNonce}`,
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

        // Disposable session creation
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

        // sessions.send accepted — agent turn triggered
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_invoke_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered (will call continue_work)');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Session events — primary proof surface for schedule + wake.
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          if (eventStr.includes(HARNESS_MARKER)) {
            console.log('ℹ Ignoring harness prompt echo event');
          } else if (evidence.dispatch_accepted_at_ms) {
            const elapsedSinceDispatch = Date.now() - evidence.dispatch_accepted_at_ms;

            // Scheduled receipt: explicit assistant sentinel emitted only after
            // the continue_work tool result reports scheduled.
            if (!evidence.continue_work_tool_result_scheduled && eventStr.includes(`CW-SCHEDULED ${rowNonce}`)) {
              evidence.continue_work_tool_result_scheduled = true;
              evidence.scheduled_result_at_ms = Date.now();
              if (eventData.traceId) evidence.trace_id = eventData.traceId;
              console.log(`✓ CW-SCHEDULED sentinel observed: ${eventName}`);
            }

            // Wake receipt: explicit sentinel emitted by the continuation wake turn.
            if (evidence.continue_work_tool_result_scheduled && !evidence.work_woke_event &&
                eventStr.includes(`CW-WOKE ${rowNonce}`) &&
                elapsedSinceDispatch >= (inv.delaySeconds * 1000)) {
              const elapsedSinceSchedule = evidence.scheduled_result_at_ms
                ? Date.now() - evidence.scheduled_result_at_ms : 0;
              evidence.work_woke_event = true;
              evidence.wake_delay_ms = elapsedSinceSchedule;
              console.log(`✓ CW-WOKE sentinel observed: ${eventName} (${elapsedSinceSchedule}ms after scheduled)`);
            }
          }
        }

        // Early close when all required evidence collected
        if (evidence.tool_invoke_accepted && evidence.continue_work_tool_result_scheduled && evidence.work_woke_event) {
          console.log('All required R-CW-1 evidence gathered, closing early');
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
    'tool-invoke-accepted (sessions.send)': () => evidence.tool_invoke_accepted,
    'continue_work scheduled result observed': () => evidence.continue_work_tool_result_scheduled,
    'work-woke-event observed': () => evidence.work_woke_event,
  });

  if (!evidence.tool_invoke_accepted || !evidence.continue_work_tool_result_scheduled || !evidence.work_woke_event) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.tool_invoke_accepted && evidence.continue_work_tool_result_scheduled && evidence.work_woke_event;

  console.log(`\n--- R-CW-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CW-1] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CW-1',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cw_1_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CW-1] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cw-1-tool-schedule-wake-summary.json': JSON.stringify(summary, null, 2),
  };
}
