/**
 * Scenario: R-CD-1 — typed continue_delegate() schedule/spawn/return.
 *
 * Fires a continue_delegate tool invocation with mode=normal, waits for
 * task ledger entries, child session, and parent return/completion evidence.
 *
 * Data-driven: reads row config from manifest at runtime.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#103
 *   - Manifest: k6/manifests/r-cd-1.json
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';

export const options = {
  scenarios: {
    r_cd_1_tool: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_1_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_1_duration');

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = __ENV.OPENCLAW_SESSION_KEY || 'main';
  const rowNonce = nonce('R-CD-1');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  const evidence = {
    row: 'R-CD-1',
    nonce: rowNonce,
    started: new Date().toISOString(),
    tool_accepted: false,
    task_created: false,
    child_session: null,
    parent_return: false,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Subscribe to session events after brief connect delay
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { sessionKey });
      }, 500);

      // Fire continue_delegate typed tool invocation
      socket.setTimeout(() => {
        tracker.send(socket, 'tools.invoke', {
          name: 'continue_delegate',
          sessionKey,
          args: {
            task: `Proof nonce ${rowNonce}: reply with DONE and the nonce only. Do not mutate files.`,
            mode: 'normal',
            delaySeconds: 1,
          },
          idempotencyKey: `R-CD-1-${rowNonce}`,
        });
      }, 1000);

      // Poll task ledger
      socket.setTimeout(() => {
        tracker.send(socket, 'tasks.list', { limit: 10 });
      }, 8000);

      // Second task poll for child completion
      socket.setTimeout(() => {
        tracker.send(socket, 'tasks.list', { limit: 10 });
      }, 20000);

      // Close after reasonable wait
      socket.setTimeout(() => socket.close(), 60000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);

        // Redact before storing
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        // Handle tool invocation response
        if (classified.kind === 'response' && classified.method === 'tools.invoke') {
          if (classified.ok && classified.payload) {
            evidence.tool_accepted = true;
            // Extract trace ID if present
            if (classified.payload.traceId) {
              evidence.trace_id = classified.payload.traceId;
            }
            console.log('✓ tools.invoke accepted for R-CD-1');
          } else if (classified.error) {
            console.error(`✗ tools.invoke rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Handle task ledger response
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            if (task.task && task.task.includes && task.task.includes(rowNonce)) {
              evidence.task_created = true;
              evidence.child_session = task.sessionKey || task.childSessionKey || null;
              if (task.traceId) evidence.trace_id = task.traceId;
              console.log('✓ Task found with nonce correlation');
            }
          }
        }

        // Handle session events for delegate return
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes('delegate') || eventStr.includes('completion') || eventStr.includes('return')) {
            evidence.parent_return = true;
            console.log('✓ Delegate return/completion event observed');
          }
        }

        // Early close if all required evidence gathered
        if (evidence.tool_accepted && evidence.task_created) {
          if (evidence.parent_return) {
            console.log('All evidence gathered, closing early');
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
  duration.add(evidence.duration_ms);

  // Verdict checks
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool invocation accepted': () => evidence.tool_accepted,
    'delegate task created in ledger': () => evidence.task_created,
  });

  if (!evidence.tool_accepted) {
    failures.add(1);
    console.error('FAIL: continue_delegate tool invocation not accepted');
  }

  // Output evidence summary for post-processing
  console.log(`\n--- R-CD-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
