/**
 * Scenario: R-CD-CHAINED-DEPTH-2 — depth-2 delegate chain.
 *
 * Fires parent→child→grandchild chain. The nested (child→grandchild) call
 * must request fanoutMode="tree" so grandchild completion routes to root.
 * Outer parent→child stays unchanged (no fanoutMode).
 *
 * Root routing authority is the shared post-run
 * `[continuation:targeted-return]` collector (grandchild→root), not transcript
 * GRANDCHILD-DONE system text. This VU gathers hop identities + sentinels.
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
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  rCdChainHopIdentities,
  rCdChainPromptTemplate,
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
  resolveUniqueSpawnedByChild,
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
const configuredAncestryStabilityMs = Number(__ENV.OPENCLAW_CHAIN_ANCESTRY_STABILITY_MS);
const ANCESTRY_STABILITY_MS = Number.isFinite(configuredAncestryStabilityMs)
  ? Math.max(30000, configuredAncestryStabilityMs)
  : 30000;

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
  if (!createDisposableSession) {
    console.error('OPENCLAW_CREATE_DISPOSABLE_SESSION=true is required for R-CD-CHAINED-DEPTH-2');
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
    child_authority_source: null,
    grandchild_authority_source: null,
    ancestry_ambiguous: false,
    ancestry_stable: false,
    child_ancestry_confirmations: 0,
    grandchild_ancestry_confirmations: 0,
    child_ancestry_confirmed_at_ms: null,
    grandchild_ancestry_confirmed_at_ms: null,
    child_done_sentinel: false,
    grandchild_done_sentinel: false,
    chain_return_received: false,
    root_return_candidate: null,
    root_return_receipt: null,
    root_diagnostic_marker: null,
    return_authority: 'gateway-journal-targeted-return-post-run',
    nested_fanout_mode: 'tree',
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
    const ancestryRequests = {};

    function finalizeRootReturnReceipt() {
      // Transcript markers are never root routing authority.
      evidence.root_return_receipt = rCdChainRootReturnReceipt(
        evidence.root_return_candidate,
        {
          childSessionKey: evidence.child_session,
          grandchildSessionKey: evidence.grandchild_session,
        },
      );
      evidence.chain_return_received = false;
    }

    function observeAncestrySession(depth, observedSessionKey) {
      if (!observedSessionKey || observedSessionKey === sessionKey) return;
      const observedAtMs = Date.now();
      if (depth === 1 && !evidence.child_session) {
        evidence.child_session = observedSessionKey;
        evidence.child_spawned = true;
        evidence.child_authority_source = 'sessions.list spawnedBy ancestry';
        evidence.child_ancestry_confirmations = 1;
        evidence.child_ancestry_confirmed_at_ms = observedAtMs;
        if (evidence.max_depth_observed < 1) evidence.max_depth_observed = 1;
      } else if (depth === 1 && evidence.child_session !== observedSessionKey) {
        evidence.ancestry_ambiguous = true;
      } else if (depth === 1) {
        evidence.child_ancestry_confirmations += 1;
        evidence.child_ancestry_confirmed_at_ms = observedAtMs;
      } else if (depth === 2 && observedSessionKey !== evidence.child_session &&
                 !evidence.grandchild_session) {
        evidence.grandchild_session = observedSessionKey;
        evidence.grandchild_spawned = true;
        evidence.grandchild_authority_source = 'sessions.list spawnedBy ancestry';
        evidence.grandchild_ancestry_confirmations = 1;
        evidence.grandchild_ancestry_confirmed_at_ms = observedAtMs;
        if (evidence.max_depth_observed < 2) evidence.max_depth_observed = 2;
      } else if (depth === 2 && evidence.grandchild_session !== observedSessionKey) {
        evidence.ancestry_ambiguous = true;
      } else if (depth === 2) {
        evidence.grandchild_ancestry_confirmations += 1;
        evidence.grandchild_ancestry_confirmed_at_ms = observedAtMs;
      }
      evidence.ancestry_stable = (
        evidence.ancestry_ambiguous !== true
        && evidence.dispatch_accepted_at_ms !== null
        && evidence.child_ancestry_confirmations >= 2
        && evidence.grandchild_ancestry_confirmations >= 2
        && evidence.grandchild_ancestry_confirmed_at_ms !== null
        && evidence.grandchild_ancestry_confirmed_at_ms - evidence.dispatch_accepted_at_ms
          >= ANCESTRY_STABILITY_MS
      );
      finalizeRootReturnReceipt();
    }

    function requestAncestryList(depth, parentSessionKey) {
      if (!parentSessionKey) return;
      const requestId = tracker.send(socket, 'sessions.list', {
        spawnedBy: parentSessionKey,
        limit: 100,
      });
      ancestryRequests[requestId] = { depth, parentSessionKey };
    }

    function startProofFlow(socket) {
      // Subscribe to parent session events — primary proof surface for chain progression.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch the chain via sessions.send — triggers an agent turn that calls
      // continue_delegate. tools.invoke at the RPC layer does not execute agent-side
      // tools; sessions.send is the correct E2E path.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        // Prefer manifest template; fall back to the fanoutMode=tree canonical form.
        const template = inv.promptTemplate || rCdChainPromptTemplate();
        if (!template.includes("fanoutMode='tree'") && !template.includes('fanoutMode="tree"')) {
          console.error('✗ nested chain prompt must request fanoutMode="tree"');
          failures.add(1);
          socket.close();
          return;
        }
        const task = template.replace(/\{\{nonce\}\}/g, chainNonce);
        evidence.reason_hash = crypto.sha256(task, 'hex').slice(0, 16);
        evidence.reason_length = task.length;
        evidence.delegate_mode = inv.mode;
        // Outer parent→child call is unchanged: no fanoutMode on the root dispatch.
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
      for (const delayMs of [4000, 12000, 30000, 60000, 90000, 120000]) {
        socket.setTimeout(() => requestAncestryList(1, sessionKey), delayMs);
      }

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
      }
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const ancestryRequest = msg?.id ? ancestryRequests[msg.id] || null : null;
        if (msg?.id) delete ancestryRequests[msg.id];
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

        if (classified.kind === 'response' && classified.method === 'sessions.list' &&
            ancestryRequest) {
          if (classified.ok) {
            const resolved = resolveUniqueSpawnedByChild({
              sessionsPayload: classified.payload || {},
              parentSessionKey: ancestryRequest.parentSessionKey,
            });
            if (resolved.uniqueChildKey) {
              observeAncestrySession(ancestryRequest.depth, resolved.uniqueChildKey);
              if (ancestryRequest.depth === 1 && evidence.child_session) {
                requestAncestryList(2, evidence.child_session);
              }
            } else if (resolved.ambiguous) {
              evidence.ancestry_ambiguous = true;
            }
          }
        }

        // Optional TaskFlow ledger context. Absence here is not a failure:
        // continue_delegate uses pending-delegate/subagent surfaces. Titles are
        // capped and cannot establish nonce-bound hop identities.
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (!taskStr.includes(chainNonce)) continue;
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
                const rootDiagnostic = rCdChainRootReturnCandidate({
                  eventName,
                  eventData,
                  rootSessionKey: sessionKey,
                  nonce: chainNonce,
                });
                if (rootDiagnostic) {
                  evidence.root_diagnostic_marker = rootDiagnostic;
                  evidence.root_return_candidate = null;
                  finalizeRootReturnReceipt();
                  console.log('ℹ diagnostic root GRANDCHILD-DONE marker observed; not routing authority');
                }
              }
            }
          }
        }

        // Early close only on strict post-dispatch sentinels.
        const hops = rCdChainHopIdentities({
          childSessionKey: evidence.child_session,
          grandchildSessionKey: evidence.grandchild_session,
        });
        if (evidence.parent_dispatch_accepted &&
            evidence.child_done_sentinel &&
            evidence.grandchild_done_sentinel &&
            hops.ok &&
            evidence.dispatch_accepted_at_ms &&
            Date.now() - evidence.dispatch_accepted_at_ms >= ANCESTRY_STABILITY_MS &&
            evidence.child_ancestry_confirmations >= 2 &&
            evidence.grandchild_ancestry_confirmations >= 2 &&
            evidence.ancestry_stable === true &&
            !evidence.ancestry_ambiguous) {
          console.log('Structural chain evidence gathered, closing early (routing authority is post-run)');
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
  const hops = rCdChainHopIdentities({
    childSessionKey: evidence.child_session,
    grandchildSessionKey: evidence.grandchild_session,
  });
  check(null, {
    'parent dispatch accepted': () => evidence.parent_dispatch_accepted,
    'child sentinel observed post-dispatch': () => evidence.child_done_sentinel,
    'grandchild sentinel observed post-dispatch': () => evidence.grandchild_done_sentinel,
    'nonce-bound child identity observed': () => evidence.child_session !== null,
    'nonce-bound grandchild identity observed': () => evidence.grandchild_session !== null,
    'two distinct hop identities': () => hops.ok,
    'vu does not claim root routing authority': () => evidence.root_return_receipt === null,
    'max depth >= 2': () => evidence.max_depth_observed >= 2,
  });

  const structuralOk = (!createDisposableSession || evidence.session_created) &&
    evidence.parent_dispatch_accepted &&
    evidence.child_done_sentinel &&
    evidence.grandchild_done_sentinel &&
    hops.ok &&
    evidence.child_ancestry_confirmations >= 2 &&
    evidence.grandchild_ancestry_confirmations >= 2 &&
    evidence.ancestry_stable === true &&
    !evidence.ancestry_ambiguous;
  if (!structuralOk) {
    failures.add(1);
  }

  console.log(`\n--- R-CD-CHAINED-DEPTH-2 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-CHAINED-DEPTH-2] VERDICT: PARTIAL-candidate`);
  console.log(`  Max depth observed: ${evidence.max_depth_observed}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = {
    row: 'R-CD-CHAINED-DEPTH-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: 'PARTIAL-candidate',
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
