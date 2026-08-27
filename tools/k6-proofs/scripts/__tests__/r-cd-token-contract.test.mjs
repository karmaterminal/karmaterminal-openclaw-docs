import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  classifyTokenEvidence,
  createTokenLedger,
  observeTokenTaskLedger,
  parseTokenReturnEvent,
  parseTokenReturnTranscriptMessage,
  rejectTokenTaskLedgerObservation,
  summarizeTokenLedger,
  tokenDisposableOriginReady,
  tokenExpectedOriginReturnRunId,
  tokenLedgerHasTerminalTasks,
  tokenOriginCursorFromMessages,
} from '../../lib/r-cd-token-contract.js';

const frozenRun = JSON.parse(await readFile(
  new URL('../../tests/fixtures/r-cd-token-run-33014309397.json', import.meta.url),
  'utf8',
));
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const parentSessionKey = 'agent:main:proof-parent';
const originTitle = 'RCDT-O-0123456789abcdef';
const returnSentinel = 'RCDT-RETURN-0123456789abcdef';
const originChild = 'agent:main:subagent:origin-child';
const delegateChild = 'agent:main:subagent:delegate-child';
const originRunId = 'origin-run';
const delegateRunId = 'delegate-run';
const originReturnRunId = tokenExpectedOriginReturnRunId(delegateChild, delegateRunId);

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
      title: '',
      sessionKey: originChild, parentTaskId: 'origin-id', status,
    }),
  ];
}

function completeEvidence(overrides = {}) {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  observeTokenTaskLedger(ledger, {
    hash,
    originTitle,
    parentSessionKey,
    pages: 2,
    tasks: wireTasks(),
  });
  return {
    ...summarizeTokenLedger(ledger),
    session_created: true,
    disposable_origin_ready: true,
    prompt_injected: true,
    send_accepted: true,
    send_run_id_hash: hash('send-run'),
    row_nonce_hash: hash('nonce'),
    attempt_id_hash: hash('attempt'),
    origin_subscription_accepted: true,
    origin_cursor_snapshot_accepted: true,
    origin_cursor_snapshots_rejected: 0,
    delegate_return_observed: true,
    origin_return_event_count: 1,
    root_substituted_return_count: 0,
    origin_return_run_id_hash: hash(originReturnRunId),
    origin_return_cursor: 2,
    origin_return_message_seq: 3,
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
    tasks: wireTasks('running'), originTitle, parentSessionKey, pages: 2, hash,
  });
  observeTokenTaskLedger(ledger, {
    tasks: wireTasks('completed'), originTitle, parentSessionKey, pages: 2, hash,
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

test('unlabeled token tasks are joined by disposable origin-child ownership', () => {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  const tasks = wireTasks();
  assert.equal(tasks[1].title, '');
  observeTokenTaskLedger(ledger, {
    tasks, originTitle, parentSessionKey, pages: 1, hash,
  });
  const summary = summarizeTokenLedger(ledger);
  assert.equal(summary.delegate_task_unique_count, 1);
  assert.equal(summary.delegate_correlation_strategy, 'disposable-origin-child-lineage');
  const wrongOwner = createTokenLedger({ surfaceClass: 'raw-final-text' });
  tasks[1].sessionKey = 'agent:main:subagent:unrelated';
  observeTokenTaskLedger(wrongOwner, {
    tasks, originTitle, parentSessionKey, pages: 1, hash,
  });
  assert.equal(summarizeTokenLedger(wrongOwner).delegate_task_unique_count, 0);
});

test('unlabeled lineage correlation fails closed on duplicates and parent mismatch', () => {
  const duplicateLedger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  const tasks = wireTasks();
  tasks.push(taskSummary({
    id: 'delegate-id-2',
    runId: 'delegate-run-2',
    childSessionKey: 'agent:main:subagent:delegate-child-2',
    title: '',
    sessionKey: originChild,
    parentTaskId: 'origin-id',
  }));
  observeTokenTaskLedger(duplicateLedger, {
    tasks, originTitle, parentSessionKey, pages: 1, hash,
  });
  assert.equal(summarizeTokenLedger(duplicateLedger).delegate_task_unique_count, 2);

  const mismatchedLedger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  const mismatched = wireTasks();
  mismatched[1].parentTaskId = 'unrelated-origin';
  observeTokenTaskLedger(mismatchedLedger, {
    tasks: mismatched, originTitle, parentSessionKey, pages: 1, hash,
  });
  const mismatch = summarizeTokenLedger(mismatchedLedger);
  assert.equal(mismatch.delegate_task_unique_count, 0);
  assert.equal(mismatch.delegate_parent_mismatch, true);
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
    { tasks_list_rejected: 1 },
    { task_pagination_exhausted: false },
    { task_snapshot_consistent: false },
    { task_snapshot_stable_count: 2 },
    { origin_subscription_accepted: false },
    { origin_cursor_snapshot_accepted: false },
    { origin_cursor_snapshots_rejected: 1 },
    { delegate_return_observed: false },
    { origin_return_event_count: 0 },
    { origin_return_event_count: 2 },
    { root_substituted_return_count: 1 },
    { origin_return_run_id_hash: null },
    { origin_return_cursor: null },
    { origin_return_cursor: '2' },
    { origin_return_message_seq: 2 },
    { origin_return_message_seq: '3' },
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
    runId: originReturnRunId,
    messageSeq: 3,
    message: {
      role: 'assistant',
      timestamp: 3000,
      content: [{
        type: 'text',
        text: `Continuation completed with result: \`${returnSentinel}\``,
      }],
      __openclaw: { runId: originReturnRunId, seq: 3 },
    },
  };
  assert.deepEqual(parseTokenReturnEvent(event, {
    expectedTargetSessionKey: originChild,
    expectedDelegateChildSessionKey: delegateChild,
    expectedDelegateRunId: delegateRunId,
    expectedSentinel: returnSentinel,
    originCursor: 2,
    subscriptionAcceptedAtMs: 1000,
    observedAtMs: 3010,
    hash,
  }), {
    targetSessionHash: hash(originChild),
    sourceSessionHash: hash(delegateChild),
    returnRunIdHash: hash(originReturnRunId),
    messageSeq: 3,
    messageTimeMs: 3000,
    observedAtMs: 3010,
  });

  test('durable transcript recovery binds a return emitted before subscription', () => {
    const message = {
      role: 'assistant',
      timestamp: 3000,
      content: [{
        type: 'text',
        text: `Continuation completed with result: \`${returnSentinel}\``,
      }],
      __openclaw: { runId: originReturnRunId, seq: 3 },
    };
    assert.deepEqual(parseTokenReturnTranscriptMessage(message, {
      expectedTargetSessionKey: originChild,
      expectedDelegateChildSessionKey: delegateChild,
      expectedDelegateRunId: delegateRunId,
      expectedSentinel: returnSentinel,
      originCursor: 2,
      observedAtMs: 5000,
      hash,
    }), {
      targetSessionHash: hash(originChild),
      sourceSessionHash: hash(delegateChild),
      returnRunIdHash: hash(originReturnRunId),
      messageSeq: 3,
      messageTimeMs: 3000,
      observedAtMs: 5000,
    });
    assert.equal(parseTokenReturnTranscriptMessage(
      { ...message, __openclaw: { runId: 'wrong-run', seq: 3 } },
      {
        expectedTargetSessionKey: originChild,
        expectedDelegateChildSessionKey: delegateChild,
        expectedDelegateRunId: delegateRunId,
        expectedSentinel: returnSentinel,
        originCursor: 2,
        observedAtMs: 5000,
        hash,
      },
    ), null);
  });
});

test('origin cursor is the last assistant message owned by the initial origin run', () => {
  assert.deepEqual(tokenOriginCursorFromMessages([
    { role: 'user', timestamp: 1000, __openclaw: { seq: 1 } },
    { role: 'assistant', timestamp: 2000, __openclaw: { seq: 2, runId: originRunId } },
    { role: 'assistant', timestamp: 3000, __openclaw: { seq: 3, runId: 'unrelated-run' } },
  ], { expectedOriginRunId: originRunId }), {
    messageSeq: 2,
    messageTimeMs: 2000,
  });
  assert.equal(tokenOriginCursorFromMessages([
    { role: 'assistant', timestamp: 2000, __openclaw: { seq: 2, runId: 'other-run' } },
  ], { expectedOriginRunId: originRunId }), null);
});

test('frozen run 33014309397 binds the normal origin assistant event, not the stale bracket or root result', () => {
  const identities = frozenRun.identities;
  const normal = frozenRun.events.find((event) => event.label === 'normal-origin-return');
  const receipt = parseTokenReturnEvent(normal.eventData, {
    expectedTargetSessionKey: identities.originChildSessionKey,
    expectedDelegateChildSessionKey: identities.delegateChildSessionKey,
    expectedDelegateRunId: identities.delegateRunId,
    expectedSentinel: identities.returnSentinel,
    originCursor: frozenRun.window.originCursor.messageSeq,
    subscriptionAcceptedAtMs: frozenRun.window.originSubscriptionAcceptedAtMs,
    observedAtMs: normal.observedAtMs,
    hash,
  });
  assert.deepEqual(receipt, {
    targetSessionHash: hash(identities.originChildSessionKey),
    sourceSessionHash: hash(identities.delegateChildSessionKey),
    returnRunIdHash: hash(identities.originReturnRunId),
    messageSeq: 3,
    messageTimeMs: 3500,
    observedAtMs: 3510,
  });
  assert.ok(normal.observedAtMs > frozenRun.window.delegateTaskTerminalAtMs);

  for (const rejected of frozenRun.events.filter((event) => event !== normal)) {
    assert.equal(parseTokenReturnEvent(rejected.eventData, {
      expectedTargetSessionKey: identities.originChildSessionKey,
      expectedDelegateChildSessionKey: identities.delegateChildSessionKey,
      expectedDelegateRunId: identities.delegateRunId,
      expectedSentinel: identities.returnSentinel,
      originCursor: frozenRun.window.originCursor.messageSeq,
      subscriptionAcceptedAtMs: frozenRun.window.originSubscriptionAcceptedAtMs,
      observedAtMs: rejected.observedAtMs,
      hash,
    }), null, rejected.label);
  }
});

test('frozen artifact remains an explicit pre-fix negative and contains no private identifiers', () => {
  assert.equal(classifyTokenEvidence(frozenRun.frozenPublicEvidence), 'PARTIAL-candidate');
  const serialized = JSON.stringify(frozenRun);
  assert.doesNotMatch(serialized, /02244baac04f1755|ecfae93c|b9a70ed6|b739ecda/);
  assert.doesNotMatch(serialized, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.equal(frozenRun.sanitization.privateIdentifiersRemoved, true);
});

test('wrong session, nonce, run, cursor, duplicate identity, and non-event text are rejected', () => {
  const base = {
    sessionKey: originChild,
    runId: originReturnRunId,
    messageSeq: 3,
    message: {
      role: 'assistant',
      timestamp: 3000,
      content: [{
        type: 'text',
        text: `Continuation completed with result: ${returnSentinel}`,
      }],
      __openclaw: { runId: originReturnRunId, seq: 3 },
    },
  };
  const variants = [
    { ...base, sessionKey: 'agent:main:unrelated' },
    { ...base, message: { ...base.message, content: [{ type: 'text', text: `[k6-proof-harness] ${returnSentinel}` }] } },
    { ...base, message: { ...base.message, content: [{ type: 'text', text: 'Continuation completed with result: RCDT-RETURN-wrong' }] } },
    { ...base, runId: 'wrong-run', message: { ...base.message, __openclaw: { runId: 'wrong-run', seq: 3 } } },
    { ...base, message: { ...base.message, __openclaw: { runId: 'conflicting-run', seq: 3 } } },
    { ...base, messageSeq: 2, message: { ...base.message, __openclaw: { runId: originReturnRunId, seq: 2 } } },
    { ...base, message: { ...base.message, timestamp: 500 } },
  ];
  for (const event of variants) {
    assert.equal(parseTokenReturnEvent(event, {
      expectedTargetSessionKey: originChild,
      expectedDelegateChildSessionKey: delegateChild,
      expectedDelegateRunId: delegateRunId,
      expectedSentinel: returnSentinel,
      originCursor: 2,
      subscriptionAcceptedAtMs: 1000,
      observedAtMs: 3010,
      hash,
    }), null);
  }
  assert.equal(parseTokenReturnEvent({
    log: `Continuation completed with result: ${returnSentinel}`,
  }, {
    expectedTargetSessionKey: originChild,
    expectedDelegateChildSessionKey: delegateChild,
    expectedDelegateRunId: delegateRunId,
    expectedSentinel: returnSentinel,
    originCursor: 2,
    subscriptionAcceptedAtMs: 1000,
    observedAtMs: 3010,
    hash,
  }), null);
  for (const originCursor of [null, '2']) {
    assert.equal(parseTokenReturnEvent(base, {
      expectedTargetSessionKey: originChild,
      expectedDelegateChildSessionKey: delegateChild,
      expectedDelegateRunId: delegateRunId,
      expectedSentinel: returnSentinel,
      originCursor,
      subscriptionAcceptedAtMs: 1000,
      observedAtMs: 3010,
      hash,
    }), null);
  }
});

test('duplicate, root-only, log-only, and missing-public-event evidence cannot PASS', () => {
  for (const overrides of [
    { origin_return_event_count: 2 },
    {
      delegate_return_observed: false,
      origin_return_event_count: 0,
      return_target_session_hash: hash(parentSessionKey),
    },
    {
      delegate_return_observed: false,
      origin_return_event_count: 0,
      terminal_reason: `log-only ${returnSentinel}`,
    },
    {
      delegate_return_observed: false,
      origin_return_event_count: 0,
      origin_return_run_id_hash: null,
    },
  ]) {
    assert.equal(classifyTokenEvidence(completeEvidence(overrides)), 'PARTIAL-candidate');
  }
});

test('task-list rejection is recorded fail-closed', () => {
  const ledger = createTokenLedger({ surfaceClass: 'raw-final-text' });
  rejectTokenTaskLedgerObservation(ledger);
  const summary = summarizeTokenLedger(ledger);
  assert.equal(summary.tasks_list_rejected, 1);
  assert.equal(summary.task_pagination_exhausted, false);
});
