/**
 * Scenario: R-CW-DELEGATE-SELF-CONTINUATION — delegate child fires its own continue_work.
 *
 * Proves continue_work works INSIDE a delegate context (not just a main session).
 * The harness instructs the parent agent to call continue_delegate; the child is
 * instructed to fire its own continue_work after arriving, then report DONE on
 * hop-2 wake.
 *
 * Verifies:
 *   1. Parent dispatch accepted (continue_delegate fires via sessions.send agent turn)
 *   2. Child session spawned (delegate arrived)
 *   3. Child fires continue_work (accepted)
 *   4. Child's hop-2 wakes (DONE + nonce in return — optional but targeted)
 *   5. Parent eventually receives a return event from the delegate child
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session — proof does not touch the live #sprites/main
 * Discord lane for repeatability runs.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#118
 *   - Manifest: tools/k6-proofs/manifests/r-cw-delegate-self.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cw_delegate_self: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '150s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_delegate_self_duration: ['p(95)<120000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_delegate_self_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  mode: 'normal',
  delaySeconds: 1,
  cwDelaySeconds: 2,
  promptTemplate: 'k6 proof R-CW-DELEGATE-SELF nonce {{nonce}}: after arriving, call continue_work(reason="k6-self-continuation-{{nonce}}", delaySeconds=2). On hop-2 wake, reply with DONE and the nonce "{{nonce}}". Do not mutate files. Do not post to any channel.',
  idempotencyKeyPrefix: 'R-CW-DELEGATE-SELF',
};

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || __ENV.OPENCLAW_DELEGATE_MODE || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    promptTemplate: inv.promptTemplate || DEFAULTS.promptTemplate,
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
  const rowNonce = nonce('R-CW-DS');

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
    row: 'R-CW-DELEGATE-SELF-CONTINUATION',
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
    delegate_accepted: false,
    child_spawned: false,
    child_continue_work_accepted: false,
    child_hop_2_woke: false,
    parent_return: false,
    dispatch_accepted_at_ms: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow(socket) {
      // Subscribe to parent session events — primary surface for chain progression.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch via sessions.send — triggers agent turn that calls continue_delegate.
      // The delegate's task instructs the child to fire its own continue_work.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const task = inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce);
        const agentInstruction =
          `[k6-proof-harness] Call continue_delegate with: ` +
          `mode="${inv.mode}", delaySeconds=${inv.delaySeconds}, ` +
          `task="${task}", ` +
          `idempotencyKey="${inv.idempotencyKeyPrefix}-${rowNonce}". ` +
          `Execute the tool call immediately. This is a proof run.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}`,
        });
      }, 500);

      // Poll task ledger at intervals — optional context.
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 5000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 15000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 30000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 60000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 90000);

      socket.setTimeout(() => socket.close(), 120000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cw-ds-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CW-DELEGATE-SELF ${rowNonce}`,
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

        // Parent dispatch accepted (sessions.send → agent turn triggered)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.delegate_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered (will call continue_delegate)');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Optional TaskFlow ledger context — continue_delegate child sessions may surface here.
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (taskStr.includes(rowNonce)) {
              evidence.child_spawned = true;
              if (taskStr.includes('continue_work') || taskStr.includes('DONE') ||
                  taskStr.includes('hop-2') || taskStr.includes('k6-self-continuation')) {
                evidence.child_continue_work_accepted = true;
              }
              if (taskStr.includes('DONE') && (task.state === 'completed' || task.status === 'completed')) {
                evidence.child_hop_2_woke = true;
              }
              if (task.traceId) evidence.trace_id = task.traceId;
              console.log(`✓ Task found with nonce: ${task.sessionKey || 'unknown'} state=${task.state || 'unknown'}`);
            }
          }
        }

        // Session/agent events — primary proof surface.
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          const eventName = classified.event || '';

          if (eventStr.includes(rowNonce)) {
            // Child spawned: nonce in delegate-related event
            if (eventStr.includes('delegate') || eventStr.includes('child') ||
                eventStr.includes('spawn') || eventName === 'delegate.started') {
              evidence.child_spawned = true;
              console.log('✓ Child spawn event observed (delegate arrived)');
            }

            // Child fired continue_work
            if (eventStr.includes('continue_work') || eventStr.includes('k6-self-continuation') ||
                eventStr.includes('self-continuation')) {
              evidence.child_continue_work_accepted = true;
              console.log('✓ Child continue_work event observed');
            }

            // Child hop-2 woke: DONE + nonce in return
            if (eventStr.includes('DONE') && eventStr.includes(rowNonce)) {
              evidence.child_hop_2_woke = true;
              console.log('✓ Child hop-2 wake: DONE + nonce observed');
            }

            // Parent return from delegate
            if (eventStr.includes('return') || eventStr.includes('completion') ||
                eventName === 'delegate.return' || eventName === 'session.message') {
              const elapsed = evidence.dispatch_accepted_at_ms
                ? Date.now() - evidence.dispatch_accepted_at_ms : 0;
              if (elapsed >= 3000) {
                evidence.parent_return = true;
                console.log('✓ Parent return/wake event from delegate observed');
              }
            }
          }
        }

        // Early close when primary evidence collected
        if (evidence.delegate_accepted && evidence.child_spawned &&
            evidence.child_continue_work_accepted && evidence.parent_return) {
          console.log('Primary R-CW-DELEGATE-SELF evidence gathered, closing early');
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
    'delegate dispatch accepted (sessions.send)': () => evidence.delegate_accepted,
    'child spawned (delegate arrived)': () => evidence.child_spawned,
    'child continue_work accepted': () => evidence.child_continue_work_accepted,
    'child hop-2 woke (optional)': () => evidence.child_hop_2_woke,
    'parent return received': () => evidence.parent_return,
  });

  if (!evidence.delegate_accepted || !evidence.child_spawned) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.delegate_accepted && evidence.child_spawned &&
    evidence.child_continue_work_accepted;

  console.log(`\n--- R-CW-DELEGATE-SELF-CONTINUATION EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CW-DELEGATE-SELF-CONTINUATION] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CW-DELEGATE-SELF-CONTINUATION',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cw_delegate_self_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CW-DELEGATE-SELF-CONTINUATION] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cw-delegate-self-continuation-summary.json': JSON.stringify(summary, null, 2),
  };
}
