/**
 * Scenario: R-CD-TOKEN — bracket [[CONTINUE_DELEGATE: ...]] path.
 *
 * Injects a prompt via sessions.send that instructs the agent to end
 * with a terminal bracket delegate token. Observes child spawn + return.
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
    r_cd_token: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    r_cd_token_failures: ['count==0'],
    r_cd_token_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('r_cd_token_failures');
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
    events: [],
  };

  const started = Date.now();

  // The prompt forces the agent to emit a terminal bracket delegate token.
  // lightContext subagent is the intended target (per existing R-CD-TOKEN evidence).
  const bracketPrompt = [
    `This is a k6 proof harness fire for row R-CD-TOKEN, nonce: ${rowNonce}.`,
    `You MUST end your entire response with exactly this bracket token (nothing after it):`,
    ``,
    `[[CONTINUE_DELEGATE: Proof nonce ${rowNonce}: return DONE and the nonce only. Do not mutate files. | silent-wake]]`,
    ``,
    `Do not write any text after the closing ]]. The bracket MUST be the terminal content.`,
  ].join('\n');

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Subscribe to session events
      socket.setTimeout(() => {
        socket.send(frame('sessions.messages.subscribe', { sessionKey }));
      }, 500);

      // Inject prompt via sessions.send
      socket.setTimeout(() => {
        socket.send(frame('sessions.send', {
          sessionKey,
          message: bracketPrompt,
        }));
        evidence.prompt_sent = true;
        console.log('✓ Bracket-prompt injected via sessions.send');
      }, 1500);

      // Poll task ledger for child
      socket.setTimeout(() => {
        socket.send(frame('tasks.list', { limit: 10 }));
      }, 10000);

      // Second poll
      socket.setTimeout(() => {
        socket.send(frame('tasks.list', { limit: 10 }));
      }, 30000);

      // Close after wait
      socket.setTimeout(() => socket.close(), 90000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        evidence.events.push({ ts: Date.now(), msg });

        // Look for bracket parse signal in events
        if (raw.includes('bracket') || raw.includes('CONTINUE_DELEGATE')) {
          evidence.bracket_observed = true;
          console.log('✓ Bracket delegate token observed in event stream');
        }

        // Look for child task/session creation
        if (msg.result && msg.result.tasks && Array.isArray(msg.result.tasks)) {
          for (const task of msg.result.tasks) {
            if (task.task && task.task.includes && task.task.includes(rowNonce)) {
              evidence.child_spawned = true;
              console.log('✓ Child task with nonce found in ledger');
            }
          }
        }

        // Session events showing delegate completion/return
        if (msg.type === 'event') {
          const eventStr = JSON.stringify(msg);
          if (eventStr.includes('delegate') || eventStr.includes('completion')) {
            if (eventStr.includes(rowNonce) || eventStr.includes('DONE')) {
              evidence.parent_return = true;
              console.log('✓ Delegate return observed');
            }
          }
        }

        // Early close
        if (evidence.bracket_observed && evidence.child_spawned && evidence.parent_return) {
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

  // Verdict
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'prompt injected': () => evidence.prompt_sent,
    'bracket token observed': () => evidence.bracket_observed,
    'child delegate spawned': () => evidence.child_spawned,
  });

  if (!evidence.prompt_sent) {
    failures.add(1);
    console.error('FAIL: Could not inject bracket prompt');
  }

  // Note: bracket_observed may be HONEST-LIMIT if the session routes
  // final-text through message-tool-body (kills the bracket scanner).
  // This is expected per TOOLS.md and prior R-CD-TOKEN evidence.
  if (!evidence.bracket_observed && evidence.prompt_sent) {
    console.warn('NOTE: bracket not observed — may be honest-limit (message-body delivery kills scanner)');
  }

  console.log(`\n--- R-CD-TOKEN EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
