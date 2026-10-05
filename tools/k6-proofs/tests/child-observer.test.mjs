// Tests for lib/child-observer.mjs (karmaterminal-openclaw-docs#562).
// Payload shapes follow the gateway at openclaw cut 41b8d69b90:
//   hello-ok: res payload, src/gateway/server/ws-connection/connect-hello.ts:300,
//             packages/gateway-protocol/src/schema/frames.ts:94,106-107
//   refusal:  method-authorization.ts:96-101, error-codes.ts:164-170
//   sessions.list: src/shared/session-types.ts:61-83, session-utils-row.ts:436-565
//   chat.history:  chat-history-handler.ts:558-575; spawn task text from
//                  src/agents/subagents/spawn/subagent-system-prompt.ts:23-36
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ROW_METHODS,
  advertisedMethodsFromHello,
  createChildObserver,
  createPreflightGate,
  failClosedVerdict,
  observationRefusal,
  preflightMethods,
  subagentTaskText,
} from '../lib/child-observer.mjs';
import { compactTaskIdentityToken } from '../lib/row-child-correlation.mjs';
import { rCd4TaskIdentityToken } from '../lib/r-cd-4-authority.mjs';
import {
  classifyTokenEvidence,
  createTokenSessionLedger,
  observeTokenSessionLedger,
  summarizeTokenSessionLedger,
  tokenPartialReasons,
  tokenSessionLedgerHasTerminalSessions,
} from '../lib/r-cd-token-contract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-cd-4-parent-r-cd-4-1791234567890-abcd1234';
const NONCE = 'R-CD-4-1791234567890-abcd1234';

// --- realistic frames -------------------------------------------------------

const ALL_METHODS = [
  'health', 'sessions.list', 'sessions.subscribe', 'sessions.messages.subscribe', 'sessions.describe',
  'sessions.create', 'sessions.send', 'agent.wait', 'chat.history', 'sessions.search', 'audit.run.inspect',
];

function helloOk(methods = ALL_METHODS) {
  return {
    type: 'res',
    id: 'connect-1',
    ok: true,
    payload: {
      type: 'hello-ok',
      protocol: 4,
      server: { version: '2026.9.27' },
      features: { methods, events: ['agent', 'session.message', 'sessions.changed'] },
    },
  };
}

const FORBIDDEN_ADMIN = {
  code: 'FORBIDDEN',
  message: 'missing scope: operator.admin',
  details: { code: 'MISSING_SCOPE', missingScope: 'operator.admin', requiredScopes: ['operator.admin'] },
};

function spawnTaskMessage(task) {
  return {
    role: 'user',
    content: [{
      type: 'text',
      text: `[Subagent Context] You are running as a subagent (depth 1/3). Results auto-announce to your requester.\n\n[Subagent Task]\n\n${task}\n\nBegin. Your assigned task is in the user message above.`,
    }],
    timestamp: 1791234570000,
  };
}

function sessionRow(key, spawnedBy, extra = {}) {
  return {
    key,
    kind: 'direct',
    spawnedBy,
    parentSessionKey: spawnedBy,
    spawnDepth: 1,
    subagentRole: 'orchestrator',
    createdVia: 'spawn',
    status: 'running',
    startedAt: 1791234569000,
    lastRunId: `run-${key.slice(-4)}`,
    modelProvider: 'openai',
    model: 'gpt-5.6-sol',
    ...extra,
  };
}

function listPayload(sessions, extra = {}) {
  return { ts: 1791234571000, path: '/state/sessions', count: sessions.length, defaults: {}, sessions, ...extra };
}

/** A fake gateway: records sends, answers them in the RequestTracker shape. */
function harness(observerOptions) {
  const sent = [];
  let next = 0;
  const observer = createChildObserver(observerOptions);
  observer.attach((method, params) => {
    const id = `req-${++next}`;
    sent.push({ id, method, params });
    return id;
  });
  function answer(request, { ok = true, payload = null, error = null } = {}) {
    const msg = { type: 'res', id: request.id, ok, payload, error };
    const claim = observer.claim(msg);
    assert.ok(claim, `observer claims ${request.method}`);
    return observer.handle(claim, { kind: 'response', method: request.method, ok, payload, error, latencyMs: 1 });
  }
  function take(method) {
    const index = sent.findIndex((r) => r.method === method && !r.answered);
    assert.ok(index >= 0, `a pending ${method} request exists`);
    sent[index].answered = true;
    return sent[index];
  }
  return { observer, sent, answer, take };
}

function bindOne({ h, requester, key, task, status = 'running', extra = {} }) {
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow(key, requester, { status, ...extra })]) });
  h.answer(h.take('chat.history'), {
    payload: { sessionKey: key, sessionId: 's-1', messages: [spawnTaskMessage(task)] },
  });
}

// --- preflight --------------------------------------------------------------

test('preflight: hello-ok features.methods carrying every row method is ready', () => {
  assert.deepEqual(advertisedMethodsFromHello(helloOk()), ALL_METHODS);
  const gate = createPreflightGate('R-CD-4');
  assert.equal(gate.observe(helloOk()), 'ready');
  assert.equal(gate.result.ok, true);
  assert.deepEqual(failClosedVerdict('PASS-candidate', { gate }), { verdict: 'PASS-candidate', reason: null });
});

test('preflight: a missing row method refuses before dispatch and names the method', () => {
  const gate = createPreflightGate('R-CD-4');
  const sent = [];
  const outcome = gate.observe(helloOk(ALL_METHODS.filter((m) => m !== 'chat.history')));
  if (outcome === 'ready') sent.push('sessions.create');
  assert.equal(outcome, 'refused');
  assert.deepEqual(sent, [], 'nothing is dispatched after a refused preflight');
  assert.deepEqual(gate.result.missing, ['chat.history']);
  const verdict = failClosedVerdict('PASS-candidate', { gate });
  assert.equal(verdict.verdict, 'PARTIAL-candidate');
  assert.match(verdict.reason, /preflight refused before dispatch: gateway does not advertise: chat\.history/);
});

test('preflight: the removed task-ledger method fails preflight for any row that still lists it', () => {
  const result = preflightMethods(['sessions.send', 'tasks.list'], ALL_METHODS);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['tasks.list']);
});

test('preflight: no method list, a refused connect, or no answer all refuse', () => {
  const noList = createPreflightGate('R-CD-1');
  assert.equal(noList.observe({ type: 'res', id: 'c', ok: true, payload: { type: 'hello-ok', features: {} } }), 'refused');
  assert.match(noList.result.reason, /no features\.methods/);

  const connectRefused = createPreflightGate('R-CD-1');
  assert.equal(connectRefused.observe({ type: 'res', id: 'c', ok: false, error: { code: 'UNAUTHORIZED', message: 'bad token' } }), 'refused');
  assert.match(connectRefused.result.reason, /connect refused: UNAUTHORIZED bad token/);

  const silent = createPreflightGate('R-CD-1');
  assert.equal(silent.observe({ type: 'event', event: 'connect.challenge', payload: {} }), null);
  assert.equal(silent.timeout(10000), true);
  assert.equal(failClosedVerdict('PASS-candidate', { gate: silent }).verdict, 'PARTIAL-candidate');

  const never = createPreflightGate('R-CD-1');
  assert.match(failClosedVerdict('PASS-candidate', { gate: never }).reason, /never completed/);
});

test('ROW_METHODS is the one method list and every manifest matches it', () => {
  const manifests = {
    'R-CD-1': 'r-cd-1', 'R-CD-2': 'r-cd-2', 'R-CD-3': 'r-cd-3', 'R-CD-4': 'r-cd-4',
    'R-CD-CHAINED-DEPTH-2': 'r-cd-chained-depth-2', 'R-CD-MODEL-DEFAULT': 'r-cd-model-default',
    'R-CD-MODEL-TOOL': 'r-cd-model-tool', 'R-CD-MODEL-TOKEN': 'r-cd-model-token',
    'R-CD-MODEL-CHAINED-ALT': 'r-cd-model-chained-alt', 'R-CD-TOKEN': 'r-cd-token',
    'R-CW-DELEGATE-SELF-CONTINUATION': 'r-cw-delegate-self', 'R-RC-2': 'r-rc-2',
  };
  assert.deepEqual(Object.keys(ROW_METHODS).sort(), Object.keys(manifests).sort());
  for (const [rowId, file] of Object.entries(manifests)) {
    const manifest = JSON.parse(readFileSync(path.join(root, 'manifests', `${file}.json`), 'utf8'));
    assert.equal(manifest.rowId, rowId);
    const gatewayMethods = manifest.scenario.methods.filter((m) => m.includes('.'));
    assert.deepEqual([...gatewayMethods].sort(), [...ROW_METHODS[rowId]].sort(), rowId);
    assert.ok(!gatewayMethods.includes('tasks.list'), `${rowId} no longer calls tasks.list`);
    assert.ok(!gatewayMethods.includes('sessions.get'), `${rowId} calls no advertise:false method`);
  }
});

// --- fail closed on refusal -------------------------------------------------

test('fail closed: FORBIDDEN on sessions.list is observation_refused, never "child not observed"', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { ok: false, error: FORBIDDEN_ADMIN });
  assert.deepEqual(h.observer.state.refusal, {
    method: 'sessions.list',
    code: 'FORBIDDEN',
    message: 'missing scope: operator.admin',
  });
  assert.equal(h.observer.summary().observation_refused.method, 'sessions.list');
  const verdict = failClosedVerdict('FAIL-candidate', { observer: h.observer });
  assert.equal(verdict.verdict, 'PARTIAL-candidate');
  assert.match(verdict.reason, /observation refused: sessions\.list FORBIDDEN missing scope: operator\.admin/);
  // A refused observer sends nothing further.
  const before = h.sent.length;
  assert.equal(h.observer.poll(), false);
  assert.equal(h.sent.length, before);
});

test('fail closed: an unknown method answer (admin caller) is also a refusal', () => {
  const refusal = observationRefusal('tasks.list', {
    ok: false,
    error: { code: 'INVALID_REQUEST', message: 'unknown method: tasks.list' },
  });
  assert.deepEqual(refusal, { method: 'tasks.list', code: 'INVALID_REQUEST', message: 'unknown method: tasks.list' });
  assert.equal(observationRefusal('chat.history', { ok: false, error: { code: 'INVALID_REQUEST', message: 'invalid chat.history params' } }), null);
  assert.equal(observationRefusal('chat.history', { ok: true, payload: {} }), null);
});

test('fail closed: a refused chat.history leaves the child unbound and the row PARTIAL', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow('agent:main:subagent:c1', PARENT)]) });
  h.answer(h.take('chat.history'), { ok: false, error: FORBIDDEN_ADMIN });
  assert.equal(h.observer.boundChild(NONCE).childSessionKey, null);
  assert.equal(failClosedVerdict('PASS-candidate', { observer: h.observer }).verdict, 'PARTIAL-candidate');
});

// --- binding strictness -----------------------------------------------------

test('binding: spawnedBy and the child own spawn task must both match', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), {
    payload: listPayload([
      sessionRow('agent:main:subagent:other-parent', 'agent:main:someone-else'),
      sessionRow('agent:main:subagent:mine', PARENT),
    ]),
  });
  // Only the row whose own spawnedBy is the parent was taken up.
  assert.deepEqual(h.observer.records().map((r) => r.childSessionKey), ['agent:main:subagent:mine']);
  h.answer(h.take('chat.history'), {
    payload: { sessionKey: 'agent:main:subagent:mine', messages: [spawnTaskMessage(`Proof nonce ${NONCE}: reply TARGET-RECEIVED`)] },
  });
  assert.equal(h.observer.boundChild(NONCE).childSessionKey, 'agent:main:subagent:mine');
  assert.equal(h.observer.boundChild(NONCE, [], { spawnedBy: 'agent:main:someone-else' }).childSessionKey, null);
});

test('binding: a nonce outside the child own spawn task never binds', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), {
    payload: listPayload([sessionRow('agent:main:subagent:stale', PARENT, { label: `k6 ${NONCE}`, displayName: NONCE })]),
  });
  h.answer(h.take('chat.history'), {
    payload: {
      sessionKey: 'agent:main:subagent:stale',
      messages: [
        spawnTaskMessage('Proof nonce R-CD-4-older-run: reply TARGET-RECEIVED'),
        { role: 'user', content: `later message mentioning ${NONCE}` },
        { role: 'assistant', content: [{ type: 'text', text: `TARGET-RECEIVED ${NONCE}` }] },
      ],
    },
  });
  // Label, display name and later messages carry the nonce; the spawn task does not.
  assert.equal(h.observer.boundChild(NONCE).childSessionKey, null);
});

test('binding: two children bound to the same row are ambiguous and bind nothing', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), {
    payload: listPayload([sessionRow('agent:main:subagent:a', PARENT), sessionRow('agent:main:subagent:b', PARENT)]),
  });
  for (const key of ['agent:main:subagent:a', 'agent:main:subagent:b']) {
    h.answer(h.take('chat.history'), { payload: { sessionKey: key, messages: [spawnTaskMessage(`nonce ${NONCE}`)] } });
  }
  const bound = h.observer.boundChild(NONCE);
  assert.equal(bound.childSessionKey, null);
  assert.equal(bound.ambiguous, true);
  assert.deepEqual(bound.candidates.sort(), ['agent:main:subagent:a', 'agent:main:subagent:b']);
});

test('binding: the root and requester keys are never taken as children', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow(PARENT, PARENT)]) });
  assert.deepEqual(h.observer.records(), []);
});

test('subagentTaskText reads only the first user message, after the marker', () => {
  assert.equal(subagentTaskText([
    { role: 'assistant', content: 'x' },
    spawnTaskMessage('THE TASK'),
    { role: 'user', content: 'second' },
  ]).startsWith('THE TASK'), true);
  assert.equal(subagentTaskText([{ role: 'user', content: 'no marker task' }]), 'no marker task');
  assert.equal(subagentTaskText([]), null);
});

// --- token exclusion (nested hops) ------------------------------------------

test('token exclusion: the delegate under hop-1 binds; hop-1 carrying both tokens does not', () => {
  const nonce = 'R-CD-MODEL-TOKEN-1791234567890-abcdefgh';
  const hop1Token = compactTaskIdentityToken('MTOK1', nonce);
  const delegateToken = compactTaskIdentityToken('MTOKD', nonce);
  const hop1 = 'agent:main:subagent:hop1';
  const delegate = 'agent:main:subagent:delegate';
  const h = harness({ rootSessionKey: PARENT, maxDepth: 2 });
  h.observer.poll();
  bindOne({
    h, requester: PARENT, key: hop1,
    task: `${hop1Token} hop-1 nonce ${nonce}. [[CONTINUE_DELEGATE: ${delegateToken} delegate nonce ${nonce} +1s | model=openai/gpt-5.6-terra]]`,
  });
  h.observer.poll();
  h.take('sessions.list'); // root page answered below with the same row
  const hop1List = h.sent.find((r) => r.method === 'sessions.list' && r.params.spawnedBy === hop1);
  assert.ok(hop1List, 'hop-1 becomes a requester at depth 2');
  hop1List.answered = true;
  h.answer(hop1List, { payload: listPayload([sessionRow(delegate, hop1, { spawnDepth: 2 })]) });
  h.answer(h.take('chat.history'), {
    payload: { sessionKey: delegate, messages: [spawnTaskMessage(`[continuation:chain-hop:1] Delegated task (turn 1/200): ${delegateToken} delegate nonce ${nonce}`)] },
  });
  assert.equal(h.observer.boundChild(hop1Token, [], { spawnedBy: PARENT }).childSessionKey, hop1);
  assert.equal(h.observer.boundChildForTokenOnly(delegateToken, hop1Token, { spawnedBy: hop1 }), delegate);
  // Across all lineages the delegate token alone matches hop-1 too; exclusion removes it.
  assert.equal(h.observer.boundChild(delegateToken, [], { spawnedBy: null }).ambiguous, true);
  assert.equal(h.observer.boundChildForTokenOnly(delegateToken, hop1Token), delegate);
  // The delegate is not under the parent, so a parent-lineage query cannot return it.
  assert.equal(h.observer.boundChildForTokenOnly(delegateToken, hop1Token, { spawnedBy: PARENT }), null);
});

// --- mapped predicates ------------------------------------------------------

test('R-CD-1 / R-CD-2 optional child context: nonce in the child own spawn task under the parent', () => {
  const nonce = 'R-CD-1-1791234567890-zzzzyyyy';
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  bindOne({
    h, requester: PARENT, key: 'agent:main:subagent:cd1',
    task: `[continuation:chain-hop:1] Delegated task (turn 1/200): Proof nonce ${nonce}: reply with DONE and the nonce only.`,
  });
  assert.equal(h.observer.boundChild(nonce).childSessionKey, 'agent:main:subagent:cd1');
});

test('R-CD-4: RCD4 task token binds the child; completion is the bound row status done', () => {
  const token = rCd4TaskIdentityToken(NONCE);
  const child = 'agent:main:subagent:rcd4';
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  bindOne({ h, requester: PARENT, key: child, task: `[continuation:chain-hop:1] Delegated task (turn 1/200): ${token} reply with TARGET-RECEIVED` });
  assert.equal(h.observer.boundChild(NONCE, [token]).childSessionKey, child);
  assert.equal(h.observer.childCompleted(child), false, 'running is not completed');
  h.observer.poll();
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow(child, PARENT, { status: 'done', endedAt: 1791234590000 })]) });
  assert.equal(h.observer.childCompleted(child), true);
  assert.equal(h.observer.childTerminal(child), true);
  h.observer.poll();
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow(child, PARENT, { status: 'failed' })]) });
  assert.equal(h.observer.childCompleted(child), false, 'failed is terminal but not completed');
  assert.equal(h.observer.childTerminal(child), true);
});

test('R-CD-CHAINED-DEPTH-2: lineage separates child from grandchild although both carry the nonce', () => {
  const nonce = 'R-CD-CHAIN-1791234567890-qqqqwwww';
  const child = 'agent:main:subagent:depth1';
  const grandchild = 'agent:main:subagent:depth2';
  const h = harness({ rootSessionKey: PARENT, maxDepth: 2 });
  h.observer.poll();
  bindOne({ h, requester: PARENT, key: child, task: `CHILD nonce ${nonce}: call continue_delegate with task="GRANDCHILD nonce ${nonce}"` });
  h.observer.poll();
  h.take('sessions.list');
  const childList = h.sent.find((r) => r.method === 'sessions.list' && r.params.spawnedBy === child);
  childList.answered = true;
  h.answer(childList, { payload: listPayload([sessionRow(grandchild, child, { spawnDepth: 2 })]) });
  h.answer(h.take('chat.history'), { payload: { sessionKey: grandchild, messages: [spawnTaskMessage(`GRANDCHILD nonce ${nonce}`)] } });
  assert.equal(h.observer.boundChild(nonce, [], { spawnedBy: PARENT }).childSessionKey, child);
  assert.equal(h.observer.boundChild(nonce, [], { spawnedBy: child }).childSessionKey, grandchild);
  assert.equal(h.observer.record(grandchild).depth, 2);
});

test('model rows: MTOOL / MDEF tokens bind the delegate child under the parent', () => {
  const nonce = 'R-CD-MODEL-TOOL-1791234567890-mmmmnnnn';
  const token = compactTaskIdentityToken('MTOOL', nonce);
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  bindOne({ h, requester: PARENT, key: 'agent:main:subagent:mtool', task: `${token} Proof nonce ${nonce}: reply exactly MODEL-TOOL-CHILD ${nonce} MODEL <provider/model>` });
  assert.equal(h.observer.boundChild(nonce, [token]).childSessionKey, 'agent:main:subagent:mtool');
  assert.equal(h.observer.boundChild('R-CD-MODEL-TOOL-other', [compactTaskIdentityToken('MTOOL', 'R-CD-MODEL-TOOL-other-nonce-xyz')]).childSessionKey, null);
});

test('R-RC-2: the RRC2 token binds the delegated child', () => {
  const nonce = 'R-RC-2-1791234567890-rrrrcccc';
  const token = compactTaskIdentityToken('RRC2', nonce);
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  bindOne({ h, requester: PARENT, key: 'agent:main:subagent:rc2', task: `${token} call request_compaction with reason containing the row nonce` });
  assert.equal(h.observer.boundChild(nonce, [token]).childSessionKey, 'agent:main:subagent:rc2');
});

test('R-CD-TOKEN: label + spawnedBy origin, marker + lineage delegate; task identity stays PARTIAL', () => {
  const hash = (v) => String(v).padEnd(16, '0').slice(0, 16).replace(/[^0-9a-f]/g, 'a');
  const originTitle = 'RCDT-O-0123456789abcdef';
  const delegateMarker = 'D-0123456789ab';
  const origin = 'agent:main:subagent:origin';
  const delegate = 'agent:main:subagent:token-delegate';
  const records = [
    { childSessionKey: origin, spawnedBy: PARENT, depth: 1, label: originTitle, status: 'done', lastRunId: 'run-origin', task: 'Reply exactly RCDT-HOP1-...' },
    { childSessionKey: 'agent:main:subagent:imposter', spawnedBy: 'agent:main:elsewhere', depth: 1, label: originTitle, status: 'done', lastRunId: 'run-x', task: 'x' },
    { childSessionKey: delegate, spawnedBy: origin, depth: 2, label: null, status: 'done', lastRunId: 'run-delegate', task: `[continuation:chain-hop:1] Delegated task (turn 1/200): ${delegateMarker} reply exactly RCDT-RETURN-tag` },
    { childSessionKey: 'agent:main:subagent:wrong-lineage', spawnedBy: PARENT, depth: 1, label: null, status: 'done', lastRunId: 'run-y', task: `${delegateMarker} stray` },
  ];
  const ledger = createTokenSessionLedger({ surfaceClass: 'raw-final-text' });
  observeTokenSessionLedger(ledger, { records, originTitle, delegateMarker, parentSessionKey: PARENT, hash });
  const summary = summarizeTokenSessionLedger(ledger);
  assert.equal(summary.origin_task_unique_count, 1);
  assert.equal(summary.delegate_task_unique_count, 1);
  assert.equal(summary.delegate_requester_matches_origin_child, true);
  assert.equal(summary.origin_task_status, 'completed');
  assert.equal(tokenSessionLedgerHasTerminalSessions(ledger), true);
  assert.equal(summary.origin_task_id_hash, null);
  const evidence = {
    ...summary,
    session_created: true, disposable_origin_ready: true, prompt_injected: true, send_accepted: true,
    origin_subscription_accepted: true, delegate_return_observed: true,
    task_snapshot_consistent: true, task_snapshot_stable_count: 3,
    send_run_id_hash: hash('s'), row_nonce_hash: hash('n'), attempt_id_hash: hash('a'),
    return_target_session_hash: summary.origin_child_session_hash,
    return_source_session_hash: summary.delegate_child_session_hash,
    interrupted: false,
  };
  assert.equal(classifyTokenEvidence(evidence), 'PARTIAL-candidate');
  assert.match(tokenPartialReasons(evidence)[0], /task identity \(taskId, parentTaskId\) has no gateway surface/);
});

test('R-CD-TOKEN traversal: pagination follows nextOffset; duplicates or a refused page void the round', () => {
  const rounds = [];
  const h = harness({ rootSessionKey: PARENT, onRoundComplete: (input, round) => rounds.push({ input, round }) });
  h.observer.poll();
  const first = h.take('sessions.list');
  h.answer(first, { payload: listPayload([sessionRow('agent:main:subagent:p1', PARENT)], { hasMore: true, nextOffset: 1 }) });
  const second = h.take('sessions.list');
  assert.equal(second.params.offset, 1);
  h.answer(second, { payload: listPayload([sessionRow('agent:main:subagent:p2', PARENT)], { hasMore: false }) });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].round.valid, true);
  assert.deepEqual(rounds[0].input.map((r) => r.key), ['agent:main:subagent:p1', 'agent:main:subagent:p2']);

  h.observer.poll();
  const dupFirst = h.take('sessions.list');
  h.answer(dupFirst, { payload: listPayload([sessionRow('agent:main:subagent:p1', PARENT)], { hasMore: true, nextOffset: 1 }) });
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow('agent:main:subagent:p1', PARENT)]) });
  assert.equal(rounds[1].round.valid, false, 'the same child twice in one traversal is inconsistent');

  h.observer.poll();
  h.answer(h.take('sessions.list'), { ok: false, error: { code: 'UNAVAILABLE', message: 'store busy' } });
  assert.equal(rounds[2].round.valid, false);
  assert.equal(h.observer.state.refusal, null, 'a non-refusal error is recorded as an error, not a refusal');
  assert.equal(h.observer.summary().observation_errors[0].code, 'UNAVAILABLE');
  assert.equal(failClosedVerdict('PASS-candidate', { observer: h.observer }).verdict, 'PARTIAL-candidate');
});

// --- #563 review item 4: non-refusal observer errors fail closed ------------

test('item 4: a non-refusal sessions.list error makes the row PARTIAL with the error named', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { ok: false, error: { code: 'UNAVAILABLE', message: 'session store busy' } });
  assert.equal(h.observer.state.refusal, null);
  assert.deepEqual(h.observer.incomplete(), { method: 'sessions.list', code: 'UNAVAILABLE', message: 'session store busy' });
  assert.deepEqual(h.observer.summary().observation_incomplete, { method: 'sessions.list', code: 'UNAVAILABLE', message: 'session store busy' });
  const verdict = failClosedVerdict('FAIL-candidate', { observer: h.observer });
  assert.equal(verdict.verdict, 'PARTIAL-candidate', 'an observer error never ends FAIL');
  assert.match(verdict.reason, /observation incomplete: sessions\.list UNAVAILABLE session store busy/);
});

test('item 4: hasMore without a usable nextOffset is a truncated traversal, not a complete one', () => {
  const rounds = [];
  const h = harness({ rootSessionKey: PARENT, onRoundComplete: (input, round) => rounds.push(round) });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow('agent:main:subagent:p1', PARENT)], { hasMore: true }) });
  assert.equal(rounds[0].valid, false);
  assert.equal(h.observer.incomplete().code, 'PAGINATION_TRUNCATED');
  assert.equal(failClosedVerdict('PASS-candidate', { observer: h.observer }).verdict, 'PARTIAL-candidate');
});

test('item 4: an invalid traversal (duplicate child) alone fails closed', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { payload: listPayload([sessionRow('agent:main:subagent:d', PARENT), sessionRow('agent:main:subagent:d', PARENT)]) });
  assert.equal(h.observer.incomplete().code, 'INVALID_TRAVERSAL');
  assert.equal(failClosedVerdict('PASS-candidate', { observer: h.observer }).verdict, 'PARTIAL-candidate');
});

test('item 4: keepProvenFail keeps an authoritative FAIL and records the observer problem', () => {
  const h = harness({ rootSessionKey: PARENT });
  h.observer.poll();
  h.answer(h.take('sessions.list'), { ok: false, error: { code: 'UNAVAILABLE', message: 'later poll failed' } });
  const kept = failClosedVerdict('FAIL-candidate', { observer: h.observer, keepProvenFail: true });
  assert.equal(kept.verdict, 'FAIL-candidate');
  assert.match(kept.observerReason, /observation incomplete/);
  // It never upgrades anything else, and a preflight refusal still wins.
  assert.equal(failClosedVerdict('PASS-candidate', { observer: h.observer, keepProvenFail: true }).verdict, 'PARTIAL-candidate');
  const gate = createPreflightGate('R-CD-MODEL-TOOL');
  gate.observe(helloOk(['sessions.send']));
  assert.equal(failClosedVerdict('FAIL-candidate', { gate, observer: h.observer, keepProvenFail: true }).verdict, 'PARTIAL-candidate');
});
