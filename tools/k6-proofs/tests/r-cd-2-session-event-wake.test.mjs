// R-CD-2 silent-wake binding on a session-event wake (karmaterminal-openclaw-docs#600).
//
// Live trap (emeric isolated gateway, runtime and candidate
// 293c977f629f872a643fb94892603310b887293b, docs dcc6330c40, matrix 012658Z,
// run 20261029T012745Z-r-cd-2-5e4ce138, not overlapped): the signed receipt
// said `failureCategory: missing-send-run-lifecycle`. Every send, delegate and
// terminal predicate was true; wakeLifecycle, wakeSessionBound, postWakeQuiet,
// wakeRunFingerprint, distinctWakeRun, lifecycleEndBeforeWake and
// wakeBeforeQuietWindow were false. The gateway journal shows the product
// completing the path: delegate-spawned hop=1/200 mode=silent-wake (18:28:03.449
// PDT), child end (18:28:06.945), `[continuation:targeted-return] Delivered`
// to the r-cd-2 session (18:28:07.015), then a parent turn on that session
// (payload-scan, 18:28:15.856).
//
// Product shape at karmaterminal/openclaw 293c977f62 (source walk; no fresh
// GitNexus index exists for that SHA):
// - upstream retired heartbeat turns (#180192, #180563); the fork's
//   requestContinuationWake (src/auto-reply/continuation/continuation-wake.ts,
//   8baac2feb6 / b0de869044, karmaterminal/openclaw#1475) hands a delegate
//   return to enqueueSessionEventForHost: an ordinary session-event turn,
//   InternalTurnSource "event", with no heartbeat_respond contract.
// - that turn's lifecycle start/end reach a sessions.messages subscriber with
//   runId and sessionKey (src/gateway/server-chat.ts mirrors the lifecycle
//   stream to hidden session subscribers, server-chat-event-admission.ts), and
//   its data is { phase, startedAt }: nothing names the delegate.
// - its input rows ("[OpenClaw session event]" and the runtime-context row that
//   carries the return text) are hidden from session.message
//   (src/gateway/chat-display-projection.history.ts). What the turn answers is
//   an assistant row stamped __openclaw.runId. R-CD-4 bound exactly that on the
//   same matrix (target_return_source assistant-text).
// The harness bound the wake only to a heartbeat_respond
// { notify:false, outcome:"done" } record written by the woken run (906813f9,
// modelled on 14d31a81b1, whose targeting.ts still called requestHeartbeatNow).
// This product never writes that record, so the wake could never bind.
//
// Each test fires the real R-CD-2 scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a gateway scripted on the shapes above,
// passes its log through the real extractor, and resolves the private evidence
// with the real row-scoped resolver. Date.now() follows the journal timeline.
// No live gateway, seat or Tempo is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import {
  rCd2AuthorityChecks,
  rCd2AuthorityIdentity,
  resolveRcd2AuthoritativeReceipt,
} from '../lib/r-cd-2-authoritative-receipt.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenarioPath = path.join(root, 'scenarios/r-cd-2-silent-wake.js');
const manifestPath = path.join(root, 'manifests/r-cd-2.json');
const SIGNING_KEY = 'docs-600-r-cd-2-session-event-wake-key';
const WAKE_RUN = '0b9d3e52-7c41-4f0e-9a8d-2e6f1c5b7a30';
// Journal (PDT + 7h): send accepted ~01:27:46.4, delegate spawned 01:28:03.449,
// child ended 01:28:06.945, targeted return 01:28:07.015, wake turn 01:28:15.856.
const ACCEPTED_AT_MS = Date.parse('2026-10-29T01:27:46.400Z');
const WAKE_AT_MS = Date.parse('2026-10-29T01:28:15.856Z');

function digest(file) {
  return readFile(file).then((body) => createHash('sha256').update(body).digest('hex'));
}

const identity = rCd2AuthorityIdentity({
  candidateSha: '293c977f629f872a643fb94892603310b887293b',
  runtimeBuildSha: '293c977f629f872a643fb94892603310b887293b',
  docsRef: 'dcc6330c4000b51187bf9f913137820fe2d5145a',
  repository: 'karmaterminal/karmaterminal-openclaw-docs',
  seat: 'emeric-isolated-composite',
  matrixId: '20261029T012705Z-dcc6330c4000-5e4ce138',
  row: 'R-CD-2',
  scenario: 'r-cd-2-silent-wake.js',
  manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
  manifestSha256: await digest(manifestPath),
  scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
  scenarioSha256: await digest(scenarioPath),
}, '20261029T012745Z-r-cd-2-5e4ce138');

const event = (name, payload) => ({ type: 'event', event: name, payload });

function lifecycle({ runId, sessionKey, phase, data = {} }) {
  return event('agent', { runId, stream: 'lifecycle', ts: Date.now(), sessionKey, agentId: 'main', data: { phase, ...data } });
}

function transcript({ runId, sessionKey, message }) {
  return event('session.message', { sessionKey, agentId: 'main', message: { ...message, __openclaw: { runId } } });
}

function assistantText(text) {
  return { role: 'assistant', content: [{ type: 'text', text }] };
}

/**
 * What the woken run emits, as a list of frames, given the dispatch it answers.
 * Default: the 293c977f session-event turn: lifecycle start, an assistant
 * answer, lifecycle end. The answer is the nonce-bound wake acknowledgement the
 * dispatch asked for, else what the delegate returned.
 */
function sessionEventWake({ sessionKey, nonce, dispatch }) {
  const ack = `RCD2-WAKE-ACK ${nonce}`;
  const answer = dispatch.includes(ack) ? ack : `DONE ${nonce}`;
  return [
    lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'start', data: { startedAt: Date.now() } }),
    transcript({ runId: WAKE_RUN, sessionKey, message: assistantText(answer) }),
    lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'end', data: { aborted: false, stopReason: 'stop', executionSettled: true } }),
  ];
}

/**
 * A gateway scripted on the 293c977f event shapes. The dispatch run schedules
 * the typed delegate, ends on the exact sentinel and refuses replay; the wake
 * frames arrive with the first child-observer poll after the journal's wake
 * time.
 */
function scriptedGateway({ clock, wake = sessionEventWake, wakeAtMs = WAKE_AT_MS }) {
  const state = { sessionKey: null, nonce: null, dispatch: null, sendRunId: null, woke: false };
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => ({ type: 'res', id: frame.id, ok: true, payload });
    switch (frame.method) {
      case 'connect':
        return [ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-2']] } })];
      case 'sessions.create':
        state.sessionKey = `agent:main:${frame.params.key}`;
        return [ok({ key: state.sessionKey })];
      case 'sessions.messages.subscribe':
        return [ok({ subscribed: true, key: frame.params.key })];
      case 'sessions.list': {
        if (!frame.params?.spawnedBy) return [ok({ sessions: [{ key: state.sessionKey, kind: 'direct' }] })];
        const replies = [ok({ sessions: [], hasMore: false })];
        if (state.sendRunId && !state.woke) {
          state.woke = true;
          clock.set(wakeAtMs);
          replies.push(...wake({ ...state, sendRunId: state.sendRunId }));
        }
        return replies;
      }
      case 'chat.history':
        return [ok({ messages: [] })];
      case 'sessions.send': {
        state.dispatch = frame.params.message;
        state.nonce = /RCD2-DELEGATE-SCHEDULED (\S+)\./u.exec(state.dispatch)?.[1];
        const task = /task:"([^"]+)"/u.exec(state.dispatch)?.[1];
        assert.ok(state.nonce && task, 'the dispatch names its sentinel nonce and delegate task');
        state.sendRunId = frame.params.idempotencyKey;
        clock.set(ACCEPTED_AT_MS);
        const run = { runId: state.sendRunId, sessionKey: state.sessionKey };
        return [
          ok({ runId: state.sendRunId, status: 'started' }),
          lifecycle({ ...run, phase: 'start', data: { startedAt: ACCEPTED_AT_MS } }),
          transcript({ ...run, message: { role: 'assistant', content: [{ type: 'toolCall', id: 'call_rcd2', name: 'continue_delegate', arguments: { task, mode: 'silent-wake', delaySeconds: 1 } }] } }),
          transcript({ ...run, message: { role: 'toolResult', toolCallId: 'call_rcd2', toolName: 'continue_delegate', isError: false, content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'silent-wake', delaySeconds: 1 }) }] } }),
          transcript({ ...run, message: assistantText(`RCD2-DELEGATE-SCHEDULED ${state.nonce}`) }),
          lifecycle({ ...run, phase: 'end', data: { aborted: false, stopReason: 'stop', executionSettled: true, replayInvalid: true } }),
        ];
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

/** Fire the real scenario once against the scripted gateway; resolve its evidence. */
async function fireRcd2(options = {}) {
  const realNow = Date.now;
  let now = Date.parse('2026-10-29T01:27:45.000Z');
  const clock = { set: (ms) => { now = Math.max(now, ms); } };
  Date.now = () => now;
  let fired;
  try {
    fired = await runK6Scenario({
      scenarioPath,
      gateway: scriptedGateway({ clock, ...options }),
      env: {
        OPENCLAW_ROW_MANIFEST: manifestPath,
        OPENCLAW_GATEWAY_TOKEN: SIGNING_KEY,
        OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
        OPENCLAW_CANDIDATE_SHA: identity.candidateSha,
        OPENCLAW_SEAT_NAME: identity.seat,
        OPENCLAW_SESSION_KEY: 'main',
      },
    });
  } finally {
    Date.now = realNow;
  }
  const records = extractEvidence(fired.log);
  assert.equal(records.length, 1, `expected one R-CD-2 evidence record:\n${fired.log}`);
  const [evidence] = records;
  const dispatch = fired.frames.find((frame) => frame.method === 'sessions.send').params.message;
  const diagnostics = rCd2AuthorityChecks(evidence, null, identity, SIGNING_KEY);
  const receipt = resolveRcd2AuthoritativeReceipt({ evidence, correlation: null, identity, signingKey: SIGNING_KEY });
  const failing = Object.entries(diagnostics.lifecycle).filter(([, passed]) => !passed).map(([name]) => name);
  return { evidence, dispatch, diagnostics, receipt, failing };
}

const WAKE_PREDICATES = [
  'wakeLifecycle', 'wakeSessionBound', 'postWakeQuiet', 'wakeRunFingerprint',
  'distinctWakeRun', 'lifecycleEndBeforeWake', 'wakeBeforeQuietWindow',
];

/** The wake did not bind, and the receipt says so the way the live one did. */
function assertWakeUnbound(fired) {
  assert.deepEqual(fired.failing, WAKE_PREDICATES);
  assert.equal(fired.receipt.failureCategory, 'missing-send-run-lifecycle');
  assert.equal(fired.evidence.wake_lifecycle_observed, false);
  assert.equal(fired.evidence.wake_run_fingerprint, null);
}

test('R-CD-2 matrix 012658Z: the session-event wake turn binds the silent-wake lifecycle', async () => {
  const fired = await fireRcd2();
  // The live receipt failed exactly the seven wake predicates; all must hold.
  assert.deepEqual(fired.failing, [], `failing lifecycle predicates: ${fired.failing.join(', ')}`);
  assert.equal(fired.diagnostics.lifecycleComplete, true);
  // With no Tempo topology in this offline fire, the next gate is topology.
  assert.equal(fired.receipt.verdict, 'PARTIAL-candidate');
  assert.equal(fired.receipt.failureCategory, 'missing-continuation-topology');
  // The wake is bound to the woken run's own nonce-bound answer, which the
  // dispatch asks for, on a run distinct from the dispatch run.
  assert.ok(fired.dispatch.includes(`RCD2-WAKE-ACK ${fired.evidence.nonce}`), 'the dispatch asks the woken turn for a nonce-bound answer');
  assert.equal(fired.evidence.wake_receipt_source, 'assistant-wake-ack');
  assert.equal(fired.evidence.wake_run_fingerprint, createHash('sha256').update(WAKE_RUN).digest('hex').slice(0, 16));
  assert.notEqual(fired.evidence.wake_run_fingerprint, fired.evidence.send_run_fingerprint);
  assert.equal(fired.evidence.channel_message_observed, false);
  assert.ok(fired.evidence.post_wake_quiet_at_ms >= fired.evidence.wake_lifecycle_at_ms);
});

test('both forms: a heartbeat_respond completion record from the woken run still binds', async () => {
  // The 14d31a81b1 shape: the woken run answers through heartbeat_respond.
  const fired = await fireRcd2({
    wake: ({ sessionKey, nonce }) => [
      lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'start', data: { startedAt: Date.now(), isHeartbeat: true } }),
      transcript({
        runId: WAKE_RUN,
        sessionKey,
        message: { role: 'assistant', content: [{ type: 'toolCall', id: 'call_hb', name: 'heartbeat_respond', arguments: { outcome: 'done', notify: false, summary: `DONE ${nonce}` } }] },
      }),
    ],
  });
  assert.deepEqual(fired.failing, []);
  assert.equal(fired.receipt.failureCategory, 'missing-continuation-topology');
  assert.equal(fired.evidence.silent_status_record_observed, true);
});

test('no time-window attribution: a woken run that gives no nonce-bound answer does not bind', async () => {
  const fired = await fireRcd2({
    wake: ({ sessionKey, nonce }) => [
      lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'start', data: { startedAt: Date.now() } }),
      transcript({ runId: WAKE_RUN, sessionKey, message: assistantText(`DONE ${nonce}`) }),
      lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'end', data: { aborted: false, stopReason: 'stop' } }),
    ],
  });
  assertWakeUnbound(fired);
});

test('the wake acknowledgement never binds from the dispatch run', async () => {
  const fired = await fireRcd2({
    wake: ({ sessionKey, nonce, sendRunId }) => [
      lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'start', data: { startedAt: Date.now() } }),
      transcript({ runId: sendRunId, sessionKey, message: assistantText(`RCD2-WAKE-ACK ${nonce}`) }),
    ],
  });
  assertWakeUnbound(fired);
});

test('the wake acknowledgement binds only a run that started in the row session', async () => {
  const fired = await fireRcd2({
    wake: ({ sessionKey, nonce }) => [
      lifecycle({ runId: WAKE_RUN, sessionKey: 'agent:main:some-other-session', phase: 'start', data: { startedAt: Date.now() } }),
      transcript({ runId: WAKE_RUN, sessionKey, message: assistantText(`RCD2-WAKE-ACK ${nonce}`) }),
    ],
  });
  assertWakeUnbound(fired);
});

test('the wake acknowledgement binds only inside the delegate return window', async () => {
  // A run that starts before the delegate's own delay elapsed cannot be its wake.
  const fired = await fireRcd2({
    wakeAtMs: ACCEPTED_AT_MS + 200,
    wake: ({ sessionKey, nonce }) => [
      lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'start', data: { startedAt: Date.now() } }),
      transcript({ runId: WAKE_RUN, sessionKey, message: assistantText(`RCD2-WAKE-ACK ${nonce}`) }),
    ],
  });
  assertWakeUnbound(fired);
});

test('the wake acknowledgement must be the exact assistant answer, not echoed or embedded text', async () => {
  for (const message of [
    (nonce) => ({ role: 'user', content: [{ type: 'text', text: `RCD2-WAKE-ACK ${nonce}` }] }),
    (nonce) => assistantText(`Noted. RCD2-WAKE-ACK ${nonce}`),
    (nonce) => assistantText(`[k6-proof-harness] reply exactly RCD2-WAKE-ACK ${nonce}`),
  ]) {
    const fired = await fireRcd2({
      wake: ({ sessionKey, nonce }) => [
        lifecycle({ runId: WAKE_RUN, sessionKey, phase: 'start', data: { startedAt: Date.now() } }),
        transcript({ runId: WAKE_RUN, sessionKey, message: message(nonce) }),
      ],
    });
    assertWakeUnbound(fired);
  }
});
