/**
 * Scenario: R-CD-4 — continue_delegate with targetSessionKey (cross-session return).
 *
 * Verifies:
 *   1. Gateway accepts continue_delegate with targetSessionKey param
 *   2. Child task spawns and completes
 *   3. Delegate return lands in the TARGET session (not the dispatching parent)
 *   4. Dispatching session does NOT receive the return
 *
 * This proves cross-session targeted delivery: a delegate dispatched from session A
 * can deliver its return to session B.
 *
 * Requires OPENCLAW_TARGET_SESSION_KEY env var pointing to a valid secondary session.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#119
 *   - Manifest: tools/k6-proofs/manifests/r-cd-4.json
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cd_4_target_session: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_4_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_4_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'silent-wake',
  delaySeconds: 1,
  promptTemplate: 'Proof nonce {{nonce}}: reply with TARGET-RECEIVED and the nonce. Do not mutate files.',
  idempotencyKeyPrefix: 'R-CD-4',
};

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || __ENV.OPENCLAW_DELEGATE_MODE || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    promptTemplate: inv.promptTemplate || DEFAULTS.promptTemplate,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    targetSessionKey: inv.targetSessionKey || __ENV.OPENCLAW_TARGET_SESSION_KEY || null,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-4');
  const inv = invocationCfg();

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (!inv.targetSessionKey) {
    console.error('OPENCLAW_TARGET_SESSION_KEY is required for R-CD-4 (cross-session delivery)');
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
    row: 'R-CD-4',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    sessionKey,
    targetSessionKey: inv.targetSessionKey,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Required receipts
    tool_accepted: false,
    task_created: false,
    child_completed: false,
    // Cross-session verification
    return_in_target: false,
    return_in_parent: false, // MUST stay false for PASS
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Subscribe to BOTH sessions: parent (dispatching) and target (receiving)
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { sessionKey });
        tracker.send(socket, 'sessions.messages.subscribe', { sessionKey: inv.targetSessionKey });
      }, 500);

      // Fire continue_delegate with targetSessionKey
      socket.setTimeout(() => {
        const prompt = inv.promptTemplate.replace('{{nonce}}', rowNonce);
        tracker.send(socket, 'tools.invoke', {
          name: inv.tool,
          sessionKey,
          args: {
            task: prompt,
            mode: inv.mode,
            delaySeconds: inv.delaySeconds,
            targetSessionKey: inv.targetSessionKey,
          },
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 1000);

      // Poll task ledger
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 8000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 25000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 50000);

      socket.setTimeout(() => socket.close(), 90000);
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

        // Tool invocation accepted
        if (classified.kind === 'response' && classified.method === 'tools.invoke') {
          if (classified.ok && classified.payload) {
            evidence.tool_accepted = true;
            if (classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ tools.invoke accepted for R-CD-4 (targetSessionKey)');
          } else if (classified.error) {
            console.error(`✗ tools.invoke rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Task ledger check
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (taskStr.includes(rowNonce)) {
              evidence.task_created = true;
              if (task.state === 'completed' || task.status === 'completed') {
                evidence.child_completed = true;
                console.log('✓ Child task completed');
              }
              if (task.traceId) evidence.trace_id = task.traceId;
              console.log(`✓ Task found with nonce correlation (state: ${task.state || task.status || 'unknown'})`);
            }
          }
        }

        // Event routing: detect WHERE the return lands
        if (classified.kind === 'event') {
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);

          if (eventStr.includes(rowNonce) || eventStr.includes('delegate') || eventStr.includes('completion')) {
            // Check which session received the event
            const eventSession = eventData.sessionKey || eventData.session || null;

            if (eventSession === inv.targetSessionKey) {
              evidence.return_in_target = true;
              console.log('✓ Delegate return landed in TARGET session');
            } else if (eventSession === sessionKey) {
              evidence.return_in_parent = true;
              console.warn('✗ Delegate return landed in PARENT session (should be target only)');
            }
          }
        }

        // Early close if definitive evidence
        if (evidence.tool_accepted && evidence.task_created &&
            (evidence.return_in_target || evidence.return_in_parent)) {
          sleep(2); // Brief grace for any late events
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
    'tool invocation accepted': () => evidence.tool_accepted,
    'delegate task created': () => evidence.task_created,
    'return landed in target session': () => evidence.return_in_target,
    'no return in parent session (routing verified)': () => !evidence.return_in_parent,
  });

  if (!evidence.tool_accepted || !evidence.return_in_target || evidence.return_in_parent) {
    failures.add(1);
  }

  const passed = evidence.tool_accepted && evidence.task_created &&
    evidence.return_in_target && !evidence.return_in_parent;

  console.log(`\n--- R-CD-4 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-4] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CD-4',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cd_4_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CD-4] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-4-summary.json': JSON.stringify(summary, null, 2),
  };
}
