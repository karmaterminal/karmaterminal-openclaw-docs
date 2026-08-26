import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R_CD_CHAIN_TASK_LEDGER_SCHEMA,
  rCdChainObservationState,
  rCdChainRootAckObserved,
  rCdChainRootLifecycleStart,
  rCdChainRootReturnAcceptance,
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
  rCdChainTaskListPage,
  rCdChainTaskLedgerReceipt,
  rCdChainTaskSnapshotDelay,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

const nonce = 'R-CD-CHAIN-EXACT-NONCE';
const root = 'agent:main:r-cd-chain-root';
const child = 'agent:main:subagent:child';
const grandchild = 'agent:main:subagent:grandchild';
const dispatchRunId = 'dispatch-run';
const consumptionRunId = 'post-return-run';
const dispatchAcceptedAtMs = 100;

function chainTasks() {
  return [
    {
      id: 'task-child',
      taskId: 'task-child',
      runId: 'run-child',
      sessionKey: root,
      childSessionKey: child,
      title: '[continuation:chain-hop:1] Delegated task (turn 1/200): Proof chain nonce'.slice(0, 80),
      prompt: `Proof chain nonce ${nonce}: depth-1`,
      status: 'completed',
      deliveryStatus: 'delivered',
      createdAt: 110,
      endedAt: 200,
      lastToolName: 'continue_work',
      progressSummary:
        `CHILD-WAITING ${nonce} CHILD-DELEGATE-SCHEDULED CHILD-WAKE-SCHEDULED`,
    },
    {
      id: 'task-grandchild',
      taskId: 'task-grandchild',
      runId: 'run-grandchild',
      sessionKey: child,
      childSessionKey: grandchild,
      title: '[continuation:chain-hop:2] Delegated task (turn 1/200): Grandchild nonce'.slice(0, 80),
      prompt: `Grandchild nonce ${nonce}: depth-2`,
      status: 'completed',
      deliveryStatus: 'delivered',
      createdAt: 210,
      endedAt: 250,
      progressSummary: `GRANDCHILD-DONE ${nonce}`,
    },
  ];
}

function lifecycleEvent(phase, overrides = {}) {
  return {
    sessionKey: root,
    runId: consumptionRunId,
    stream: 'lifecycle',
    data: { phase, status: phase === 'end' ? 'ok' : 'running' },
    ...overrides,
  };
}

function toolCallEvent(overrides = {}) {
  const input = {
    outcome: 'continue',
    notify: false,
    summary: 'Structured root completion receipt',
    reason: `GRANDCHILD-DONE ${nonce}`,
    scratch: `CHILD-DONE ${nonce} CHILD-SAW-GRANDCHILD`,
  };
  return {
    sessionKey: root,
    runId: consumptionRunId,
    messageSeq: 10,
    message: {
      role: 'assistant',
      stopReason: 'toolUse',
      timestamp: 300,
      content: [{
        type: 'toolCall',
        id: 'heartbeat-call',
        name: 'heartbeat_respond',
        arguments: input,
        input: { ...input },
      }],
      __openclaw: { runId: consumptionRunId },
    },
    ...overrides,
  };
}

function toolResultEvent(overrides = {}) {
  return {
    sessionKey: root,
    runId: consumptionRunId,
    messageSeq: 11,
    message: {
      role: 'toolResult',
      toolCallId: 'heartbeat-call',
      toolName: 'heartbeat_respond',
      timestamp: 301,
      content: [{
        type: 'toolResult',
        toolCallId: 'heartbeat-call',
        toolName: 'heartbeat_respond',
        content: JSON.stringify({
          status: 'accepted',
          outcome: 'continue',
          notify: false,
          summary: 'Structured root completion receipt',
          reason: `GRANDCHILD-DONE ${nonce}`,
        }),
      }],
      __openclaw: { runId: consumptionRunId },
    },
    ...overrides,
  };
}

function assistantEvent(text, overrides = {}) {
  return {
    sessionKey: root,
    runId: consumptionRunId,
    messageSeq: 12,
    message: {
      role: 'assistant',
      stopReason: 'stop',
      timestamp: 302,
      content: [{ type: 'text', text }],
      __openclaw: { runId: consumptionRunId, runTerminal: true },
    },
    ...overrides,
  };
}

function taskReceipt(tasks = chainTasks()) {
  return rCdChainTaskLedgerReceipt(tasks, {
    rootSessionKey: root,
    nonce,
    dispatchAcceptedAtMs,
  });
}

function lifecycleStart(ledger = taskReceipt()) {
  return rCdChainRootLifecycleStart({
    eventName: 'agent',
    eventData: lifecycleEvent('start'),
    rootSessionKey: root,
    taskLedgerReceipt: ledger,
    dispatchRunId,
    observedAtMs: 260,
  });
}

function consumptionCandidate(eventData = toolCallEvent(), ledger = taskReceipt()) {
  const start = lifecycleStart(ledger);
  return rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData,
    rootSessionKey: root,
    nonce,
    taskLedgerReceipt: ledger,
    dispatchRunId,
    lifecycleRunId: start?.runId,
    lifecycleStartedAtMs: start?.startedAtMs,
    observedAtMs: 300,
  });
}

function consumptionAcceptance(
  candidate = consumptionCandidate(),
  eventData = toolResultEvent(),
) {
  return rCdChainRootReturnAcceptance(candidate, {
    eventName: 'session.message',
    eventData,
    observedAtMs: 301,
  });
}

function consumptionReceipt({
  acceptance = consumptionAcceptance(),
  eventData = lifecycleEvent('end'),
  assistantSentinelObserved = false,
} = {}) {
  return rCdChainRootReturnReceipt(acceptance, {
    childSessionKey: child,
    grandchildSessionKey: grandchild,
    eventName: 'agent',
    eventData,
    observedAtMs: 302,
    assistantSentinelObserved,
  });
}

test('depth-2 task ledger binds exactly one delivered root-child-grandchild chain', () => {
  assert.deepEqual(taskReceipt(), {
    schema: R_CD_CHAIN_TASK_LEDGER_SCHEMA,
    nonce,
    rootSessionKey: root,
    childSessionKey: child,
    grandchildSessionKey: grandchild,
    taskIds: ['task-child', 'task-grandchild'],
    runIds: ['run-child', 'run-grandchild'],
    taskCount: 2,
    completedTaskCount: 2,
    deliveredTaskCount: 2,
    maxDepth: 2,
    recoveryWakeScheduled: true,
    dispatchAcceptedAtMs,
    completedAtMs: 250,
  });
});

test('depth-2 task pagination exhausts every page and rejects repeats', () => {
    const first = rCdChainTaskListPage(null, {
      tasks: [chainTasks()[0]],
      nextCursor: '1',
    });
    assert.equal(first.ok, true);
    assert.equal(first.complete, false);
    assert.equal(first.nextCursor, '1');
    const complete = rCdChainTaskListPage(first.state, {
      tasks: [chainTasks()[1]],
    });
    assert.equal(complete.ok, true);
    assert.equal(complete.complete, true);
    assert.equal(complete.state.tasks.length, 2);
    assert.equal(rCdChainTaskListPage(first.state, {
      tasks: [],
      nextCursor: '1',
    }).reason, 'invalid-or-repeated-cursor');
    assert.equal(rCdChainTaskListPage(first.state, {
      tasks: [chainTasks()[0]],
    }).reason, 'duplicate-or-invalid-task-id');
});

test('depth-2 task snapshots rearm until the descendant deadline', () => {
    assert.equal(rCdChainTaskSnapshotDelay({
      now: 120_000,
      dispatchAcceptedAt: 0,
      descendantTimeoutMs: 180_000,
      requestedDelayMs: 5_000,
      hasLedgerReceipt: false,
      snapshotInFlight: false,
      pollPending: false,
    }), 5_000);
    assert.equal(rCdChainTaskSnapshotDelay({
      now: 179_000,
      dispatchAcceptedAt: 0,
      descendantTimeoutMs: 180_000,
      requestedDelayMs: 5_000,
      hasLedgerReceipt: false,
      snapshotInFlight: false,
      pollPending: false,
    }), 1_000);
    assert.equal(rCdChainTaskSnapshotDelay({
      now: 180_000,
      dispatchAcceptedAt: 0,
      descendantTimeoutMs: 180_000,
      requestedDelayMs: 5_000,
      hasLedgerReceipt: false,
      snapshotInFlight: false,
      pollPending: false,
    }), null);
});

test('depth-2 chain accepts a structured post-return model run without a prose ACK', () => {
  const receipt = consumptionReceipt();

  assert.equal(receipt.authority, 'structured-post-return-consumption');
  assert.equal(receipt.consumptionRunId, consumptionRunId);
  assert.equal(receipt.assistantSentinelObserved, false);
  assert.deepEqual(receipt.taskIds, ['task-child', 'task-grandchild']);
});

test('depth-2 chain keeps an exact assistant ACK as supplemental evidence', () => {
  assert.equal(rCdChainRootAckObserved({
    eventName: 'session.message',
    eventData: assistantEvent(`ROOT-CHAIN-ACK ${nonce}`),
    rootSessionKey: root,
    nonce,
    lifecycleRunId: consumptionRunId,
  }), true);
  const receipt = consumptionReceipt({ assistantSentinelObserved: true });
  assert.equal(receipt.assistantSentinelObserved, true);
});

test('depth-2 chain rejects phrase-only ACK and descendant assistant output', () => {
  for (const eventData of [
    assistantEvent(`ROOT-CHAIN-ACK ${nonce}`),
    assistantEvent(`GRANDCHILD-DONE ${nonce}`),
  ]) {
    assert.equal(rCdChainRootReturnCandidate({
      eventName: 'session.message',
      eventData,
      rootSessionKey: root,
      nonce,
      taskLedgerReceipt: taskReceipt(),
      dispatchRunId,
      lifecycleRunId: consumptionRunId,
      lifecycleStartedAtMs: 260,
      observedAtMs: 301,
    }), null);
  }
});

test('depth-2 chain rejects prompt echoes, wrong tools, and non-root delivery', () => {
  const promptEcho = toolCallEvent();
  promptEcho.message.content[0].arguments.scratch =
    `[k6-proof-harness] CHILD-DONE ${nonce} CHILD-SAW-GRANDCHILD`;
  promptEcho.message.content[0].input.scratch =
    promptEcho.message.content[0].arguments.scratch;
  const wrongTool = toolCallEvent();
  wrongTool.message.content[0].name = 'continue_delegate';
  const childOnly = toolCallEvent({ sessionKey: child });
  for (const eventData of [promptEcho, wrongTool, childOnly]) {
    assert.equal(consumptionCandidate(eventData), null);
  }

  const rejected = toolResultEvent();
  rejected.message.content[0].content = rejected.message.content[0].content.replace(
    '"accepted"',
    '"rejected"',
  );
  assert.equal(consumptionAcceptance(consumptionCandidate(), rejected), null);
});

test('depth-2 chain rejects old lost-ancestry and one-return task ledgers', () => {
  assert.equal(taskReceipt(chainTasks().slice(0, 1)), null);
  const missingChildDelivery = chainTasks();
  missingChildDelivery[0].deliveryStatus = 'pending';
  assert.equal(taskReceipt(missingChildDelivery), null);
  const missingGrandchildDelivery = chainTasks();
  missingGrandchildDelivery[1].deliveryStatus = 'failed';
  assert.equal(taskReceipt(missingGrandchildDelivery), null);
});

test('depth-2 chain rejects duplicate tasks, duplicate runs, and duplicate return markers', () => {
  assert.equal(taskReceipt([...chainTasks(), { ...chainTasks()[1], id: 'third', taskId: 'third' }]), null);
  const duplicateRun = chainTasks();
  duplicateRun[1].runId = duplicateRun[0].runId;
  assert.equal(taskReceipt(duplicateRun), null);
  const duplicateTaskMarker = chainTasks();
  duplicateTaskMarker[1].progressSummary += ` GRANDCHILD-DONE ${nonce}`;
  assert.equal(taskReceipt(duplicateTaskMarker), null);
  const duplicatePromptNonce = chainTasks();
  duplicatePromptNonce[0].prompt += ` ${nonce}`;
  assert.equal(taskReceipt(duplicatePromptNonce), null);
  const duplicateMarker = toolCallEvent();
  duplicateMarker.message.content[0].arguments.reason +=
    ` CHILD-DONE ${nonce} CHILD-SAW-GRANDCHILD`;
  duplicateMarker.message.content[0].input.reason =
    duplicateMarker.message.content[0].arguments.reason;
  assert.equal(consumptionCandidate(duplicateMarker), null);
});

test('depth-2 chain rejects stale, wrong-nonce, and wrong-depth records', () => {
  const stale = chainTasks();
  stale[1].title = 'Grandchild nonce from a previous proof';
  stale[1].prompt = 'Grandchild nonce from a previous proof';
  stale[1].metadata = { nonce };
  assert.equal(taskReceipt(stale), null);

  const wrongDepth = chainTasks();
  wrongDepth[1].sessionKey = root;
  assert.equal(taskReceipt(wrongDepth), null);

  const collapsedIdentity = chainTasks();
  collapsedIdentity[1].childSessionKey = child;
  assert.equal(taskReceipt(collapsedIdentity), null);

  const earlyConsumption = toolCallEvent();
  earlyConsumption.message.timestamp = 249;
  assert.equal(consumptionCandidate(earlyConsumption), null);

  const preexisting = chainTasks();
  preexisting[0].createdAt = dispatchAcceptedAtMs - 1;
  assert.equal(taskReceipt(preexisting), null);
});

test('depth-2 chain requires accepted input and a successful same-run lifecycle end', () => {
  const acceptance = consumptionAcceptance();
  const wrongRun = lifecycleEvent('end');
  wrongRun.runId = 'other-run';
  assert.equal(consumptionReceipt({ acceptance, eventData: wrongRun }), null);

  const failed = lifecycleEvent('end', { data: { phase: 'end', status: 'failed' } });
  assert.equal(consumptionReceipt({ acceptance, eventData: failed }), null);

  assert.equal(rCdChainRootReturnReceipt(acceptance, {
    childSessionKey: child,
    grandchildSessionKey: grandchild,
  }), null);
});

test('depth-2 chain gives root return a fresh post-grandchild observation window', () => {
  const dispatchAcceptedAt = 1_000;
  const grandchildObservedAt = 149_000;
  const waiting = rCdChainObservationState({
    now: 150_001,
    dispatchAcceptedAt,
    grandchildObservedAt,
    rootReturnReceipt: null,
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  });
  assert.deepEqual(waiting, {
    phase: 'awaiting-root-return',
    deadlineAtMs: 269_000,
    timedOut: false,
  });
  assert.equal(rCdChainObservationState({
    now: 269_000,
    dispatchAcceptedAt,
    grandchildObservedAt,
    rootReturnReceipt: null,
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  }).phase, 'root-return-timeout');
});

test('depth-2 chain distinguishes descendant timeout, root timeout, and recovery', () => {
  assert.equal(rCdChainObservationState({
    now: 151_000,
    dispatchAcceptedAt: 1_000,
    grandchildObservedAt: null,
    rootReturnReceipt: null,
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  }).phase, 'descendant-timeout');
  assert.equal(rCdChainObservationState({
    now: 200_000,
    dispatchAcceptedAt: 1_000,
    grandchildObservedAt: 50_000,
    rootReturnReceipt: { authority: 'structured-post-return-consumption' },
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  }).phase, 'complete');
});
