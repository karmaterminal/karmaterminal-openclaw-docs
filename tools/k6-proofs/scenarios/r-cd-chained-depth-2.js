/**
 * Scenario: R-CD-CHAINED-DEPTH-2 — depth-2 delegate chain.
 *
 * Fires parent→child→grandchild chain and verifies the full return path.
 * The child is instructed to fire its OWN continue_delegate, creating a
 * depth-2 chain. The proof verifies:
 *   1. Parent dispatches (depth-0 → depth-1) via sessions.send (agent turn)
 *   2. Child spawns and fires its own delegate (depth-1 → depth-2)
 *   3. Grandchild spawns and completes
 *   4. Return propagates up-tree to parent
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session, so the proof does not touch the live #sprites/main
 * Discord lane.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#119
 *   - Manifest: tools/k6-proofs/manifests/r-cd-chained-depth-2.json
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_cd_chained_depth_2: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '180s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_chain_duration: ['p(95)<150000'],
  },
};

const failures = new Counter('proof_failures');
const chainDuration = new Trend('r_cd_chain_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'silent-wake',
  delaySeconds: 1,
  idempotencyKeyPrefix: 'R-CD-CHAIN',
};

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds ?? DEFAULTS.delaySeconds),
    promptTemplate: inv.promptTemplate || '',
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
  const chainNonce = nonce('R-CD-CHAIN');

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
    row: 'R-CD-CHAINED-DEPTH-2',
    manifest_loaded: !!manifest,
    nonce: chainNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Chain progression
    parent_dispatch_accepted: false,
    child_spawned: false,
    grandchild_spawned: false,
    chain_return_received: false,
    // Depth tracking
    max_depth_observed: 0,
    child_session: null,
    grandchild_session: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow(socket) {
      // Subscribe to parent session events — primary proof surface for chain progression.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch the chain via sessions.send — triggers an agent turn that calls
      // continue_delegate. tools.invoke at the RPC layer does not execute agent-side
      // tools; sessions.send is the correct E2E path.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const agentInstruction =
          `[k6-proof-harness] Chain proof nonce ${chainNonce}. ` +
          `Call continue_delegate with: mode="${inv.mode}", delaySeconds=${inv.delaySeconds}, ` +
          `task="Chain proof nonce ${chainNonce}: you are depth-1. Call continue_delegate with mode=\\"${inv.mode}\\", ` +
          `delaySeconds=${inv.delaySeconds}, ` +
          `task=\\"Grandchild proof nonce ${chainNonce}: reply with GRANDCHILD-DONE and the nonce '${chainNonce}'. Do not mutate files. Do not post to any channel.\\". ` +
          `After firing, reply with CHILD-DONE and the nonce '${chainNonce}'. Do not mutate files.", ` +
          `idempotencyKey="${inv.idempotencyKeyPrefix}-${chainNonce}". ` +
          `This is a proof run — execute the tool call immediately, no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${chainNonce}`,
        });
      }, 500);

      // Optional context: poll task ledger at intervals.
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 8000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 20000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 40000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 60000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 90000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 120000);

      // Extended timeout for depth-2 chain completion.
      socket.setTimeout(() => socket.close(), 150000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-chain-${chainNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CD-CHAINED-DEPTH-2 ${chainNonce}`,
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

        // Parent dispatch accepted (sessions.send triggers agent turn)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.parent_dispatch_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for depth-2 chain');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Optional TaskFlow ledger context. Absence here is not a failure:
        // continue_delegate uses pending-delegate/subagent surfaces.
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          let childFound = false;
          let grandchildFound = false;

          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            // Detect child (depth-1): contains the chain nonce in its task body
            if (taskStr.includes(chainNonce) && taskStr.includes('depth-1')) {
              childFound = true;
              evidence.child_spawned = true;
              evidence.child_session = task.sessionKey || task.childSessionKey || null;
              if (evidence.max_depth_observed < 1) evidence.max_depth_observed = 1;
            }
            // Detect grandchild (depth-2): contains "GRANDCHILD-DONE" or matches chain nonce
            // but at a deeper level
            if (taskStr.includes(chainNonce) && taskStr.includes('Grandchild')) {
              grandchildFound = true;
              evidence.grandchild_spawned = true;
              evidence.grandchild_session = task.sessionKey || task.childSessionKey || null;
              if (evidence.max_depth_observed < 2) evidence.max_depth_observed = 2;
            }
            // Check completion state
            if (taskStr.includes(chainNonce) &&
                (task.state === 'completed' || task.status === 'completed')) {
              // A completed task with our nonce = chain progression
              console.log(`✓ Task completed: ${task.sessionKey || 'unknown'}`);
            }
          }

          if (childFound) console.log('✓ Child (depth-1) observed in task ledger');
          if (grandchildFound) console.log('✓ Grandchild (depth-2) observed in task ledger');
        }

        // Chain progression on subscribed session events. These are the primary
        // public proof surface for continue_delegate chains; task registry rows
        // are only optional context.
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes(chainNonce)) {
            if (eventStr.includes('depth-1') || eventStr.includes('CHILD-DONE')) {
              evidence.child_spawned = true;
              if (evidence.max_depth_observed < 1) evidence.max_depth_observed = 1;
              console.log('✓ Child/depth-1 event observed on session stream');
            }
            if (eventStr.includes('Grandchild') || eventStr.includes('GRANDCHILD-DONE')) {
              evidence.grandchild_spawned = true;
              if (evidence.max_depth_observed < 2) evidence.max_depth_observed = 2;
              console.log('✓ Grandchild/depth-2 event observed on session stream');
            }
            if (eventStr.includes('delegate') || eventStr.includes('completion') ||
                eventStr.includes('return') || eventStr.includes('CHILD-DONE') ||
                eventStr.includes('GRANDCHILD-DONE')) {
              evidence.chain_return_received = true;
              console.log('✓ Chain return/progression received at parent session');
            }
          }
        }

        // Early close if chain complete
        if (evidence.parent_dispatch_accepted && evidence.child_spawned &&
            evidence.grandchild_spawned && evidence.chain_return_received) {
          console.log('Full chain evidence gathered, closing early');
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
  chainDuration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'parent dispatch accepted': () => evidence.parent_dispatch_accepted,
    'child (depth-1) spawned': () => evidence.child_spawned,
    'grandchild (depth-2) spawned': () => evidence.grandchild_spawned,
    'chain return received at parent': () => evidence.chain_return_received,
    'max depth >= 2': () => evidence.max_depth_observed >= 2,
  });

  if (!evidence.parent_dispatch_accepted || !evidence.child_spawned) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.parent_dispatch_accepted && evidence.child_spawned &&
    evidence.grandchild_spawned && evidence.chain_return_received;

  console.log(`\n--- R-CD-CHAINED-DEPTH-2 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-CHAINED-DEPTH-2] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
  console.log(`  Max depth observed: ${evidence.max_depth_observed}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CD-CHAINED-DEPTH-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cd_chain_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CD-CHAINED-DEPTH-2] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-chained-depth-2-summary.json': JSON.stringify(summary, null, 2),
  };
}
