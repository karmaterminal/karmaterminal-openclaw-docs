/**
 * Scenario: R-CD-4 — continue_delegate with targetSessionKey (cross-session return).
 *
 * Repeatable mode creates disposable dispatch/target sessions so the proof does
 * not depend on the live #sprites/main lane. The dispatch session asks the
 * agent to call continue_delegate(..., targetSessionKey=<target>).
 *
 * Silent-wake delivery authority is NOT transcript session.message /
 * sessions.get nonce text. The shared post-run collector binds the payload-free
 * gateway `[continuation:targeted-return] Delivered to <target> from <child>`
 * receipt. This VU gathers structural gates (dispatch, child identity) and
 * leaves return authority to that collector.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { childSessionKeysForRow } from '../lib/row-child-correlation.mjs';
import {
  R_CD_4_DURATION_THRESHOLD_MS,
  R_CD_4_OBSERVATION_WINDOW_MS,
  rCd4ChildAuthority,
  rCd4HistoryObservation,
  rCd4ReturnReceipt,
  rCd4SessionMessageObservation,
  rCd4ShouldScheduleEarlyClose,
  rCd4TaskIdentityToken,
  rCd4TaskObservation,
  rCd4TaskPrompt,
} from '../lib/r-cd-4-authority.mjs';
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
    r_cd_4_duration: [`p(95)<${R_CD_4_DURATION_THRESHOLD_MS}`],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_4_duration');

function fingerprintIdentity(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return crypto.sha256(value, 'hex').slice(0, 16);
}

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'silent-wake',
  delaySeconds: 1,
  promptTemplate: 'RCD4:{{nonceSuffix16}} Proof nonce {{nonce}}: reply with TARGET-RECEIVED and the nonce. Do not mutate files. Do not post to any channel.',
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
  const taskIdentityToken = rCd4TaskIdentityToken(rowNonce);
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
    task_identity_token: taskIdentityToken,
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
    child_session_candidates: [],
    child_session_ambiguous: false,
    child_session_invalid: false,
    return_in_target: false,
    return_in_parent: false,
    target_return_candidate: null,
    parent_return_candidate: null,
    target_diagnostic_marker: null,
    parent_diagnostic_marker: null,
    target_return_receipt: null,
    parent_return_receipt: null,
    return_authority: 'gateway-journal-targeted-return-post-run',
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
    let returnHistoryPollScheduled = false;
    let returnHistoryPollInFlight = false;
    let returnHistoryPhase = null;

    function finalizeReturnReceipts() {
      // Transcript markers are diagnostic only. Silent-wake delivery authority
      // is the shared post-run targeted-return journal collector.
      evidence.target_return_receipt = rCd4ReturnReceipt(
        evidence.target_return_candidate,
        evidence.child_session,
      );
      evidence.parent_return_receipt = rCd4ReturnReceipt(
        evidence.parent_return_candidate,
        evidence.child_session,
      );
      evidence.return_in_target = false;
      evidence.return_in_parent = false;
    }

    function observeChildSessionKey(possibleChild) {
      if (!possibleChild) return false;
      const authority = rCd4ChildAuthority([
        ...evidence.child_session_candidates,
        possibleChild,
      ]);
      evidence.child_session_candidates = authority.observedChildSessionKeys;
      evidence.child_session_invalid = evidence.child_session_candidates
        .some((value) => value === sessionKey || value === targetSessionKey);
      evidence.child_session = evidence.child_session_invalid
        ? null
        : authority.childSessionKey;
      evidence.child_session_ambiguous = authority.ambiguous;
      if (authority.ambiguous || evidence.child_session_invalid) {
        evidence.child_completed = false;
        console.warn('✗ conflicting or invalid nonce-bound child identity observed');
      }
      finalizeReturnReceipts();
      return !authority.ambiguous &&
        !evidence.child_session_invalid &&
        authority.childSessionKey === possibleChild;
    }

    function applyReturnObservation(observation, source) {
      if (observation.targetDiagnosticMarker) {
        evidence.target_diagnostic_marker = observation.targetDiagnosticMarker;
        evidence.agent_turn_observed = true;
        console.log(`ℹ diagnostic TARGET-RECEIVED marker in target session (${source}); not delivery authority`);
      }
      if (observation.parentDiagnosticMarker) {
        evidence.parent_diagnostic_marker = observation.parentDiagnosticMarker;
        console.log(`ℹ diagnostic TARGET-RECEIVED marker in parent session (${source}); not delivery authority`);
      }
      // Intentionally do not promote transcript markers to return receipts.
      finalizeReturnReceipts();
    }

    function requestReturnHistories(delayMs) {
      if (!evidence.tool_accepted || returnHistoryPollScheduled || returnHistoryPollInFlight) return;
      returnHistoryPollScheduled = true;
      socket.setTimeout(() => {
        returnHistoryPollScheduled = false;
        returnHistoryPollInFlight = true;
        returnHistoryPhase = 'target';
        tracker.send(socket, 'sessions.get', { key: targetSessionKey, limit: 200 });
      }, delayMs);
    }

    function finishReturnHistoryPoll() {
      returnHistoryPollInFlight = false;
      returnHistoryPhase = null;
      if (!evidence.target_return_receipt && !evidence.parent_return_receipt) {
        requestReturnHistories(2000);
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
        const prompt = rCd4TaskPrompt(inv.promptTemplate, rowNonce);
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
      socket.setTimeout(() => socket.close(), R_CD_4_OBSERVATION_WINDOW_MS);
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
            requestReturnHistories(1000);
          } else if (classified.error) {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const observation = rCd4TaskObservation(task, rowNonce);
            const possibleChild = observation.childSessionKey;
            if (!observeChildSessionKey(possibleChild)) {
              continue;
            }
            if (observation.completed) {
              evidence.child_completed = true;
              console.log('✓ Child task completed');
              requestReturnHistories(0);
            }
            if (observation.traceId) evidence.trace_id = observation.traceId;
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.get') {
          const polledSessionKey = returnHistoryPhase === 'parent' ? sessionKey : targetSessionKey;
          if (classified.ok) {
            const messages = Array.isArray(classified.payload?.messages)
              ? classified.payload.messages
              : [];
            applyReturnObservation(rCd4HistoryObservation({
              messages,
              sessionKey: polledSessionKey,
              targetSessionKey,
              parentSessionKey: sessionKey,
              nonce: rowNonce,
              elapsedMs: evidence.dispatch_accepted_at_ms
                ? Date.now() - evidence.dispatch_accepted_at_ms
                : 0,
              wakeGateMs: evidence.wake_gate_ms,
              fingerprintIdentity,
            }), 'sessions.get');
          }
          if (returnHistoryPhase === 'target') {
            returnHistoryPhase = 'parent';
            tracker.send(socket, 'sessions.get', { key: sessionKey, limit: 200 });
          } else {
            finishReturnHistoryPoll();
          }
        }

        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const observedChildren = childSessionKeysForRow(
            eventData,
            rowNonce,
            taskIdentityToken ? [taskIdentityToken] : [],
          );
          for (const observedChild of observedChildren) {
            observeChildSessionKey(observedChild);
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
              fingerprintIdentity,
            });
            applyReturnObservation(observation, 'session.message');

            if (!observation.targetCandidate && !observation.parentCandidate) {
              evidence.agent_turn_observed = true;
              console.log(observation.genericWakeObserved
                ? '✓ generic post-gate session.message event observed'
                : '✓ initial pre-gate session.message event observed (dispatching agent turn)');
            }
          }
        }

        if (evidence.tool_accepted &&
            rCd4ShouldScheduleEarlyClose({
              parentReturnReceipt: evidence.parent_return_receipt,
            }) &&
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
    'nonce-bound child identity is unambiguous': () => !evidence.child_session_ambiguous,
    'nonce-bound child identity is not parent or target': () => !evidence.child_session_invalid,
    // Return authority is post-run journal collector — VU must not claim PASS.
    'vu does not claim targeted-return authority': () => evidence.target_return_receipt === null,
  });

  const structuralOk = evidence.tool_accepted && evidence.agent_turn_observed &&
    evidence.child_session !== null && !evidence.child_session_ambiguous &&
    !evidence.child_session_invalid;
  // VU never emits PASS-candidate; shared post-run collector owns delivery authority.
  if (!structuralOk) {
    failures.add(1);
  }

  console.log(`R_CD_4_EVIDENCE ${JSON.stringify(evidence)}`);
  console.log(`\n--- R-CD-4 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-4] VERDICT: PARTIAL-candidate`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = {
    row: 'R-CD-4',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    // VU structural gates only; targeted-return authority is post-run.
    verdict: 'PARTIAL-candidate',
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
