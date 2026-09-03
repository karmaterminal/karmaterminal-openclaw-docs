import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  classifyTokenEvidence,
  createTokenLedger,
  observeTokenTaskLedger,
  parseTokenReturnEvent,
  rejectTokenTaskLedgerObservation,
  summarizeTokenLedger,
  tokenDisposableOriginReady,
  tokenLedgerHasTerminalTasks,
} from '../../lib/r-cd-token-contract.js';

const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const parentSessionKey = 'agent:main:proof-parent';
const originTitle = 'RCDT-O-0123456789abcdef';
const delegateMarker = 'D-0123456789ab';
const returnSentinel = 'RCDT-RETURN-0123456789abcdef';
const originChild = 'agent:main:subagent:origin-child';
const delegateChild = 'agent:main:subagent:delegate-child';

function taskSummary({
  id, runId, childSessionKey, title, sessionKey, status = 'completed', parentTaskId,
}) {
  return {
    id,
    taskId: id,
    kind: 'subagent',
    runtime: 'subagent',
    runId,
    childSessionKey,
    title,
    sessionKey,
    status,
    ...(parentTaskId ? { parentTaskId } : {}),
  };
}

function wireTasks(status = 'completed') {
  return [
    taskSummary({
      id: 'origin-id', runId: 'origin-run', childSessionKey: originChild,
      title: originTitle, sessionKey: parentSessionKey, status,
    }),
    taskSummary({
      id: 'delegate-id', runId: 'delegate-run', childSessionKey: delegateChild,
      title: `[continuation:chain-hop:1] Delegated from sub-agent (depth 1): ${delegateMarker}`
        .replace(/\s+/g, ' ').trim().slice(0, 80),
      sessionKey: originChild, parentTaskId: 'origin-id', status,
    }),
  ];
}

function completeEvidence(overrides = {}) {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  observeTokenTaskLedger(ledger, {
    hash,
    originTitle,
    delegateMarker,
    parentSessionKey,
    pages: 2,
    tasks: wireTasks(),
  });
  return {
    ...summarizeTokenLedger(ledger),
    session_created: true,
    disposable_origin_ready: true,
    session_owner_bound: true,
    session_owner_verified: true,
    session_owner_verification_count: 3,
    owner_binding_session_hash: hash('agent:main:main'),
    session_owner_agent_hash: hash('main'),
    prompt_injected: true,
    send_accepted: true,
    send_run_id_hash: hash('send-run'),
    row_nonce_hash: hash('nonce'),
    attempt_id_hash: hash('attempt'),
    origin_subscription_accepted: true,
    delegate_return_observed: true,
    task_snapshot_consistent: true,
    task_snapshot_stable_count: 3,
    task_snapshot_digest: hash('stable-task-snapshot'),
    return_target_session_hash: hash(originChild),
    return_source_session_hash: hash(delegateChild),
    interrupted: false,
    ...overrides,
  };
}

test('accepts the real public TaskSummary shape and normalizes completed status', () => {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text-seat' });
  observeTokenTaskLedger(ledger, {
    tasks: wireTasks('running'), originTitle, delegateMarker, parentSessionKey, pages: 2, hash,
  });
  observeTokenTaskLedger(ledger, {
    tasks: wireTasks('completed'), originTitle, delegateMarker, parentSessionKey, pages: 2, hash,
  });
  const summary = summarizeTokenLedger(ledger);
  assert.equal(summary.origin_task_unique_count, 1);
  assert.equal(summary.delegate_task_unique_count, 1);
  assert.equal(summary.origin_task_status, 'completed');
  assert.equal(summary.delegate_task_status, 'completed');
  assert.equal(summary.delegate_requester_matches_origin_child, true);
  assert.equal(summary.task_pagination_exhausted, true);
  assert.equal(summary.task_pages_accepted, 4);
  assert.equal(tokenLedgerHasTerminalTasks(ledger), true);
});

test('bounded public titles are joined by short markers plus requester lineage, not raw task text', () => {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  const tasks = wireTasks();
  const productionTask = `[continuation:chain-hop:1] Delegated from sub-agent (depth 1): ${delegateMarker} reply exactly ${returnSentinel}`;
  tasks[1].title = productionTask.replace(/\s+/g, ' ').trim().slice(0, 80);
  assert.equal('[continuation:chain-hop:1] Delegated from sub-agent (depth 1): '.length, 63);
  assert.equal(tasks[1].title.length, 80);
  assert.equal(tasks[1].title.includes(delegateMarker), true);
  observeTokenTaskLedger(ledger, {
    tasks, originTitle, delegateMarker, parentSessionKey, pages: 1, hash,
  });
  assert.equal(summarizeTokenLedger(ledger).delegate_task_unique_count, 1);
  const wrongOwner = createTokenLedger({ surfaceClass: 'raw-final-text' });
  tasks[1].sessionKey = 'agent:main:subagent:unrelated';
  observeTokenTaskLedger(wrongOwner, {
    tasks, originTitle, delegateMarker, parentSessionKey, pages: 1, hash,
  });
  assert.equal(summarizeTokenLedger(wrongOwner).delegate_task_unique_count, 0);
});

test('disposable origin gate rejects disabled, failed, missing, and fallback creation', () => {
  const ready = {
    creationRequested: true,
    sessionCreated: true,
    requestedSessionKey: parentSessionKey,
    activeSessionKey: 'agent:main:proof-disposable',
  };
  assert.equal(tokenDisposableOriginReady(ready), true);
  for (const overrides of [
    { creationRequested: false },
    { sessionCreated: false },
    { activeSessionKey: '' },
    { activeSessionKey: parentSessionKey },
  ]) {
    let dispatches = 0;
    if (tokenDisposableOriginReady({ ...ready, ...overrides })) dispatches += 1;
    assert.equal(dispatches, 0);
  }
});

test('duplicate scheduling and parent-task mismatch are deterministic PARTIAL', () => {
  assert.equal(classifyTokenEvidence(completeEvidence({ delegate_task_unique_count: 2 })), 'PARTIAL-candidate');
  assert.equal(classifyTokenEvidence(completeEvidence({ delegate_parent_mismatch: true })), 'PARTIAL-candidate');
});

test('interruption, unstable pagination, missing return, and incomplete identities are PARTIAL', () => {
  for (const overrides of [
    { interrupted: true },
    { disposable_origin_ready: false },
    { session_owner_bound: false },
    { session_owner_verified: false },
    { session_owner_verification_count: 1 },
    { owner_binding_session_hash: null },
    { tasks_list_rejected: 1 },
    { task_pagination_exhausted: false },
    { task_snapshot_consistent: false },
    { task_snapshot_stable_count: 2 },
    { origin_subscription_accepted: false },
    { delegate_return_observed: false },
    { delegate_run_id_hash: null },
    { delegate_task_status: 'running' },
    { delegate_run_id_hash: completeEvidence().origin_run_id_hash },
    { return_source_session_hash: hash('other-child') },
  ]) {
    assert.equal(classifyTokenEvidence(completeEvidence(overrides)), 'PARTIAL-candidate');
  }
});

test('message-body and undeclared surfaces remain PARTIAL proof debt', () => {
  assert.equal(classifyTokenEvidence(completeEvidence({ surface_class: 'message-body' })), 'PARTIAL-candidate');
  assert.equal(classifyTokenEvidence(completeEvidence({ surface_class: 'unknown' })), 'PARTIAL-candidate');
});

test('complete raw-final-text task ledger and bound return are PASS-candidate', () => {
  assert.equal(classifyTokenEvidence(completeEvidence()), 'PASS-candidate');
});

test('structured return parser binds target and source sessions', () => {
  const event = {
    sessionKey: originChild,
    message: {
      role: 'user',
      content: [{
        type: 'text',
        text: `[Inter-session message] sourceSession=${delegateChild} sourceChannel=internal sourceTool=subagent_announce isUser=false\n${returnSentinel}`,
      }],
    },
  };
  assert.deepEqual(parseTokenReturnEvent(event, {
    expectedTargetSessionKey: originChild,
    expectedDelegateChildSessionKey: delegateChild,
    expectedSentinel: returnSentinel,
    hash,
  }), {
    targetSessionHash: hash(originChild),
    sourceSessionHash: hash(delegateChild),
  });
});

test('prompt echo, arbitrary event text, wrong session, and wrong delegate are rejected', () => {
  const base = {
    sessionKey: originChild,
    message: {
      role: 'user',
      content: [{
        type: 'text',
        text: `[Inter-session message] sourceSession=${delegateChild} sourceTool=subagent_announce\n${returnSentinel}`,
      }],
    },
  };
  const variants = [
    { ...base, sessionKey: 'agent:main:unrelated' },
    { ...base, message: { ...base.message, content: [{ type: 'text', text: `[k6-proof-harness] ${returnSentinel}` }] } },
    { ...base, message: { ...base.message, content: [{ type: 'text', text: `random ${returnSentinel}` }] } },
    { ...base, message: { ...base.message, content: [{ type: 'text', text: `[Inter-session message] sourceSession=agent:main:other sourceTool=subagent_announce\n${returnSentinel}` }] } },
  ];
  for (const event of variants) {
    assert.equal(parseTokenReturnEvent(event, {
      expectedTargetSessionKey: originChild,
      expectedDelegateChildSessionKey: delegateChild,
      expectedSentinel: returnSentinel,
      hash,
    }), null);
  }
});

test('task-list rejection is recorded fail-closed', () => {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  rejectTokenTaskLedgerObservation(ledger);
  const summary = summarizeTokenLedger(ledger);
  assert.equal(summary.tasks_list_rejected, 1);
  assert.equal(summary.task_pagination_exhausted, false);
});
