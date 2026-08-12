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
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent, assertConnected } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { childSessionKeyForRow } from '../lib/row-child-correlation.mjs';
import {
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

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
const HARNESS_MARKER = '[k6-proof-harness]';
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_CHAIN_EVIDENCE_DELAY_MS || 1500);

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
    child_done_sentinel: false,
    grandchild_done_sentinel: false,
    chain_return_received: false,
    root_return_candidate: null,
    root_return_receipt: null,
    dispatch_accepted_at_ms: null,
    // Depth tracking
    max_depth_observed: 0,
    child_session: null,
    grandchild_session: null,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function finalizeRootReturnReceipt() {
      evidence.root_return_receipt = rCdChainRootReturnReceipt(
        evidence.root_return_candidate,
        {
          childSessionKey: evidence.child_session,
          grandchildSessionKey: evidence.grandchild_session,
        },
      );
      evidence.chain_return_received = evidence.root_return_receipt !== null;
    }

    function observeChainSession(observedSessionKey) {
      if (!observedSessionKey || observedSessionKey === sessionKey) return;
      if (!evidence.child_session) {
        evidence.child_session = observedSessionKey;
        evidence.child_spawned = true;
        if (evidence.max_depth_observed < 1) evidence.max_depth_observed = 1;
      } else if (observedSessionKey !== evidence.child_session && !evidence.grandchild_session) {
        evidence.grandchild_session = observedSessionKey;
        evidence.grandchild_spawned = true;
        if (evidence.max_depth_observed < 2) evidence.max_depth_observed = 2;
      }
      finalizeRootReturnReceipt();
    }

    function startProofFlow(socket) {
      // Subscribe to parent session events — primary proof surface for chain progression.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch the chain via sessions.send — triggers an agent turn that calls
      // continue_delegate. tools.invoke at the RPC layer does not execute agent-side
      // tools; sessions.send is the correct E2E path.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const task = inv.promptTemplate.replace(/\{\{nonce\}\}/g, chainNonce);
        evidence.reason_hash = crypto.sha256(task, 'hex').slice(0, 16);
        evidence.reason_length = task.length;
        evidence.delegate_mode = inv.mode;
        const agentInstruction =
          `[k6-proof-harness] Chain proof nonce ${chainNonce}. ` +
          `Call continue_delegate with: mode="${inv.mode}", delaySeconds=${inv.delaySeconds}, ` +
          `task=${JSON.stringify(task)}, ` +
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
            evidence.dispatch_accepted_at_ms = Date.now();
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
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (!taskStr.includes(chainNonce)) continue;
            observeChainSession(task.sessionKey);
            observeChainSession(task.childSessionKey);
            if (task.traceId) evidence.trace_id = task.traceId;
          }
        }

        // Chain progression on subscribed session events. These are the primary
        // public proof surface for continue_delegate chains; task registry rows
        // are only optional context.
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          observeChainSession(childSessionKeyForRow(eventData, chainNonce));
          if (eventStr.includes(chainNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) {
              console.log('ℹ Ignoring harness prompt echo event');
            } else if (evidence.parent_dispatch_accepted && evidence.dispatch_accepted_at_ms) {
              const elapsed = Date.now() - evidence.dispatch_accepted_at_ms;
              if (elapsed >= POST_DISPATCH_EVIDENCE_GATE_MS) {
                if (eventStr.includes(`CHILD-DONE ${chainNonce} CHILD-DELEGATE-SCHEDULED`)) {
                  evidence.child_done_sentinel = true;
                  console.log('✓ CHILD-DONE/CHILD-DELEGATE-SCHEDULED sentinel observed post-dispatch');
                }
                if (eventStr.includes(`GRANDCHILD-DONE ${chainNonce}`)) {
                  evidence.grandchild_done_sentinel = true;
                  console.log('✓ GRANDCHILD-DONE sentinel observed post-dispatch');
                }
                const rootReturnCandidate = rCdChainRootReturnCandidate({
                  eventName,
                  eventData,
                  rootSessionKey: sessionKey,
                  nonce: chainNonce,
                });
                if (rootReturnCandidate) {
                  evidence.root_return_candidate = rootReturnCandidate;
                  finalizeRootReturnReceipt();
                  console.log('✓ explicit nonce-bound root system return candidate observed');
                }
              }
            }
          }
        }

        // Early close only on strict post-dispatch sentinels.
        if (evidence.parent_dispatch_accepted &&
            evidence.child_done_sentinel &&
            evidence.grandchild_done_sentinel &&
            evidence.child_session &&
            evidence.grandchild_session &&
            evidence.root_return_receipt) {
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
    'child sentinel observed post-dispatch': () => evidence.child_done_sentinel,
    'grandchild sentinel observed post-dispatch': () => evidence.grandchild_done_sentinel,
    'nonce-bound child identity observed': () => evidence.child_session !== null,
    'nonce-bound grandchild identity observed': () => evidence.grandchild_session !== null,
    'explicit root return receipt observed': () => evidence.root_return_receipt !== null,
    'max depth >= 2': () => evidence.max_depth_observed >= 2,
  });

  if (!evidence.parent_dispatch_accepted || !evidence.child_done_sentinel ||
      !evidence.grandchild_done_sentinel || !evidence.child_session ||
      !evidence.grandchild_session || !evidence.root_return_receipt) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.parent_dispatch_accepted &&
    evidence.child_done_sentinel &&
    evidence.grandchild_done_sentinel &&
    evidence.child_session !== null &&
    evidence.grandchild_session !== null &&
    evidence.root_return_receipt !== null;

  console.log(`\n--- R-CD-CHAINED-DEPTH-2 EVIDENCE SUMMARY ---`);
  // Rig-fault guard (see assertConnected): a refused WS upgrade yields an
  // artefact identical to a genuine failure — 0 ms, every flag false. Record
  // it explicitly so this row is never published as evidence about the feature.
  const connectFault = assertConnected(res);
  if (connectFault) evidence.connect_failed = connectFault;

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
