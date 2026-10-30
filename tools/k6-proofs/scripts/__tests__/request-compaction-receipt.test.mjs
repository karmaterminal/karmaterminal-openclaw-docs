import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRequestCompactionReceipt,
  classifyRrc1Evidence,
  compactionStreamSignal,
  effectiveToolNames,
  eventNamesSession,
  findRequestCompactionReceipt,
  hasEffectiveTool,
  isLiveContextGuardRejection,
  newCompactionMarkerCount,
  requestCompactionToolCallIdForNonce,
} from '../../lib/request-compaction-receipt.js';

test('reads request_compaction from the effective tool inventory', () => {
  const payload = {
    groups: [
      { id: 'core', tools: [{ id: 'exec' }, { id: 'request_compaction' }] },
      { id: 'plugins', tools: [{ name: 'message' }] },
    ],
  };
  assert.deepEqual(effectiveToolNames(payload), ['exec', 'request_compaction', 'message']);
  assert.equal(hasEffectiveTool(payload, 'request_compaction'), true);
  assert.equal(hasEffectiveTool(payload, 'continue_work'), false);
});

test('accepts only a structured below-threshold tool result', () => {
  const receipt = {
    status: 'rejected',
    guard: 'context_threshold',
    contextUsage: 3,
    threshold: 70,
    reason: 'below threshold',
  };
  const result = classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-rc1',
      content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }],
    },
  });
  assert.deepEqual(result, {
    kind: 'threshold_rejected',
    receipt,
    toolCallId: 'call-rc1',
  });
});

test('accepts details-backed structured receipts', () => {
  const receipt = { status: 'rejected', guard: 'context_threshold', threshold: 70 };
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      details: receipt,
      content: [],
    },
  }).kind, 'threshold_rejected');
});

test('bootstrap#1727: classifies a context_unmeasured rejection as unmeasured, not a threshold receipt', () => {
  const receipt = {
    status: 'rejected',
    guard: 'context_unmeasured',
    cause: 'no_fresh_usage',
    reason: 'Context usage has not been measured yet.',
  };
  assert.deepEqual(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-unmeasured',
      content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }],
    },
  }), {
    kind: 'unmeasured_rejected',
    receipt,
    toolCallId: 'call-unmeasured',
  });
});

test('bootstrap#1727: a live session passes on a live unmeasured cause, never on inventory_only', () => {
  const unmeasured = (cause) => ({ kind: 'unmeasured_rejected', receipt: { status: 'rejected', guard: 'context_unmeasured', cause } });
  assert.equal(isLiveContextGuardRejection(unmeasured('no_fresh_usage')), true);
  assert.equal(isLiveContextGuardRejection(unmeasured('unknown_context_window')), true);
  assert.equal(isLiveContextGuardRejection(unmeasured('inventory_only')), false);
  assert.equal(isLiveContextGuardRejection({ kind: 'non_threshold_result', receipt: { status: 'compaction_requested' } }), false);
});

// R-RC-1 PASS rule (manifests/r-rc-1.json telemetryContract.verdictAuthority.pass,
// approved by 🌊 at docs b37adbda). Receipt reasons are the product's own text at
// karmaterminal/openclaw 542d1cac46 (PR #1506), src/agents/tools/request-compaction-tool.ts:37-42,
// 259-276. 🍃's repro (frond-gloss breadcrumbs/receipts/rrc1-grader-repro-b37adbda.mjs)
// showed b37adbda passing a context_threshold rejection with no numbers, with
// inventory-only wording, and with usage above the threshold.
const RC1_REASONS = Object.freeze({
  below: 'Context usage (12%) is below the minimum threshold (70%). Compaction is not needed yet.',
  no_fresh_usage: 'Context usage has not been measured: this session has no fresh token totals from a completed model turn (as on its first turn, or when the provider reported no usage). request_compaction can check the 70% threshold only after a completed turn records them.',
  unknown_context_window: "Context usage cannot be measured: the context window of this session's model is unknown, so usage cannot be compared with the 70% threshold.",
  inventory_only: 'Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.',
});

function rc1Receipt(details) {
  return classifyRequestCompactionReceipt({
    message: { role: 'toolResult', toolName: 'request_compaction', toolCallId: 'call-rc1', details },
  });
}

test('R-RC-1 contract: a context_threshold rejection passes only when measured below the floor', () => {
  const threshold = (fields) => rc1Receipt({ status: 'rejected', guard: 'context_threshold', ...fields });
  assert.equal(isLiveContextGuardRejection(threshold({ contextUsage: 12, threshold: 70, reason: RC1_REASONS.below })), true);
  // No numbers: the pre-#1727 unknown branch, which never measured anything.
  assert.equal(isLiveContextGuardRejection(threshold({ reason: 'Compaction is not needed yet.' })), false);
  assert.equal(isLiveContextGuardRejection({ kind: 'threshold_rejected', receipt: { guard: 'context_threshold' } }), false);
  // One number without the other is not a measurement.
  assert.equal(isLiveContextGuardRejection(threshold({ threshold: 70, reason: RC1_REASONS.below })), false);
  assert.equal(isLiveContextGuardRejection(threshold({ contextUsage: 12, reason: RC1_REASONS.below })), false);
  // Usage at or above the threshold is not below the floor.
  assert.equal(isLiveContextGuardRejection(threshold({ contextUsage: 80, threshold: 70, reason: RC1_REASONS.below })), false);
  assert.equal(isLiveContextGuardRejection(threshold({ contextUsage: 70, threshold: 70, reason: RC1_REASONS.below })), false);
  // Numbers must be finite numbers, not strings.
  assert.equal(isLiveContextGuardRejection(threshold({ contextUsage: '12', threshold: '70', reason: RC1_REASONS.below })), false);
});

test('R-RC-1 contract: inventory-only wording is non-PASS in either form', () => {
  // 🍃's threshold_inventory_wording case, verbatim.
  assert.equal(isLiveContextGuardRejection(rc1Receipt({ status: 'rejected', guard: 'context_threshold', reason: RC1_REASONS.inventory_only })), false);
  // Measured numbers do not launder inventory-only wording.
  assert.equal(isLiveContextGuardRejection(rc1Receipt({
    status: 'rejected', guard: 'context_threshold', contextUsage: 12, threshold: 70, reason: RC1_REASONS.inventory_only,
  })), false);
  assert.equal(isLiveContextGuardRejection(rc1Receipt({
    status: 'rejected', guard: 'context_unmeasured', cause: 'inventory_only', reason: RC1_REASONS.inventory_only,
  })), false);
  // A live cause does not launder inventory-only wording either.
  assert.equal(isLiveContextGuardRejection(rc1Receipt({
    status: 'rejected', guard: 'context_unmeasured', cause: 'no_fresh_usage', reason: RC1_REASONS.inventory_only,
  })), false);
});

test('R-RC-1 contract: a context_unmeasured rejection passes only with a live cause and no usage numbers', () => {
  const unmeasured = (fields) => rc1Receipt({ status: 'rejected', guard: 'context_unmeasured', ...fields });
  assert.equal(isLiveContextGuardRejection(unmeasured({ cause: 'no_fresh_usage', reason: RC1_REASONS.no_fresh_usage })), true);
  assert.equal(isLiveContextGuardRejection(unmeasured({ cause: 'unknown_context_window', reason: RC1_REASONS.unknown_context_window })), true);
  assert.equal(isLiveContextGuardRejection(unmeasured({ reason: RC1_REASONS.no_fresh_usage })), false);
  assert.equal(isLiveContextGuardRejection(unmeasured({ cause: 'something_else', reason: RC1_REASONS.no_fresh_usage })), false);
  // Usage numbers contradict an unmeasured rejection.
  assert.equal(isLiveContextGuardRejection(unmeasured({
    cause: 'no_fresh_usage', contextUsage: 12, threshold: 70, reason: RC1_REASONS.no_fresh_usage,
  })), false);
});

test('R-RC-1 contract: only a rejected status counts', () => {
  assert.equal(isLiveContextGuardRejection(rc1Receipt({ status: 'compaction_requested', guard: 'context_threshold', contextUsage: 12, threshold: 70 })), false);
  assert.equal(isLiveContextGuardRejection(rc1Receipt({ status: 'rejected', guard: 'rate_limit', retryAfterSeconds: 30 })), false);
  assert.equal(isLiveContextGuardRejection(rc1Receipt({ status: 'already_pending', reason: 'in flight' })), false);
});

// Evidence as the R-RC-1 scenario writes it for a measured below-floor rejection
// with a completed side-effect window.
function rrc1PassEvidence(overrides = {}) {
  return {
    row: 'R-RC-1',
    tool_inventory_checked: true,
    tool_registered: true,
    dispatch_accepted: true,
    tool_result_observed: true,
    tool_call_nonce_bound: true,
    tool_invocation_observed: true,
    tool_result_status: 'rejected',
    guard: 'context_threshold',
    cause: null,
    context_usage: 12,
    threshold: 70,
    usage_fields_present: true,
    inventory_only_wording: false,
    no_compaction_side_effect: true,
    side_effect: {
      window_ms: 30000,
      baseline_read: true,
      turn_end_observed: true,
      window_elapsed: true,
      final_read: true,
      new_compaction_markers: 0,
      stream_compaction_signals: 0,
    },
    ...overrides,
  };
}

test('classifyRrc1Evidence: PASS only on a contract rejection with a completed side-effect window', () => {
  assert.deepEqual(classifyRrc1Evidence(rrc1PassEvidence()), { verdict: 'PASS-candidate', reason: null, shape: 'measured_below_threshold' });
  assert.equal(classifyRrc1Evidence(rrc1PassEvidence({
    guard: 'context_unmeasured', cause: 'no_fresh_usage', context_usage: null, threshold: null, usage_fields_present: false,
  })).verdict, 'PASS-candidate');
  const partial = (overrides) => classifyRrc1Evidence(rrc1PassEvidence(overrides));
  assert.equal(partial({ row: 'R-RC-2' }).verdict, 'PARTIAL-candidate');
  assert.equal(partial({ tool_registered: false }).verdict, 'PARTIAL-candidate');
  assert.equal(partial({ dispatch_accepted: false }).verdict, 'PARTIAL-candidate');
  assert.equal(partial({ tool_call_nonce_bound: false }).verdict, 'PARTIAL-candidate');
  assert.match(partial({ context_usage: 70 }).reason, /usage 70 is not below threshold 70/u);
  assert.match(partial({ context_usage: null }).reason, /without a measured contextUsage and threshold/u);
  assert.match(partial({ inventory_only_wording: true }).reason, /inventory-only wording/u);
  assert.match(partial({ no_compaction_side_effect: false }).reason, /a compaction followed the rejection/u);
  assert.match(partial({ no_compaction_side_effect: null, side_effect: { unproven_reason: 'the turn did not end before the socket closed' } }).reason,
    /unproven: the turn did not end/u);
});

test('classifyRrc1Evidence: facts that were not recorded fail closed', () => {
  // Evidence written before this rule existed cannot pass by omission.
  const { inventory_only_wording: _wording, ...noWording } = rrc1PassEvidence();
  assert.match(classifyRrc1Evidence(noWording).reason, /not checked for inventory-only/u);
  const unmeasured = rrc1PassEvidence({ guard: 'context_unmeasured', cause: 'no_fresh_usage', context_usage: null, threshold: null });
  delete unmeasured.usage_fields_present;
  assert.match(classifyRrc1Evidence(unmeasured).reason, /not checked for usage numbers/u);
  const { side_effect: _window, ...noWindow } = rrc1PassEvidence();
  assert.equal(classifyRrc1Evidence(noWindow).verdict, 'PARTIAL-candidate');
  // A true side-effect flag needs the window that produced it.
  for (const key of ['baseline_read', 'turn_end_observed', 'window_elapsed', 'final_read']) {
    const evidence = rrc1PassEvidence();
    evidence.side_effect[key] = false;
    assert.match(classifyRrc1Evidence(evidence).reason, /claimed, but its baseline read, turn end, window or final read/u, key);
  }
  const sawOne = rrc1PassEvidence();
  sawOne.side_effect.new_compaction_markers = 1;
  assert.equal(classifyRrc1Evidence(sawOne).verdict, 'PARTIAL-candidate');
});

test('newCompactionMarkerCount counts compaction rows not in the baseline; an id-less row always counts', () => {
  const row = (id) => ({ role: 'system', content: [{ type: 'text', text: 'Compaction' }], __openclaw: { kind: 'compaction', ...(id ? { id } : {}) } });
  const reset = { role: 'system', content: [{ type: 'text', text: 'Reset' }], __openclaw: { kind: 'reset', id: 'r-1' } };
  assert.equal(newCompactionMarkerCount([], [reset, { role: 'assistant', content: 'Compaction' }]), 0);
  assert.equal(newCompactionMarkerCount([], [row('c-1')]), 1);
  assert.equal(newCompactionMarkerCount([row('c-1')], [row('c-1')]), 0);
  assert.equal(newCompactionMarkerCount([row('c-1')], [row('c-1'), row('c-2')]), 1);
  assert.equal(newCompactionMarkerCount([row(null)], [row(null)]), 1);
});

test('compactionStreamSignal: agent compaction events and compaction rows; another session is not this one', () => {
  const key = 'agent:main:r-rc-1-n';
  assert.deepEqual(compactionStreamSignal({ stream: 'compaction', sessionKey: key, data: { phase: 'start' } }, key), { source: 'agent-compaction-event', phase: 'start' });
  assert.deepEqual(compactionStreamSignal({ stream: 'compaction', sessionKey: 'r-rc-1-n', data: { phase: 'end' } }, key), { source: 'agent-compaction-event', phase: 'end' });
  assert.deepEqual(compactionStreamSignal({ stream: 'compaction', data: {} }, key), { source: 'agent-compaction-event', phase: null });
  assert.equal(compactionStreamSignal({ stream: 'compaction', sessionKey: 'agent:main:other', data: { phase: 'start' } }, key), null);
  assert.deepEqual(compactionStreamSignal({ sessionKey: key, message: { role: 'system', __openclaw: { kind: 'compaction', id: 'c' } } }, key),
    { source: 'session-message-compaction-row', phase: null });
  assert.equal(compactionStreamSignal({ stream: 'lifecycle', sessionKey: key, data: { phase: 'end' } }, key), null);
  assert.equal(compactionStreamSignal(null, key), null);
});

test('eventNamesSession matches only an event that names this session', () => {
  const key = 'agent:main:r-rc-1-n';
  assert.equal(eventNamesSession({ sessionKey: key }, key), true);
  assert.equal(eventNamesSession({ sessionKey: 'R-RC-1-N' }, key), true);
  assert.equal(eventNamesSession({ sessionKey: 'agent:main:other' }, key), false);
  assert.equal(eventNamesSession({}, key), false);
  assert.equal(eventNamesSession({ sessionKey: '' }, key), false);
  assert.equal(eventNamesSession({ sessionKey: key }, ''), false);
});

test('does not accept assistant sentinel prose as a tool receipt', () => {
  assert.deepEqual(classifyRequestCompactionReceipt({
    message: { role: 'assistant', content: [{ type: 'text', text: 'RC1-REJECTED' }] },
  }), { kind: 'unrelated' });
});

test('finds only the receipt bound to the current nonce-bearing tool call', () => {
  const rowNonce = 'R-RC-1-current-nonce';
  const receipt = { status: 'rejected', guard: 'context_threshold' };
  const result = findRequestCompactionReceipt([
    { role: 'user', content: 'invoke it' },
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-history',
        name: 'request_compaction',
        arguments: { reason: `proof ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-history',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    { role: 'assistant', content: 'RC1-RESULT-OBSERVED' },
  ], { rowNonce });
  assert.deepEqual(result, {
    kind: 'threshold_rejected',
    receipt,
    toolCallId: 'call-history',
    nonceBound: true,
  });
});

test('extracts the current request_compaction tool-call id from its nonce-bearing arguments', () => {
  assert.equal(requestCompactionToolCallIdForNonce([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-current',
        name: 'request_compaction',
        arguments: JSON.stringify({ reason: 'proof R-RC-1-current' }),
      }],
    },
  ], 'R-RC-1-current'), 'call-current');
});

test('rejects a prior valid result when the current nonce has no matching tool call/result', () => {
  const priorReceipt = { status: 'rejected', guard: 'context_threshold' };
  assert.deepEqual(findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-prior',
        name: 'request_compaction',
        arguments: { reason: 'proof R-RC-1-prior' },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-prior',
      content: [{ type: 'text', text: JSON.stringify(priorReceipt) }],
    },
    { role: 'user', content: 'new proof R-RC-1-current' },
    { role: 'assistant', content: 'RC1-RESULT-OBSERVED R-RC-1-current' },
  ], { rowNonce: 'R-RC-1-current' }), { kind: 'missing' });
});

test('ignores a newer unrelated result and returns the result linked to the current call id', () => {
  const receipt = { status: 'rejected', guard: 'context_threshold' };
  const result = findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-current',
        name: 'request_compaction',
        arguments: { reason: 'proof R-RC-1-current' },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-current',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-stale',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
  ], { rowNonce: 'R-RC-1-current' });
  assert.equal(result.toolCallId, 'call-current');
  assert.equal(result.nonceBound, true);
});

test('fails closed when the current nonce appears in two distinct request_compaction invocations', () => {
  const rowNonce = 'R-RC-1-current';
  const receipt = { status: 'rejected', guard: 'context_threshold' };
  assert.deepEqual(findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-first',
        name: 'request_compaction',
        arguments: { reason: `proof ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-first',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-second',
        name: 'request_compaction',
        arguments: { reason: `retry ${rowNonce}` },
      }],
    },
  ], { rowNonce }), { kind: 'missing' });
});

test('fails closed when a repeated current-nonce invocation has a non-threshold result', () => {
  const rowNonce = 'R-RC-1-current';
  assert.deepEqual(findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-first',
        name: 'request_compaction',
        arguments: { reason: `proof ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-first',
      content: [{ type: 'text', text: JSON.stringify({ status: 'rejected', guard: 'context_threshold' }) }],
    },
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-second',
        name: 'request_compaction',
        arguments: { reason: `retry ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-second',
      content: [{ type: 'text', text: JSON.stringify({ status: 'compaction_requested' }) }],
    },
  ], { rowNonce }), { kind: 'missing' });
});

test('accepts duplicate transcript copies of the same current invocation id', () => {
  const rowNonce = 'R-RC-1-current';
  const call = {
    type: 'toolCall',
    id: 'call-current',
    name: 'request_compaction',
    arguments: { reason: `proof ${rowNonce}` },
  };
  const receipt = { status: 'rejected', guard: 'context_threshold' };
  const result = findRequestCompactionReceipt([
    { role: 'assistant', content: [call] },
    { role: 'assistant', content: [{ ...call }] },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-current',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
  ], { rowNonce });
  assert.equal(result.kind, 'threshold_rejected');
  assert.equal(result.toolCallId, 'call-current');
});

test('fails closed on accepted, wrong-guard, and unstructured tool results', () => {
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      content: [{ type: 'text', text: JSON.stringify({ status: 'compaction_requested' }) }],
    },
  }).kind, 'non_threshold_result');

  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      content: [{ type: 'text', text: JSON.stringify({ status: 'rejected', guard: 'rate_limit' }) }],
    },
  }).kind, 'non_threshold_result');

  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      content: [{ type: 'text', text: 'not-json' }],
    },
  }).kind, 'invalid');
});
