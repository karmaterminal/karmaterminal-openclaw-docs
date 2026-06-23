/**
 * Scenario: R-CD-TOKEN — bracket [[CONTINUE_DELEGATE: ...]] path.
 *
 * Injects a prompt via sessions.send that instructs the agent to end
 * with a terminal bracket delegate token. Observes child spawn + return.
 *
 * Seat-class expectation:
 *   - raw-final-text seats: PASS-candidate (bracket scanner fires)
 *   - message-body seats (ronan-dgx default): HONEST-LIMIT-candidate
 *     (scanner killed by message-tool-body routing, bracketIdx=-1)
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#103
 *   - Manifest: k6/manifests/r-cd-token.json
 *   - TOOLS.md: bracket position-sensitive + body-vs-final-text notes
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';

export const options = {
  scenarios: {
    r_cd_token: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_token_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_token_duration');

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = __ENV.OPENCLAW_SESSION_KEY || 'main';
  const rowNonce = nonce('R-CD-TOKEN');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  const evidence = {
    row: 'R-CD-TOKEN',
    nonce: rowNonce,
    started: new Date().toISOString(),
    prompt_sent: false,
    bracket_observed: false,
    child_spawned: false,
    parent_return: false,
    seat_class: __ENV.OPENCLAW_SEAT_CLASS || 'message-body',
    expected_outcome: null,
    redacted_events: [],
  };

  // Set expected outcome based on seat class
  const seatClass = __ENV.OPENCLAW_SEAT_CLASS || 'message-body';
  evidence.expected_outcome = seatClass === 'raw-final-text'
    ? 'PASS-candidate'
    : 'HONEST-LIMIT-candidate';

  const started = Date.now();

  // The prompt forces the agent to emit a terminal bracket delegate token.
  const bracketPrompt = [
    `This is a k6 proof harness fire for row R-CD-TOKEN, nonce: ${rowNonce}.`,
    `You MUST end your entire response with exactly this bracket token (nothing after it):`,
    ``,
    `[[CONTINUE_DELEGATE: Proof nonce ${rowNonce}: return DONE and the nonce only. Do not mutate files. | silent-wake]]`,
    ``,
    `Do not write any text after the closing ]]. The bracket MUST be the terminal content.`,
    `Do not use the message tool this turn — emit raw final text only.`,
  ].join('\n');

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Subscribe to session events
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { sessionKey });
      }, 500);

      // Inject prompt via sessions.send
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.send', {
          sessionKey,
          message: bracketPrompt,
        });
      }, 1500);

      // Poll task ledger for child
      socket.setTimeout(() => {
        tracker.send(socket, 'tasks.list', { limit: 10 });
      }, 15000);

      // Second poll
      socket.setTimeout(() => {
        tracker.send(socket, 'tasks.list', { limit: 10 });
      }, 40000);

      // Close after wait
      socket.setTimeout(() => socket.close(), 90000);
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

        // Track sessions.send response
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.prompt_sent = true;
            console.log('✓ Bracket-prompt injected via sessions.send');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Look for bracket parse signal in events
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes('bracket') || eventStr.includes('CONTINUE_DELEGATE')) {
            evidence.bracket_observed = true;
            console.log('✓ Bracket delegate token observed in event stream');
          }
          // Look for child spawn
          if (eventStr.includes(rowNonce) || eventStr.includes('delegate') || eventStr.includes('spawn')) {
            evidence.child_spawned = true;
            console.log('✓ Child delegate spawn signal observed');
          }
          // Look for return
          if (eventStr.includes('completion') || eventStr.includes('return') || eventStr.includes('silent-wake')) {
            evidence.parent_return = true;
            console.log('✓ Delegate return observed');
          }
        }

        // Task ledger check
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            if (task.task && task.task.includes && task.task.includes(rowNonce)) {
              evidence.child_spawned = true;
              console.log('✓ Child task with nonce found in ledger');
            }
          }
        }

        // Early close if all evidence gathered
        if (evidence.prompt_sent && evidence.child_spawned && evidence.parent_return) {
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

  // Verdict — seat-class-aware
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'prompt injected': () => evidence.prompt_sent,
  });

  if (!evidence.prompt_sent) {
    failures.add(1);
    console.error('FAIL: Could not inject bracket prompt');
  }

  // Seat-class-aware outcome classification
  if (evidence.prompt_sent && !evidence.bracket_observed && seatClass === 'message-body') {
    // Expected: message-body seats kill the bracket scanner
    console.log(`NOTE: bracket not observed — HONEST-LIMIT-candidate (expected for ${seatClass} seat)`);
    console.log('This is expected behavior per TOOLS.md: message-tool-body routing → bracketIdx=-1');
  } else if (evidence.prompt_sent && !evidence.bracket_observed && seatClass === 'raw-final-text') {
    // Unexpected: raw-final-text seat should fire the bracket
    console.error('UNEXPECTED: bracket not observed on raw-final-text seat — investigate');
    failures.add(1);
  }

  console.log(`\n--- R-CD-TOKEN EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
