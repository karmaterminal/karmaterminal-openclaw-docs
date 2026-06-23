/**
 * Scenario: R-CD-1 — typed continue_delegate() schedule/spawn/return.
 *
 * Fires a continue_delegate tool invocation with mode=normal, waits for
 * task ledger entries, child session, and parent return/completion evidence.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#103
 *   - Spec: openclaw-bootstrap/.specify/notes/k6-for-proofs-deterministic-elements.md
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, frame, nonce } from '../lib/gateway-ws.js';

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
    r_cd_1_failures: ['count==0'],
    r_cd_1_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('r_cd_1_failures');
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
    events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    let connected = false;
    let toolResponseReceived = false;

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Wait for connect ack, then fire the delegate
      socket.setTimeout(() => {
        // Subscribe to session events first
        socket.send(frame('sessions.messages.subscribe', { sessionKey }));

        // Fire continue_delegate typed tool invocation
        socket.send(frame('tools.invoke', {
          name: 'continue_delegate',
          sessionKey,
          args: {
            task: `Proof nonce ${rowNonce}: reply with DONE and the nonce only. Do not mutate files.`,
            mode: 'normal',
            delaySeconds: 1,
          },
          idempotencyKey: `R-CD-1-${rowNonce}`,
        }));
      }, 1000);

      // Poll task ledger
      socket.setTimeout(() => {
        socket.send(frame('tasks.list', { limit: 10 }));
      }, 5000);

      // Second task poll for child completion
      socket.setTimeout(() => {
        socket.send(frame('tasks.list', { limit: 10 }));
      }, 15000);

      // Close after reasonable wait
      socket.setTimeout(() => socket.close(), 60000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        evidence.events.push({ ts: Date.now(), msg });

        // Track connect acknowledgment
        if (msg.type === 'res' && msg.method === 'connect') {
          connected = true;
        }

        // Track tool invocation response
        if (msg.result && msg.id && msg.id.includes && raw.includes('tools.invoke')) {
          if (msg.ok !== false && msg.result) {
            evidence.tool_accepted = true;
            toolResponseReceived = true;
            console.log(`✓ tools.invoke accepted for R-CD-1`);
          }
        }

        // Track task ledger for delegate task
        if (msg.result && msg.result.tasks && Array.isArray(msg.result.tasks)) {
          for (const task of msg.result.tasks) {
            if (task.task && task.task.includes && task.task.includes(rowNonce)) {
              evidence.task_created = true;
              evidence.child_session = task.sessionKey || task.childSessionKey || null;
              console.log(`✓ Task found with nonce correlation`);
            }
          }
        }

        // Track session events for delegate return
        if (msg.type === 'event' && msg.event) {
          if (msg.event.includes && (
            msg.event.includes('delegate') ||
            msg.event.includes('completion') ||
            msg.event.includes('return')
          )) {
            evidence.parent_return = true;
            console.log(`✓ Delegate return/completion event observed`);
          }
        }

        // Early close if all evidence gathered
        if (evidence.tool_accepted && evidence.task_created && evidence.parent_return) {
          console.log('All evidence gathered, closing early');
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
