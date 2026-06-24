/**
 * Scenario: R-CD-2 — continue_delegate(mode="silent-wake") full path.
 *
 * Verifies:
 *   1. Gateway accepts continue_delegate with mode=silent-wake
 *   2. Child task spawns and completes
 *   3. Parent session wakes (receives internal context)
 *   4. NO channel message is delivered (silent mode)
 *
 * The key differentiator from R-CD-1: the delegate return must NOT produce
 * a channel message. The parent wakes (gets a new turn) but the return is
 * internal-only context enrichment.
 *
 * Manifest-driven: reads row config from OPENCLAW_ROW_MANIFEST env var.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#119
 *   - Manifest: tools/k6-proofs/manifests/r-cd-2.json
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cd_2_silent_wake: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_2_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_2_duration');

// --- Manifest-driven config ---
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'silent-wake',
  delaySeconds: 1,
  promptTemplate: 'Proof nonce {{nonce}}: reply with DONE and the nonce only. Do not mutate files. Do not post to any channel.',
  idempotencyKeyPrefix: 'R-CD-2',
};

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
  const sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-2');

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
    row: 'R-CD-2',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    sessionKey,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Required receipts
    tool_accepted: false,
    task_created: false,
    task_mode: null,
    // Silent-wake specific
    parent_wake_observed: false,
    channel_message_observed: false, // MUST stay false for PASS
    child_session: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));

      // Subscribe to parent session messages to detect wake + verify no channel delivery
      // Protocol: sessions.messages.subscribe uses 'key' not 'sessionKey'
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      }, 500);

      // Fire continue_delegate via sessions.send — instructs the agent to call the tool
      // NOTE: tools.invoke at the RPC layer accepts the call but continuation tools
      // are agent-side (execute inside an agent turn). sessions.send triggers an actual
      // agent turn that can call the tool, which is the E2E proof path.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const prompt = inv.promptTemplate.replace('{{nonce}}', rowNonce);
        const agentInstruction = `[k6-proof-harness] Call continue_delegate with: task="${prompt}", mode="${inv.mode}", delaySeconds=${inv.delaySeconds}. This is a proof run — execute the tool call immediately, no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 1000);

      // Poll task ledger — check mode field
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 5000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 15000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 30000);

      // Extended wait for silent-wake (child must complete + parent must wake)
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

        // Check sessions.send accepted (agent turn triggered)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-CD-2 (mode=silent-wake)');
          } else if (classified.error) {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Check task ledger — look for mode=silent-wake in task metadata
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (taskStr.includes(rowNonce)) {
              evidence.task_created = true;
              evidence.child_session = task.sessionKey || task.childSessionKey || null;
              evidence.task_mode = task.mode || task.returnMode || null;
              if (task.traceId) evidence.trace_id = task.traceId;
              console.log(`✓ Task found with nonce — mode: ${evidence.task_mode}`);
            }
          }
        }

        // Detect parent wake (session message event that is NOT a channel delivery)
        if (classified.kind === 'event') {
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);

          // Parent wake: delegate return/completion that triggers a new turn
          if (eventStr.includes('delegate') || eventStr.includes('completion') ||
              eventStr.includes('silent-wake') || eventStr.includes('continuation')) {
            evidence.parent_wake_observed = true;
            console.log('✓ Parent wake event observed (silent-wake return)');
          }

          // Negative check: if we see a channel delivery, that breaks the silent contract
          if (eventStr.includes('channel') && eventStr.includes('deliver') &&
              eventStr.includes(rowNonce)) {
            evidence.channel_message_observed = true;
            console.warn('✗ Channel delivery detected — silent mode violated!');
            failures.add(1);
          }
        }

        // Early close if all evidence gathered
        if (evidence.tool_accepted && evidence.task_created && evidence.parent_wake_observed) {
          console.log('All required evidence gathered, closing early');
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

  // Checks
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool invocation accepted': () => evidence.tool_accepted,
    'delegate task created in ledger': () => evidence.task_created,
    'task mode is silent-wake': () => evidence.task_mode === 'silent-wake',
    'parent wake observed': () => evidence.parent_wake_observed,
    'no channel delivery (silent verified)': () => !evidence.channel_message_observed,
  });

  if (!evidence.tool_accepted || !evidence.parent_wake_observed) {
    failures.add(1);
  }
  if (evidence.channel_message_observed) {
    failures.add(1);
    console.error('FAIL: silent-wake delegate produced channel output');
  }

  // Verdict
  const passed = evidence.tool_accepted && evidence.task_created &&
    evidence.parent_wake_observed && !evidence.channel_message_observed;

  console.log(`\n--- R-CD-2 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-2] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CD-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cd_2_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CD-2] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-2-summary.json': JSON.stringify(summary, null, 2),
  };
}
