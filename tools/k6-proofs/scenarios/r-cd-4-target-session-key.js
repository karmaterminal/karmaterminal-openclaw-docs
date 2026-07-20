/**
 * Scenario: R-CD-4 — continue_delegate with targetSessionKey (cross-session return).
 *
 * Repeatable mode creates disposable dispatch/target sessions so the proof does
 * not depend on the live #sprites/main lane. The dispatch session asks the
 * agent to call continue_delegate(..., targetSessionKey=<target>). The harness
 * subscribes to both sessions and verifies the delayed return/wake lands in the
 * target session and not the dispatching parent.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { childSessionKeyForRow } from '../lib/row-child-correlation.mjs';
import { rCd4ReturnReceipt, rCd4SessionMessageObservation } from '../lib/r-cd-4-authority.mjs';
import { closeSocketAfterDelay } from '../lib/socket-close.js';

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
  promptTemplate: 'Proof nonce {{nonce}}: reply with TARGET-RECEIVED and the nonce. Do not mutate files. Do not post to any channel.',
  idempotencyKeyPrefix: 'R-CD-4',
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
    targetSessionKey: inv.targetSessionKey || __ENV.OPENCLAW_TARGET_SESSION_KEY || null,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSessions = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-4');
  const inv = invocationCfg();
  let targetSessionKey = inv.targetSessionKey;

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (!targetSessionKey && !createDisposableSessions) {
    console.error('OPENCLAW_TARGET_SESSION_KEY is required for R-CD-4 unless OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true');
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
    requestedSessionKey,
    sessionKey,
    targetSessionKey,
    parent_session_created: false,
    target_session_created: false,
    created_parent_session_key: null,
    created_target_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    tool_accepted: false,
    agent_turn_observed: false,
    child_completed: false,
    child_session: null,
    return_in_target: false,
    return_in_parent: false,
    target_return_candidate: null,
    parent_return_candidate: null,
    target_return_receipt: null,
    parent_return_receipt: null,
    dispatch_accepted_at_ms: null,
    wake_gate_ms: Number(__ENV.OPENCLAW_MIN_DELEGATE_DELAY_MS || 5000),
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let createPhase = 'none';
    let returnCloseScheduled = false;

    function finalizeReturnReceipts() {
      evidence.target_return_receipt = rCd4ReturnReceipt(
        evidence.target_return_candidate,
        evidence.child_session,
      );
      evidence.parent_return_receipt = rCd4ReturnReceipt(
        evidence.parent_return_candidate,
        evidence.child_session,
      );
      evidence.return_in_target = evidence.target_return_receipt !== null;
      evidence.return_in_parent = evidence.parent_return_receipt !== null;
      if (evidence.return_in_target) {
        evidence.child_completed = true;
      }
    }

    function createParent(socket) {
      createPhase = 'parent';
      const parentKey = `r-cd-4-parent-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      tracker.send(socket, 'sessions.create', {
        key: parentKey,
        label: `k6 R-CD-4 parent ${rowNonce}`,
      });
    }

    function createTarget(socket) {
      createPhase = 'target';
      const targetKey = `r-cd-4-target-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      tracker.send(socket, 'sessions.create', {
        key: targetKey,
        label: `k6 R-CD-4 target ${rowNonce}`,
      });
    }

    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      tracker.send(socket, 'sessions.messages.subscribe', { key: targetSessionKey });

      socket.setTimeout(() => {
        const prompt = inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce);
        evidence.reason_hash = crypto.sha256(prompt, 'hex').slice(0, 16);
        evidence.reason_length = prompt.length;
        evidence.delegate_mode = inv.mode;
        const agentInstruction = `[k6-proof-harness] Call continue_delegate with: task="${prompt}", mode="${inv.mode}", delaySeconds=${inv.delaySeconds}, targetSessionKey="${targetSessionKey}". This is a proof run — execute the tool call immediately, no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 500);

      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 8000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 25000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 50000);
      socket.setTimeout(() => socket.close(), 90000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSessions) {
        socket.setTimeout(() => createParent(socket), 250);
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

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            const createdKey = classified.payload.key;
            if (createPhase === 'parent') {
              sessionKey = createdKey || sessionKey;
              evidence.sessionKey = sessionKey;
              evidence.parent_session_created = true;
              evidence.created_parent_session_key = sessionKey;
              console.log(`✓ disposable parent session created: ${sessionKey}`);
              createTarget(socket);
            } else if (createPhase === 'target') {
              targetSessionKey = createdKey || targetSessionKey;
              evidence.targetSessionKey = targetSessionKey;
              evidence.target_session_created = true;
              evidence.created_target_session_key = targetSessionKey;
              console.log(`✓ disposable target session created: ${targetSessionKey}`);
              createPhase = 'done';
              startProofFlow(socket);
            }
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok && classified.payload) {
            evidence.tool_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-CD-4 (targetSessionKey)');
          } else if (classified.error) {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (taskStr.includes(rowNonce)) {
              const possibleChild = task.childSessionKey || task.sessionKey || null;
              if (possibleChild && possibleChild !== sessionKey && possibleChild !== targetSessionKey) {
                evidence.child_session = possibleChild;
                finalizeReturnReceipts();
              }
              if (task.state === 'completed' || task.status === 'completed') {
                evidence.child_completed = true;
                console.log('✓ Child task completed');
              }
              if (task.traceId) evidence.trace_id = task.traceId;
            }
          }
        }

        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const observedChild = childSessionKeyForRow(eventData, rowNonce);
          if (observedChild && observedChild !== sessionKey && observedChild !== targetSessionKey) {
            evidence.child_session = observedChild;
            finalizeReturnReceipts();
          }

          if (eventName === 'agent' && evidence.tool_accepted) {
            evidence.agent_turn_observed = true;
          }

          if (eventName === 'session.message' && evidence.tool_accepted) {
            const elapsed = evidence.dispatch_accepted_at_ms ? Date.now() - evidence.dispatch_accepted_at_ms : 0;
            const observation = rCd4SessionMessageObservation({
              eventName,
              eventData,
              targetSessionKey,
              parentSessionKey: sessionKey,
              nonce: rowNonce,
              elapsedMs: elapsed,
              wakeGateMs: evidence.wake_gate_ms,
            });
            if (observation.targetCandidate) {
              evidence.target_return_candidate = observation.targetCandidate;
              evidence.agent_turn_observed = true;
              console.log('✓ nonce-bound TARGET-RECEIVED candidate landed in target session');
            }
            if (observation.parentCandidate) {
              evidence.parent_return_candidate = observation.parentCandidate;
              console.warn('✗ nonce-bound TARGET-RECEIVED candidate landed in parent session');
            }
            finalizeReturnReceipts();

            if (!observation.targetCandidate && !observation.parentCandidate) {
              evidence.agent_turn_observed = true;
              console.log(observation.genericWakeObserved
                ? '✓ generic post-gate session.message event observed'
                : '✓ initial pre-gate session.message event observed (dispatching agent turn)');
            }
          }
        }

        if (evidence.tool_accepted &&
            (evidence.return_in_target || evidence.return_in_parent) &&
            !returnCloseScheduled) {
          returnCloseScheduled = true;
          closeSocketAfterDelay(socket, 2000);
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
    'dispatch accepted': () => evidence.tool_accepted,
    'dispatching agent turn observed': () => evidence.agent_turn_observed,
    'nonce-bound child identity observed': () => evidence.child_session !== null,
    'nonce-bound target return receipt observed': () => evidence.target_return_receipt !== null,
    'no nonce-bound parent return receipt': () => evidence.parent_return_receipt === null,
  });

  if (!evidence.tool_accepted || !evidence.agent_turn_observed || !evidence.child_session ||
      !evidence.target_return_receipt || evidence.parent_return_receipt) {
    failures.add(1);
  }

  const passed = evidence.tool_accepted && evidence.agent_turn_observed &&
    evidence.child_session !== null && evidence.target_return_receipt !== null &&
    evidence.parent_return_receipt === null;

  console.log(`R_CD_4_EVIDENCE ${JSON.stringify(evidence)}`);
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
