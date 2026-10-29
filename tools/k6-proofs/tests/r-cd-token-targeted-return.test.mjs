// R-CD-TOKEN return on the product's targeted-return route
// (karmaterminal/openclaw-bootstrap#1727).
//
// Live trap (emeric isolated gateway, runtime and candidate
// 8ba08c76d8f74a63238f2ce79302168748c31965, run 20261029T133725Z): the row
// ended PARTIAL, "bound delegate return not observed (window expired)". The
// gateway journal shows the product completing the path: origin child
// bracket-parse kind=delegate (06:37:39.084 PDT), delegate-spawned hop=1/200
// mode=normal (06:37:49.257), delegate run continuation:<id>:1 ended
// (06:37:52.017), `[continuation:targeted-return] Delivered to <origin child>
// from <delegate child>` (06:37:52.074), a turn on the origin child
// (06:37:58.681), then the origin's own announce run on the parent
// (06:38:07.258).
//
// Product shape at karmaterminal/openclaw 8ba08c76d8 (source walk of a clean
// detached checkout; no fresh GitNexus index exists for that SHA):
// - since the substrate restore 2273ef64d5 (2026-09-12) every pending delegate
//   carries a recipient-authority binding for its requester, so
//   routeSubagentContinuationReturn (subagent-announce.continuation-return.ts
//   :98-212) handles every delegate return as a targeted return; the
//   direct-announce delivery (deliverSubagentAnnouncement, sourceTool
//   subagent_announce) is never reached for a continuation delegate.
// - enqueueContinuationReturnDeliveries (auto-reply/continuation/targeting.ts
//   :175-381) writes a durable systemEvent row and queues a system event whose
//   text is the "[Internal task completion event]" block (session_key: <delegate
//   child>, then the child result carrying RCDT-RETURN-<tag>), then requests a
//   `delegate-return` wake on the origin child (requestContinuationWake ->
//   enqueueSessionEventForHost, continuation-wake.ts:186-206).
// - the wake is an ordinary session-event turn on the origin child. Its input
//   rows (the session-event row and the runtime-context row that carries the
//   delivered return text) are hidden from session.message and chat.history,
//   and its lifecycle data names no delegate (the same shape R-CD-2 binds,
//   lib/gateway-lifecycle.js). What a subscriber sees is that run's lifecycle
//   start/end on the origin key and the run's own assistant answer, stamped
//   __openclaw.runId.
// - the delegate child is spawned with the default cleanup "keep"
//   (subagent-spawn-request.ts:100): its own transcript keeps its answer,
//   stamped with its own run. The origin child is cleanup "delete": once its
//   held announce completes, its transcript is gone.
// The scenario bound the return only to an "[Inter-session message] ...
// sourceTool=subagent_announce sourceSession=<delegate child>" user row (both
// `bound-session-message-return` and `bound-target-transcript-return` used that
// one parser). This product never writes that row for a delegate, so the row
// could never bind.
//
// Each test fires the real R-CD-TOKEN scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a gateway scripted on the shapes above,
// passes its log through the real extractor, and resolves the evidence with the
// real row-scoped resolver. Date.now() follows the journal timeline at one
// observer round (750 ms) per traversal. No live gateway, seat or Tempo is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { resolveRcdTokenAuthoritativeReceipt } from '../lib/r-cd-token-authoritative-receipt.mjs';
import { classifyTokenEvidence } from '../lib/r-cd-token-contract.js';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenarioPath = path.join(root, 'scenarios/r-cd-token-bracket-delegate.js');
const manifestPath = path.join(root, 'manifests/r-cd-token.json');
const SHA = '8ba08c76d8f74a63238f2ce79302168748c31965';
const SIGNING_KEY = 'docs-1727-r-cd-token-targeted-return-key';
const ROW_NONCE = 'R-CD-TOKEN-1727-fossil-nonce';
const OTHER_RUN_NONCE = 'R-CD-TOKEN-1727-other-run-nonce';
const ATTEMPT_ID = 'R-CD-TOKEN-1727-fossil-attempt';
const ORIGIN = 'agent:main:subagent:5f0c2a9e-7d41-4b8a-9e3c-1a2b3c4d5e6f';
const DELEGATE = 'agent:main:subagent:9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const UNRELATED = 'agent:main:subagent:00000000-0000-4000-8000-000000000000';
const ORIGIN_RUN = '2c1d7e3a-6b5f-4e2d-9a1c-8f7e6d5c4b3a';
const DELEGATE_RUN = 'continuation:7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928:1';
const WAKE_RUN = 'b4e5f6a7-0c1d-4e2f-8a3b-6c7d8e9f0a1b';
// Journal (PDT + 7h): send accepted ~13:37:37.4, origin bracket run ended
// 13:37:39.100, delegate spawned 13:37:49.257, delegate ended 13:37:52.017,
// targeted return 13:37:52.074, origin wake turn ended 13:37:58.681, origin
// announce on the parent 13:38:07.258.
const ACCEPTED_AT_MS = Date.parse('2026-10-29T13:37:37.400Z');
const ROUND_MS = 750;
const at = (iso) => Math.ceil((Date.parse(iso) - ACCEPTED_AT_MS) / ROUND_MS);
const ORIGIN_DONE_ROUND = at('2026-10-29T13:37:39.100Z');
const DELEGATE_SPAWN_ROUND = at('2026-10-29T13:37:49.257Z');
const DELEGATE_DONE_ROUND = at('2026-10-29T13:37:52.017Z');
const WAKE_END_ROUND = at('2026-10-29T13:37:58.681Z');
const ORIGIN_DELETED_ROUND = at('2026-10-29T13:38:07.258Z') + 1;

const tagOf = (nonce) => createHash('sha256').update(String(nonce)).digest('hex').slice(0, 16);
const hash16 = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const TAG = tagOf(ROW_NONCE);
const SENTINEL = `RCDT-RETURN-${TAG}`;

const event = (name, payload) => ({ type: 'event', event: name, payload });

function lifecycle({ runId, sessionKey, phase, data = {} }) {
  return event('agent', { runId, stream: 'lifecycle', ts: Date.now(), sessionKey, agentId: 'main', data: { phase, ...data } });
}

function stamped(message, runId) {
  return runId ? { ...message, __openclaw: { runId } } : message;
}

function transcript({ sessionKey, message, runId }) {
  return event('session.message', { sessionKey, agentId: 'main', message: stamped(message, runId) });
}

const text = (role, body) => ({ role, content: [{ type: 'text', text: body }] });

/**
 * The 8ba08c76d8 targeted return as a subscriber of the origin child sees it:
 * the woken session-event run's lifecycle start, its own assistant answer and
 * its lifecycle end. The delivery row itself is hidden from session.message.
 */
function targetedReturnWake({ sentinel, sessionKey = ORIGIN, answerRunId = WAKE_RUN, startRunId = WAKE_RUN, answer }) {
  return [
    lifecycle({ runId: startRunId, sessionKey, phase: 'start', data: { startedAt: Date.now() } }),
    transcript({ sessionKey, runId: answerRunId, message: text('assistant', answer ?? sentinel) }),
    lifecycle({ runId: startRunId, sessionKey, phase: 'end', data: { aborted: false, stopReason: 'stop', executionSettled: true } }),
  ];
}

/** The legacy direct-announce delivery (deliverSubagentAnnouncement) on the origin child. */
function directAnnounce({ sentinel, sourceSession = DELEGATE }) {
  return [
    transcript({
      sessionKey: ORIGIN,
      message: text('user', `[Inter-session message] sourceSession=${sourceSession} sourceChannel=internal sourceTool=subagent_announce isUser=false\n[Internal task completion event]\nsource: subagent\nsession_key: ${sourceSession}\nstatus: completed; ready for parent review\n\n${sentinel}`),
    }),
  ];
}

/**
 * A gateway scripted on the 8ba08c76d8 shapes. The origin child lists under the
 * disposable parent with the row's label; the token delegate lists under the
 * origin child with its own spawn task. Wake frames arrive with the observer
 * round after the delegate finished, only on a session the scenario subscribed.
 *
 * Options shape the product evidence:
 * - wake(state): frames for the origin wake (default: targeted return)
 * - delegateAnswer / delegateAnswerRunId: the delegate's own final answer
 * - originHistory(state): extra origin transcript rows after the bracket run
 * - originDeleted: cleanup "delete" removes the origin after its announce
 * - deliverUnsubscribed: also hand the scenario wake frames for sessions it
 *   never subscribed to, so the parser (not the gateway) must reject them
 */
function scriptedGateway({
  clock,
  wake = (state) => targetedReturnWake({ sentinel: state.sentinel }),
  delegateAnswer = (state) => state.sentinel,
  delegateAnswerRunId = DELEGATE_RUN,
  originHistory = () => [],
  originDeleted = true,
  deliverUnsubscribed = false,
}) {
  const state = {
    parentKey: null, tag: null, sentinel: null, originTitle: null, childTask: null, delegateTask: null,
    round: 0, woke: false, subscribed: new Set(), wakeFrames: [],
  };
  const ok = (frame, payload) => ({ type: 'res', id: frame.id, ok: true, payload });
  const originRow = () => ({
    key: ORIGIN, spawnedBy: state.parentKey, label: state.originTitle, kind: 'subagent',
    status: state.round >= ORIGIN_DONE_ROUND ? 'done' : 'running', lastRunId: state.round >= DELEGATE_DONE_ROUND + 1 && state.woke ? WAKE_RUN : ORIGIN_RUN,
  });
  const delegateRow = () => ({
    key: DELEGATE, spawnedBy: ORIGIN, kind: 'subagent',
    status: state.round >= DELEGATE_DONE_ROUND ? 'done' : 'running', lastRunId: DELEGATE_RUN,
  });
  const originTranscript = () => [
    stamped(text('user', `[Subagent Task] ${state.childTask}`), null),
    stamped(text('assistant', `RCDT-HOP1-${state.tag}\n[[CONTINUE_DELEGATE: ${state.delegateTask} +10s]]`), ORIGIN_RUN),
    ...originHistory(state),
  ];
  const delegateTranscript = () => [
    stamped(text('user', `[Subagent Task] [continuation:chain-hop:1] Delegated task (turn 1/200): ${state.delegateTask}`), null),
    ...(state.round >= DELEGATE_DONE_ROUND && delegateAnswer(state) !== null
      ? [stamped(text('assistant', delegateAnswer(state)), delegateAnswerRunId)]
      : []),
  ];
  const deleted = () => originDeleted && state.round >= ORIGIN_DELETED_ROUND;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    switch (frame.method) {
      case 'connect':
        return [ok(frame, { type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-TOKEN']] } })];
      case 'sessions.create':
        state.parentKey = `agent:main:${frame.params.key}`;
        return [ok(frame, { key: state.parentKey })];
      case 'sessions.messages.subscribe':
        state.subscribed.add(frame.params.key);
        return [ok(frame, { subscribed: true, key: frame.params.key })];
      case 'sessions.send': {
        const message = frame.params.message;
        state.originTitle = /label="([^"]+)"/u.exec(message)?.[1];
        state.childTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/u.exec(message)?.[1] || 'null');
        state.tag = /RCDT-O-([0-9a-f]{16})/u.exec(state.originTitle || '')?.[1];
        state.delegateTask = /\[\[CONTINUE_DELEGATE: (.+) \+\d+s\]\]/u.exec(state.childTask || '')?.[1];
        assert.ok(state.originTitle && state.childTask && state.tag && state.delegateTask, 'the dispatch names the origin label, child task and delegate task');
        state.sentinel = `RCDT-RETURN-${state.tag}`;
        clock.set(ACCEPTED_AT_MS);
        return [ok(frame, { runId: frame.params.idempotencyKey, status: 'started' })];
      }
      case 'sessions.list': {
        const requester = frame.params?.spawnedBy;
        if (requester === state.parentKey) {
          state.round += 1;
          clock.set(ACCEPTED_AT_MS + state.round * ROUND_MS);
          const sessions = state.round >= 1 && !deleted() ? [originRow()] : [];
          const replies = [ok(frame, { sessions, hasMore: false })];
          if (!state.woke && state.round >= DELEGATE_DONE_ROUND + 1) {
            state.woke = true;
            state.wakeFrames = wake(state);
          }
          if (state.wakeFrames.length) {
            // Broadcasts reach only subscribers of the frame's session.
            const reaches = (f) => deliverUnsubscribed || state.subscribed.has(f.payload.sessionKey);
            const deliverable = state.wakeFrames.filter(reaches);
            state.wakeFrames = state.wakeFrames.filter((f) => !reaches(f));
            replies.push(...deliverable);
          }
          return replies;
        }
        if (requester === ORIGIN) {
          const sessions = state.round >= DELEGATE_SPAWN_ROUND ? [delegateRow()] : [];
          return [ok(frame, { sessions, hasMore: false })];
        }
        return [ok(frame, { sessions: [], hasMore: false })];
      }
      case 'chat.history': {
        const key = frame.params?.sessionKey;
        if (key === ORIGIN) return [ok(frame, { sessionKey: key, messages: deleted() ? [] : originTranscript(), hasMore: false })];
        if (key === DELEGATE) return [ok(frame, { sessionKey: key, messages: delegateTranscript(), hasMore: false })];
        return [ok(frame, { sessionKey: key, messages: [], hasMore: false })];
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

/** Fire the real scenario once against the scripted gateway; resolve its evidence. */
async function fireRcdToken(options = {}) {
  const realNow = Date.now;
  let now = Date.parse('2026-10-29T13:37:36.000Z');
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
        OPENCLAW_CANDIDATE_SHA: SHA,
        OPENCLAW_RUNTIME_BUILD_SHA: SHA,
        OPENCLAW_SEAT_NAME: 'emeric-isolated-composite',
        OPENCLAW_SEAT_CLASS: 'raw-final-text',
        OPENCLAW_SESSION_KEY: 'main',
        OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
        OPENCLAW_ROW_NONCE: ROW_NONCE,
        OPENCLAW_PROOF_ATTEMPT_ID: ATTEMPT_ID,
      },
    });
  } finally {
    Date.now = realNow;
  }
  const records = extractEvidence(fired.log);
  assert.equal(records.length, 1, `expected one R-CD-TOKEN evidence record:\n${fired.log}`);
  const [evidence] = records;
  const dispatch = fired.frames.find((frame) => frame.method === 'sessions.send').params.message;
  const receipt = resolveRcdTokenAuthoritativeReceipt({
    evidence,
    correlation: null,
    attemptState: {
      schema: 'openclaw.k6.r-cd-token.attempt-state.v1',
      row: 'R-CD-TOKEN',
      attemptIdHash: hash16(ATTEMPT_ID),
      rowNonceHash: hash16(ROW_NONCE),
      candidateSha: SHA,
      runtimeBuildSha: SHA,
      automaticRetryAllowed: false,
    },
    metadata: { row: 'R-CD-TOKEN', candidateSha: SHA, runtimeBuildSha: SHA },
    signingKey: SIGNING_KEY,
  });
  return { evidence, dispatch, receipt, frames: fired.frames, log: fired.log };
}

/** The return bound to origin (target) and delegate (source); the next gate is Tempo topology. */
function assertReturnBound(fired, receiptKind) {
  const { evidence, receipt } = fired;
  assert.equal(evidence.delegate_return_observed, true, `partial reasons: ${evidence.partial_reasons?.join('; ')}`);
  assert.equal(evidence.return_target_session_hash, hash16(ORIGIN));
  assert.equal(evidence.return_source_session_hash, hash16(DELEGATE));
  assert.equal(evidence.return_target_session_hash, evidence.origin_child_session_hash);
  assert.equal(evidence.return_source_session_hash, evidence.delegate_child_session_hash);
  assert.ok(evidence.event_receipt_kinds.includes(receiptKind), `receipt kinds: ${evidence.event_receipt_kinds.filter((k) => k.startsWith('bound-')).join(', ')}`);
  assert.equal(evidence.terminal_reason, 'exactly-once-token-chain-settled');
  assert.equal(classifyTokenEvidence(evidence), 'PASS-candidate');
  // With no Tempo topology in this offline fire, the next gate is topology.
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(receipt.failureCategory, 'missing-continuation-topology');
}

/** The return did not bind, and the evidence says so the way the live one did. */
function assertReturnUnbound(fired) {
  const { evidence, receipt } = fired;
  assert.equal(evidence.delegate_return_observed, false);
  assert.equal(evidence.return_target_session_hash, null);
  assert.equal(evidence.return_source_session_hash, null);
  // The return binding is the only thing missing: the control cannot pass for
  // an unrelated reason (identity, traversal or status).
  assert.deepEqual(evidence.partial_reasons, ['bound delegate return not observed']);
  assert.equal(evidence.terminal_reason, 'observation-window-expired');
  assert.equal(classifyTokenEvidence(evidence), 'PARTIAL-candidate');
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(receipt.failureCategory, 'incomplete-or-nonunique-lifecycle');
}

test('R-CD-TOKEN run 20261029T133725Z: the targeted return binds origin target and delegate source', async () => {
  const fired = await fireRcdToken();
  // Everything else the live run needed is present: one origin, one delegate,
  // both done, stable traversals, the origin subscription accepted.
  assert.equal(fired.evidence.origin_task_unique_count, 1);
  assert.equal(fired.evidence.delegate_task_unique_count, 1);
  assert.equal(fired.evidence.origin_subscription_accepted, true);
  assertReturnBound(fired, 'bound-session-message-return');
});

test('cleanup "delete" removes the origin transcript; the live route still binds', async () => {
  // The origin is deleted right after its announce; chat.history then answers
  // an empty transcript, and only the live subscription carries the wake.
  const fired = await fireRcdToken({ originDeleted: true });
  assertReturnBound(fired, 'bound-session-message-return');
  assert.equal(fired.evidence.event_receipt_kinds.includes('bound-target-transcript-return'), false);
});

test('the origin transcript recovers a wake answer the live subscription missed', async () => {
  // The wake ran before any origin subscriber existed (no live frame), and the
  // origin transcript still holds that run's answer.
  const fired = await fireRcdToken({
    originDeleted: false,
    wake: () => [],
    originHistory: (state) => state.round >= WAKE_END_ROUND ? [stamped(text('assistant', state.sentinel), WAKE_RUN)] : [],
  });
  assertReturnBound(fired, 'bound-target-transcript-return');
});

test('both forms: the direct-announce delivery still binds', async () => {
  const fired = await fireRcdToken({ wake: (state) => directAnnounce({ sentinel: state.sentinel }) });
  assertReturnBound(fired, 'bound-session-message-return');
});

test('negative: the wake answer in another session does not bind', async () => {
  for (const sessionKey of [UNRELATED, DELEGATE, null]) {
    const fired = await fireRcdToken({
      // null: the parent session (the scenario subscribes to it).
      wake: (state) => targetedReturnWake({ sentinel: state.sentinel, sessionKey: sessionKey || state.parentKey }),
      deliverUnsubscribed: true,
    });
    assertReturnUnbound(fired);
  }
  for (const wake of [
    // The answer on the origin, but its run started in another session.
    (state) => [
      lifecycle({ runId: WAKE_RUN, sessionKey: UNRELATED, phase: 'start' }),
      transcript({ sessionKey: ORIGIN, runId: WAKE_RUN, message: text('assistant', state.sentinel) }),
    ],
    // The run started on the origin, but the answer is in another session.
    (state) => [
      lifecycle({ runId: WAKE_RUN, sessionKey: ORIGIN, phase: 'start' }),
      transcript({ sessionKey: UNRELATED, runId: WAKE_RUN, message: text('assistant', state.sentinel) }),
    ],
    // A direct-announce row from the delegate, delivered to another session.
    (state) => directAnnounce({ sentinel: state.sentinel }).map((frame) => ({
      ...frame, payload: { ...frame.payload, sessionKey: UNRELATED },
    })),
  ]) {
    const fired = await fireRcdToken({ wake, deliverUnsubscribed: true });
    assertReturnUnbound(fired);
  }
});

test('negative: transcript recovery keeps every binding', async () => {
  for (const options of [
    // The origin's own bracket run, not a woken run.
    { originHistory: (state) => [stamped(text('assistant', state.sentinel), ORIGIN_RUN)] },
    // An unstamped row.
    { originHistory: (state) => [stamped(text('assistant', state.sentinel), null)] },
    // Another row run's sentinel.
    { originHistory: () => [stamped(text('assistant', `RCDT-RETURN-${tagOf(OTHER_RUN_NONCE)}`), WAKE_RUN)] },
    // No delegate source leg.
    { originHistory: (state) => [stamped(text('assistant', state.sentinel), WAKE_RUN)], delegateAnswer: () => null },
    // Two candidate answers: not exactly one.
    { originHistory: (state) => [stamped(text('assistant', state.sentinel), WAKE_RUN), stamped(text('assistant', state.sentinel), 'second-run')] },
  ]) {
    const fired = await fireRcdToken({
      originDeleted: false,
      wake: () => [],
      ...options,
      originHistory: (state) => state.round >= WAKE_END_ROUND ? options.originHistory(state) : [],
    });
    assertReturnUnbound(fired);
  }
});

test('negative: a wrong sentinel does not bind', async () => {
  for (const answer of [
    (state) => `RCDT-HOP1-${state.tag}`,
    (state) => `${state.sentinel}0`,
    (state) => `RCDT-RETURN ${state.tag}`,
    (state) => `[k6-proof-harness] ${state.sentinel}`,
  ]) {
    const fired = await fireRcdToken({ wake: (state) => targetedReturnWake({ sentinel: state.sentinel, answer: answer(state) }) });
    assertReturnUnbound(fired);
  }
});

test('negative: another run does not bind', async () => {
  const otherSentinel = `RCDT-RETURN-${tagOf(OTHER_RUN_NONCE)}`;
  for (const options of [
    // Another row run's sentinel, from the origin and the delegate alike.
    { wake: () => targetedReturnWake({ sentinel: otherSentinel }), delegateAnswer: () => otherSentinel },
    // The origin's own bracket run, not a woken run: the scheduled bracket echo.
    { wake: (state) => targetedReturnWake({ sentinel: state.sentinel, startRunId: ORIGIN_RUN, answerRunId: ORIGIN_RUN }) },
    // An answer from a run that never started on the origin.
    { wake: (state) => targetedReturnWake({ sentinel: state.sentinel, answerRunId: 'run-that-never-started' }) },
    // An answer with no run identity at all: unbound.
    { wake: (state) => targetedReturnWake({ sentinel: state.sentinel, answerRunId: null }) },
  ]) {
    const fired = await fireRcdToken(options);
    assertReturnUnbound(fired);
  }
});

test('negative: a return without the delegate source binding does not bind', async () => {
  for (const options of [
    // The delegate never answered the sentinel.
    { delegateAnswer: () => 'I could not do that.' },
    // The delegate transcript has no answer at all.
    { delegateAnswer: () => null },
    // The sentinel row in the delegate transcript is not the delegate's run.
    { delegateAnswerRunId: 'continuation:someone-else:1' },
    // A direct-announce row naming another source session.
    { wake: (state) => directAnnounce({ sentinel: state.sentinel, sourceSession: UNRELATED }), delegateAnswer: () => null },
  ]) {
    const fired = await fireRcdToken(options);
    assertReturnUnbound(fired);
  }
});

test('the hidden delivery alone (no woken answer) does not bind', async () => {
  const fired = await fireRcdToken({ wake: (state) => [lifecycle({ runId: WAKE_RUN, sessionKey: ORIGIN, phase: 'start' })] });
  assertReturnUnbound(fired);
});

test('the origin child is told how to answer the delegate return on its woken turn', async () => {
  // The woken turn's only run-bound receipt is its own answer (input rows are
  // hidden), so the dispatch asks for the exact sentinel there, after the
  // completion arrives, and never in the bracket turn itself.
  const fired = await fireRcdToken();
  const childTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/u.exec(fired.dispatch)[1]);
  assert.match(childTask, new RegExp(`only after an internal task completion contains ${SENTINEL}, reply exactly ${SENTINEL}`));
  assert.ok(childTask.indexOf(SENTINEL) < childTask.indexOf('[[CONTINUE_DELEGATE:'), 'the later-turn instruction precedes the terminal bracket');
  assert.ok(childTask.trimEnd().endsWith('Do not mutate files.'));
});
