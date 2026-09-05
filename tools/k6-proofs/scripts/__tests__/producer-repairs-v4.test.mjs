import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildProducerRegistry, resolveProducerPlan } from '../../lib/producer-catalog.mjs';
import {
  DEPENDENCY_RECEIPT_SCHEMA, PROCESS_RECEIPT_SCHEMA, PROCESS_REQUIRED_CHECKS,
  REQUIRED_PRODUCT_SHA, sha256, signProducerReceipt, validateProcessReceipt,
} from '../../lib/producer-receipt.mjs';
import { collectionTerminalComplete, requestedTokenObserved } from '../../lib/producer-live-harness.js';
import { publishArtifacts } from '../../lib/atomic-artifacts.mjs';
import { processTerminalValid } from '../../lib/process-terminal-authority.mjs';
import { validateLineage } from '../collect-live-producer-lineage.mjs';
import { sanitizeEvidenceRecords, sanitizeServiceLog } from '../sanitize-k6-artifacts.mjs';
import { buildHarnessCheckout } from './helpers/harness-checkout.mjs';

const proofsDir = fileURLToPath(new URL('../..', import.meta.url));
const repoRoot = path.resolve(proofsDir, '../..');
const docsSha = 'b'.repeat(40);
const runId = 'matrix-v4';
const key = 'test-observer-key-not-a-production-secret';
const nowMs = Date.parse('2026-09-05T18:00:00.000Z');
const registry = buildProducerRegistry({ proofsDir });
const clone = (value) => structuredClone(value);
const manifest = (name) => readFile(path.join(proofsDir, 'manifests', `${name}.json`), 'utf8').then(JSON.parse);
const cli = (name, args, env = {}) => spawnSync(process.execPath,
  [path.join(proofsDir, 'scripts', name), ...args], {
    encoding: 'utf8', env: { ...process.env, ...env }, timeout: 90000,
  });
async function workspace(fn) {
  const dir = path.join(repoRoot, '.repair-test-work', randomUUID());
  await mkdir(dir, { recursive: true });
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
function body(rowId, schema = DEPENDENCY_RECEIPT_SCHEMA) {
  return {
    schema, issuer: 'trusted-observer', rowId, verdict: 'PASS',
    receiptId: `receipt-${rowId}`, candidateSha: REQUIRED_PRODUCT_SHA,
    runtimeSha: REQUIRED_PRODUCT_SHA, docsSha, runId,
    issuedAt: new Date(nowMs - 1000).toISOString(),
    expiresAt: new Date(nowMs + 60000).toISOString(),
    producerEvidenceId: `evidence-${rowId}`,
    artifactDigests: { 'evidence.json': 'c'.repeat(64) },
  };
}
const bindings = { candidateSha: REQUIRED_PRODUCT_SHA, docsSha, runId,
  nowMs, trustedIssuers: { 'trusted-observer': key } };
function plan(receipts, extra = {}) {
  return resolveProducerPlan({ selection: 'R-CD-RETURN-COVENANT-AUTHORITY',
    registry, receipts, ...bindings, ...extra });
}

test('signed dependency receipt authority rejects the exact forged same-row same-SHA eight-object bundle', () => {
  const rows = ['R-CD-RETURN-COVENANT-AUTHORITY', 'R-CD-RETURN-OVERLAP', 'R-OBS-2',
    'R-CD-COLLECTION-ON-COLLAPSE', 'R-CW-7', 'R-CW-DELEGATE-CHILD-LIVE',
    'R-CW-DELEGATE-TOKEN', 'R-CW-MULTI'];
  const forged = rows.map((rowId) => ({ rowId, verdict: 'PASS', fresh: true, consumed: false,
    candidateSha: REQUIRED_PRODUCT_SHA, docsSha,
    issuedAt: new Date(nowMs - 1000).toISOString(), expiresAt: new Date(nowMs + 60000).toISOString() }));
  const result = plan(forged, { selection: rows.join(',') });
  assert.equal(result.ok, false);
  assert.equal(result.blocked.length, 3);
  assert.ok(result.rows.every((row) => !row.ownReceiptSatisfied));
  assert.equal(plan([signProducerReceipt(body(rows[0]), key)]).ok, true);
  const signed = rows.map((row) => signProducerReceipt(body(row), key));
  assert.equal(plan(signed, { selection: rows.join(',') }).ok, true);
});

test('dependency authority rejects missing, malformed, unknown issuer, altered fields, stale and duplicate receipts', () => {
  const receipt = signProducerReceipt(body('R-CD-RETURN-COVENANT-AUTHORITY'), key);
  assert.equal(plan([]).ok, false);
  for (const hostile of [null, [], {}, body(receipt.rowId),
    { ...receipt, issuer: 'untrusted' }, { ...receipt, rowId: 'R-CD-RETURN-OVERLAP' },
    { ...receipt, verdict: 'PASS-candidate' }, { ...receipt, candidateSha: 'd'.repeat(40) },
    { ...receipt, runtimeSha: 'd'.repeat(40) }, { ...receipt, docsSha: 'd'.repeat(40) },
    { ...receipt, runId: 'another-run' }, { ...receipt, artifactDigests: {} },
    { ...receipt, producerEvidenceId: 'other' },
    { ...receipt, integrity: { algorithm: 'none', signature: '0'.repeat(64) } },
    signProducerReceipt({ ...body(receipt.rowId), expiresAt: new Date(nowMs).toISOString() }, key),
    signProducerReceipt({ ...body(receipt.rowId), issuedAt: new Date(nowMs + 1).toISOString() }, key),
    signProducerReceipt({ ...body(receipt.rowId), consumed: true }, key),
  ]) assert.equal(plan([hostile]).ok, false, JSON.stringify(hostile));
  assert.equal(plan([receipt, receipt]).ok, false);
  assert.equal(plan([receipt], { runId: 'another-run' }).ok, false);
  assert.equal(plan([receipt], { trustedIssuers: { 'trusted-observer': 'wrong-key' } }).ok, false);
});

test('dependency CLI consumes signatures once and rejects replay across invocations', async () => workspace(async (dir) => {
  const receipt = signProducerReceipt({ ...body('R-CD-RETURN-COVENANT-AUTHORITY'),
    issuedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString() }, key);
  await writeFile(path.join(dir, 'receipts.json'), JSON.stringify([receipt]));
  await writeFile(path.join(dir, 'trust.json'), JSON.stringify(bindings.trustedIssuers));
  const args = ['--selection', receipt.rowId, '--candidate-sha', REQUIRED_PRODUCT_SHA,
    '--docs-sha', docsSha, '--run-id', runId, '--receipts', path.join(dir, 'receipts.json')];
  const env = {
    OPENCLAW_PRODUCER_TRUST_FILE: path.join(dir, 'trust.json'),
    OPENCLAW_PRODUCER_RECEIPT_STORE: path.join(dir, 'durable-consumption-store'),
  };
  assert.equal(cli('resolve-producer-plan.mjs', args, env).status, 0);
  assert.notEqual(cli('resolve-producer-plan.mjs', args, env).status, 0);
}));

function addTrace(flow, wake, index, traces) {
  const traceId = String(index + 1).repeat(32);
  const parent = 'a'.repeat(16);
  const attrs = { 'chain.id': `chain-${index}`, 'delay.ms': String(flow.stateJson.delayMs),
    ...(flow.stateJson.reason ? { 'reason.hash': sha256(flow.stateJson.reason).slice(0, 16) } : {}) };
  flow.stateJson.chainId = attrs['chain.id'];
  flow.stateJson.traceparent = `00-${traceId}-${parent}-01`;
  const attributes = (record) => Object.entries(record).map(([key, stringValue]) => ({ key, value: { stringValue } }));
  traces[traceId] = { spans: [
    { name: 'continuation.work', traceId, spanId: 'b'.repeat(16), parentSpanId: parent,
      attributes: attributes(attrs) },
    { name: 'openclaw.run', traceId, spanId: 'c'.repeat(16), parentSpanId: parent,
      status: { code: 'OK' }, attributes: attributes({ 'openclaw.run.id': wake.runId }) },
    { name: 'continuation.work.fire', traceId, spanId: 'd'.repeat(16), parentSpanId: parent,
      status: { code: 'OK' }, attributes: attributes(attrs) },
  ] };
  return traceId;
}
async function tokenFixture() {
  const m = await manifest('r-cw-delegate-token');
  const evidence = {
    nonce: 'token-nonce', parent_session_key: 'parent-session', parent_run_id: 'parent-run',
    child_session_key: 'child-session', child_initial_run_id: 'child-run',
    spawn_tool_call_id: 'spawn-call', spawn_task_id: 'spawn-task', spawn_flow_id: 'spawn-flow',
    spawn_mode: 'run', spawn_context: 'isolated',
    child_continue_work_tool_present: false, typed_continue_work_observed: false,
    message_tool_body_token_observed: false, token: '[[CONTINUE_WORK:5]]',
    token_grammar_valid: true, raw_final_text_token_observed: true,
    raw_final_text: 'TOKEN-HOP1 token-nonce\n[[CONTINUE_WORK:5]]',
    raw_final_text_run_id: 'child-run', child_initial_terminal_phase: 'end',
    hop_two_run_id: 'child-return', hop_two_started: true, hop_two_completed: true,
    hop_two_terminal_phase: 'end', hop_two_sentinel_bound: true,
  };
  evidence.spawn_task = m.invocation.promptTemplate.replaceAll('{{nonce}}', evidence.nonce)
    .replaceAll('{{token}}', evidence.token);
  const flow = { flowId: 'child-flow', ownerKey: evidence.child_session_key,
    controllerId: 'core/continuation-work', status: 'succeeded',
    stateJson: { originRunId: evidence.child_initial_run_id, disposition: 'granted', delayMs: 5000 } };
  const spawnTrace = 'f'.repeat(32);
  const spawn = { flowId: evidence.spawn_flow_id, ownerKey: evidence.parent_session_key,
    controllerId: 'core/continuation-delegate', status: 'succeeded',
    stateJson: { task: evidence.spawn_task, originRunId: evidence.parent_run_id,
      childSessionKey: evidence.child_session_key, childRunId: evidence.child_initial_run_id,
      disposition: 'granted', traceparent: `00-${spawnTrace}-${'e'.repeat(16)}-01` } };
  const traces = {};
  addTrace(flow, { runId: evidence.hop_two_run_id }, 0, traces);
  return { row: 'R-CW-DELEGATE-TOKEN', evidence, manifest: m, flows: [flow, spawn], traces,
    gatewayLog: [
      'bracket-parse: kind=work delayMs=5000 session=child-session runId=child-run',
      'effective-signal: origin=bracket kind=work session=child-session runId=child-run',
      `spawn controllerId=core/continuation-delegate toolCallId=spawn-call taskId=spawn-task ` +
        `flowId=spawn-flow taskSha256=${sha256(evidence.spawn_task)} originRunId=parent-run ` +
        `childSessionKey=child-session childRunId=child-run traceId=${spawnTrace} ` +
        'status=succeeded disposition=granted',
    ].join('\n') };
}

test('delegate token exact grammar, 5000ms delay, raw origin and complete identity joins', async () => {
  const fixture = await tokenFixture();
  assert.equal(validateLineage(fixture).ok, true);
  const attacks = [
    (f) => { f.evidence.token = 'CONTINUE_WORK:5'; },
    (f) => { f.evidence.raw_final_text = '[[CONTINUE_WORK:30]]'; },
    (f) => { delete f.evidence.raw_final_text; },
    (f) => { f.evidence.raw_final_text_token_observed = false; },
    (f) => { f.evidence.token_grammar_valid = false; },
    (f) => { f.flows[0].stateJson.delayMs = 30000; },
    (f) => { f.gatewayLog = f.gatewayLog.replaceAll('runId=child-run', 'runId=unrelated'); },
    (f) => { f.gatewayLog = f.gatewayLog.replace('delayMs=5000', 'delayMs=30000'); },
    (f) => { f.gatewayLog = f.gatewayLog.replace('delayMs=5000', 'delayMs=5000 delayMs=30000'); },
    (f) => { f.gatewayLog = f.gatewayLog.replaceAll('kind=work', 'kind=work-other'); },
    (f) => { f.evidence.child_initial_terminal_phase = 'error'; },
    (f) => { f.evidence.typed_continue_work_observed = true; },
    (f) => { f.evidence.message_tool_body_token_observed = true; },
    ...['spawn_task_id', 'spawn_flow_id', 'spawn_tool_call_id', 'child_session_key',
      'child_initial_run_id', 'parent_run_id', 'hop_two_run_id'].map((field) => (f) => { f.evidence[field] = 'unrelated'; }),
    (f) => { f.traces = {}; },
    (f) => { Object.values(f.traces)[0].spans[1].parentSpanId = 'd'.repeat(16); },
    (f) => { f.evidence.hop_two_terminal_phase = 'error'; },
  ];
  for (const attack of attacks) {
    const hostile = clone(fixture);
    attack(hostile);
    assert.equal(validateLineage(hostile).ok, false, attack.toString());
  }
  assert.equal(requestedTokenObserved(fixture.evidence, '[[CONTINUE_WORK:5]]'), true);
});

async function multiFixture() {
  const m = await manifest('r-cw-multi');
  const evidence = {
    nonce: 'multi-nonce', session_key: 'session-multi', origin_run_id: 'typed-origin',
    token_origin_run_id: 'token-origin', token_wake_run_id: 'token-wake',
    token_wake_started: true, token_wake_completed: true, token_wake_terminal_phase: 'end',
    token_wake_sentinel_bound: true, token: 'CONTINUE_WORK:0', token_grammar_valid: true,
    raw_final_text: 'CONTINUE_WORK:0', raw_final_text_token_observed: true,
    raw_final_text_run_id: 'token-origin', token_origin_terminal_phase: 'end',
    token_typed_tool_observed: false, schedule_results: [], schedule_calls: [], wake_runs: [],
  };
  const traces = {};
  const flows = m.invocation.elections.map((entry, index) => {
    const reason = entry.reason.replaceAll('{{nonce}}', evidence.nonce);
    evidence.schedule_results.push(`call-${index}`);
    evidence.schedule_calls.push({ toolCallId: `call-${index}`, reason, delaySeconds: entry.delaySeconds });
    const wake = { runId: `wake-${index}`, startedAt: index + 1, endedAt: index + 2,
      terminalPhase: 'end', labels: [entry.label] };
    evidence.wake_runs.push(wake);
    const flow = { flowId: `flow-${index}`, controllerId: 'core/continuation-work',
      ownerKey: evidence.session_key, status: 'succeeded',
      stateJson: { reason, delayMs: entry.delaySeconds * 1000,
        originRunId: evidence.origin_run_id, disposition: 'granted' } };
    addTrace(flow, wake, index, traces);
    return flow;
  });
  const token = { flowId: 'token-flow', controllerId: 'core/continuation-work',
    ownerKey: evidence.session_key, status: 'succeeded',
    stateJson: { delayMs: 0, originRunId: evidence.token_origin_run_id, disposition: 'granted' } };
  addTrace(token, { runId: evidence.token_wake_run_id }, 3, traces);
  flows.push(token);
  return { row: 'R-CW-MULTI', evidence, manifest: m, flows, traces,
    gatewayLog: 'bracket-parse: kind=work delayMs=0 session=session-multi runId=token-origin\n' +
      'effective-signal: origin=bracket kind=work session=session-multi runId=token-origin' };
}

test('multi one-to-one flow/wake/run/trace joins reject substituted delay, token, flows and equal-cardinality permutations', async () => {
  const fixture = await multiFixture();
  assert.equal(validateLineage(fixture).ok, true, validateLineage(fixture).failures.join(';'));
  for (const attack of [
    (f) => { f.evidence.raw_final_text = '[[CONTINUE_WORK:0]]'; },
    (f) => { f.evidence.raw_final_text = 'CONTINUE_WORK:30'; },
    (f) => { delete f.evidence.raw_final_text; },
    (f) => { f.flows[3].stateJson.delayMs = 30000; },
    (f) => { f.gatewayLog = f.gatewayLog.replaceAll('runId=token-origin', 'runId=unrelated'); },
    (f) => { f.evidence.wake_runs[0].runId = f.evidence.wake_runs[1].runId; },
    (f) => { [f.evidence.wake_runs[0].runId, f.evidence.wake_runs[1].runId] =
      [f.evidence.wake_runs[1].runId, f.evidence.wake_runs[0].runId]; },
    (f) => { f.flows[1].stateJson.traceparent = f.flows[0].stateJson.traceparent; },
    (f) => { delete f.evidence.schedule_calls[1].toolCallId; },
    (f) => { f.evidence.schedule_calls[1].toolCallId = f.evidence.schedule_calls[0].toolCallId; },
    (f) => { f.evidence.token_origin_terminal_phase = 'error'; },
    (f) => { Object.values(f.traces)[0].spans[1].attributes = []; },
    (f) => { f.evidence.token_wake_run_id = f.evidence.wake_runs[0].runId; },
  ]) {
    const hostile = clone(fixture);
    attack(hostile);
    assert.equal(validateLineage(hostile).ok, false, attack.toString());
  }
});

test('shared originating traceparents require a per-flow accept parent or exact flow/run binding', async () => {
  const fixture = await multiFixture();
  const traceId = fixture.flows[0].stateJson.traceparent.split('-')[1];
  const sharedSpans = [];
  for (let index = 0; index < 3; index += 1) {
    const flow = fixture.flows[index];
    const original = flow.stateJson.traceparent.split('-')[1];
    const spans = fixture.traces[original].spans;
    delete fixture.traces[original];
    for (let offset = 0; offset < spans.length; offset += 1) {
      spans[offset].traceId = traceId;
      spans[offset].spanId = (index * 3 + offset + 1).toString(16).repeat(16);
    }
    flow.stateJson.traceparent = fixture.flows[0].stateJson.traceparent;
    sharedSpans.push(...spans);
  }
  fixture.traces[traceId] = { spans: sharedSpans };
  assert.equal(validateLineage(fixture).ok, false, 'shared parent alone is ambiguous even before permutation');
  const permuted = clone(fixture);
  [permuted.evidence.wake_runs[0].runId, permuted.evidence.wake_runs[1].runId] =
    [permuted.evidence.wake_runs[1].runId, permuted.evidence.wake_runs[0].runId];
  assert.equal(validateLineage(permuted).ok, false);
  for (let index = 0; index < 3; index += 1) {
    sharedSpans[index * 3 + 1].parentSpanId = sharedSpans[index * 3].spanId;
  }
  assert.equal(validateLineage(fixture).ok, true);
  const swapped = clone(fixture);
  [swapped.evidence.wake_runs[0].runId, swapped.evidence.wake_runs[1].runId] =
    [swapped.evidence.wake_runs[1].runId, swapped.evidence.wake_runs[0].runId];
  assert.equal(validateLineage(swapped).ok, false, 'equal counts cannot substitute per-flow parents');
  for (let index = 0; index < 3; index += 1) {
    sharedSpans[index * 3 + 1].parentSpanId = 'a'.repeat(16);
    fixture.gatewayLog += `\nflowId=flow-${index} runId=wake-${index} traceId=${traceId} spanId=${sharedSpans[index * 3 + 1].spanId}`;
  }
  assert.equal(validateLineage(fixture).ok, true);
  [fixture.evidence.wake_runs[0].runId, fixture.evidence.wake_runs[1].runId] =
    [fixture.evidence.wake_runs[1].runId, fixture.evidence.wake_runs[0].runId];
  assert.equal(validateLineage(fixture).ok, false);
});

test('optional reason hash is absent for token continuations and exact for reason-bearing flows', async () => {
  const token = await tokenFixture();
  assert.equal(validateLineage(token).ok, true);
  for (const spanIndex of [0, 2]) {
    const hostile = clone(token);
    Object.values(hostile.traces)[0].spans[spanIndex].attributes.push({
      key: 'reason.hash', value: { stringValue: sha256('').slice(0, 16) },
    });
    assert.equal(validateLineage(hostile).ok, false);
  }
  const multi = await multiFixture();
  assert.equal(validateLineage(multi).ok, true);
  for (const spanIndex of [0, 2]) {
    for (const hash of [null, 'incorrect']) {
      const hostile = clone(multi);
      const span = Object.values(hostile.traces)[0].spans[spanIndex];
      span.attributes = span.attributes.filter(({ key }) => key !== 'reason.hash');
      if (hash) span.attributes.push({ key: 'reason.hash', value: { stringValue: hash } });
      assert.equal(validateLineage(hostile).ok, false);
    }
  }
});

test('CW7 requires exact TaskFlow, successful lifecycle run and trace, not any successor in a window', async () => {
  const m = await manifest('r-cw-7');
  const evidence = { nonce: 'cw7', session_key: 'session', origin_run_id: 'origin',
    hop_two_run_id: 'wake', hop_two_started: true, hop_two_completed: true, hop_two_terminal_phase: 'end',
    hop_two_output_bound: true };
  const flow = { flowId: 'cw7-flow', ownerKey: 'session', controllerId: 'core/continuation-work',
    status: 'succeeded', stateJson: { originRunId: 'origin', disposition: 'granted',
      reason: m.invocation.reason.replaceAll('{{nonce}}', evidence.nonce), delayMs: 7000 } };
  const traces = {};
  addTrace(flow, { runId: 'wake' }, 0, traces);
  const fixture = { row: 'R-CW-7', evidence, manifest: m, flows: [flow], traces };
  assert.equal(validateLineage(fixture).ok, true);
  for (const attack of [
    (f) => { f.flows = []; }, (f) => { f.flows[0].flowId = ''; },
    (f) => { f.evidence.hop_two_run_id = 'unrelated'; },
    (f) => { f.evidence.hop_two_terminal_phase = 'error'; },
    (f) => { f.traces = {}; },
    (f) => { Object.values(f.traces)[0].spans[1].attributes = []; },
  ]) {
    const hostile = clone(fixture); attack(hostile);
    assert.equal(validateLineage(hostile).ok, false);
  }
});

test('root nonce fragment followed by error, unrelated root run or missing terminal is never collection success', () => {
  const evidence = { root_run_id: 'initial', root_collection_run_id: 'collection',
    root_collection_output_run_id: 'collection', root_collection_terminal_run_id: 'collection',
    root_collection_started: true, root_collection_terminal_phase: 'end',
    root_collected_at_ms: 20, root_collection_terminal_at_ms: 30, c_terminal_at_ms: 10 };
  assert.equal(collectionTerminalComplete(evidence), true);
  for (const patch of [{ root_collection_terminal_phase: 'error' },
    { root_collection_terminal_phase: null }, { root_collection_output_run_id: 'other' },
    { root_collection_terminal_run_id: 'other' }, { root_collection_terminal_at_ms: 19 }]) {
    assert.equal(collectionTerminalComplete({ ...evidence, ...patch }), false);
  }
});

test('process terminal authority rejects unsigned sparse PASS, wrong schema/row/tree/docs/script/argv and omitted checks', () => {
  const rowId = 'R-CW-MULTI-COLLAPSE';
  const b = { ...bindings, rowId, candidateTree: 'a'.repeat(40),
    argvSha256: 'd'.repeat(64), scriptSha256: 'e'.repeat(64) };
  const original = { ...body(rowId, PROCESS_RECEIPT_SCHEMA),
    candidateTree: b.candidateTree, argvSha256: b.argvSha256, scriptSha256: b.scriptSha256,
    suiteExitCode: 0, checks: Object.fromEntries(PROCESS_REQUIRED_CHECKS[rowId].map((key) => [key, true])) };
  assert.equal(validateProcessReceipt(signProducerReceipt(original, key), b), true);
  for (const patch of [{ schema: 'other' }, { rowId: 'R-CW-5' },
    { candidateTree: 'f'.repeat(40) }, { candidateSha: 'f'.repeat(40) }, { docsSha: 'f'.repeat(40) },
    { argvSha256: 'f'.repeat(64) }, { scriptSha256: 'f'.repeat(64) }, { suiteExitCode: 1 },
    { checks: {} }, { checks: { ...original.checks, 'running-never-folds': 'true' } }]) {
    assert.equal(validateProcessReceipt(signProducerReceipt({ ...original, ...patch }, key), b), false);
  }
  assert.equal(validateProcessReceipt(original, b), false);
  assert.equal(validateProcessReceipt(signProducerReceipt({ verdict: 'PASS' }, key), b), false);
  assert.equal(validateProcessReceipt(signProducerReceipt(original, 'wrong'), b), false);
});

test('process report and metrics require the bound validated signed digest, not sparse PASS-candidate', async () => workspace(async (dir) => {
  const rowId = 'R-CW-MULTI-COLLAPSE';
  const metadata = { row: rowId, candidateSha: REQUIRED_PRODUCT_SHA, docsRef: docsSha, runId: path.basename(dir) };
  const fixtureBytes = JSON.stringify({ rowId, suiteExitCode: 0, outcome: 'PASS-candidate' });
  const receipt = signProducerReceipt({
    ...body(rowId, PROCESS_RECEIPT_SCHEMA), issuer: 'catalog-process-observer', runId: metadata.runId,
    candidateTree: 'a'.repeat(40), argvSha256: 'd'.repeat(64), scriptSha256: 'e'.repeat(64),
    suiteExitCode: 0, checks: Object.fromEntries(PROCESS_REQUIRED_CHECKS[rowId].map((key) => [key, true])),
    artifactDigests: { 'row-result.json': sha256(fixtureBytes) },
    issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
  }, key);
  const receiptBytes = JSON.stringify(receipt);
  const runResult = { verdict: 'PASS-candidate', effectiveExitCode: 0, evidence: { row: rowId },
    processTerminalReceipt: { file: 'process-terminal-receipt.json', sha256: sha256(receiptBytes), validated: true } };
  await writeFile(path.join(dir, 'runner-metadata.json'), JSON.stringify(metadata));
  await writeFile(path.join(dir, 'row-manifest.json'), JSON.stringify({ rowId }));
  await writeFile(path.join(dir, 'row-result.json'), fixtureBytes);
  await writeFile(path.join(dir, 'process-terminal-receipt.json'), receiptBytes);
  const exportOutcome = (env = {}, expectedStatus = 0) => {
    const result = cli('export-row-metrics.mjs', ['--run-dir', dir], { OPENCLAW_PROCESS_RECEIPT_KEY: key, ...env });
    assert.equal(result.status, expectedStatus, result.stderr);
    return JSON.parse(result.stdout).outcome;
  };
  await writeFile(path.join(dir, 'run-result.json'), JSON.stringify(runResult));
  assert.equal(exportOutcome(), 'PASS-candidate');
  assert.equal(exportOutcome({ OPENCLAW_PROCESS_RECEIPT_KEY: 'wrong-key' }, 1), 'FAIL-candidate');
  for (const hostile of [{ verdict: 'PASS-candidate', effectiveExitCode: 0 },
    { ...runResult, processTerminalReceipt: { ...runResult.processTerminalReceipt, sha256: '0'.repeat(64) } }]) {
    await writeFile(path.join(dir, 'run-result.json'), JSON.stringify(hostile));
    assert.equal(exportOutcome({}, 1), 'FAIL-candidate');
  }
  const report = path.join(dir, 'report.html');
  assert.equal(cli('render-run-report.mjs', ['--root', dir, '--out', report], {
    OPENCLAW_PROCESS_RECEIPT_KEY: key,
  }).status, 0);
  assert.doesNotMatch(await readFile(report, 'utf8'), /<td>PASS-candidate<\/td>/);
  await writeFile(path.join(dir, 'run-result.json'), JSON.stringify(runResult));
  await writeFile(path.join(dir, 'row-result.json'), '{"suiteExitCode":1}');
  assert.equal(exportOutcome({}, 1), 'FAIL-candidate');
}));

async function signedProcessFixture(dir, rowId) {
  const runDir = path.join(dir, `run-${rowId}`);
  await mkdir(runDir);
  const prerequisite = rowId === 'R-CW-7';
  const receiptDir = prerequisite ? path.join(runDir, 'process-local-prerequisite') : runDir;
  if (prerequisite) await mkdir(receiptDir);
  const metadata = { row: rowId, candidateSha: REQUIRED_PRODUCT_SHA, docsRef: docsSha,
    runId: path.basename(runDir) };
  const rowResult = { rowId, runId: metadata.runId, outcome: 'PASS-candidate',
    candidateSha: REQUIRED_PRODUCT_SHA, metrics: { proofFailures: 0 } };
  const artifact = '{"suiteExitCode":0}';
  const receipt = signProducerReceipt({
    ...body(rowId, PROCESS_RECEIPT_SCHEMA), issuer: 'catalog-process-observer', runId: metadata.runId,
    candidateTree: 'a'.repeat(40), argvSha256: 'd'.repeat(64), scriptSha256: 'e'.repeat(64),
    suiteExitCode: 0, checks: Object.fromEntries(PROCESS_REQUIRED_CHECKS[rowId].map((key) => [key, true])),
    artifactDigests: { 'suite.json': sha256(artifact) },
    issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
  }, key);
  const receiptBytes = JSON.stringify(receipt);
  const runResult = { verdict: 'PASS-candidate', effectiveExitCode: 0, evidence: { row: rowId },
    processTerminalReceipt: {
      file: `${prerequisite ? 'process-local-prerequisite/' : ''}process-terminal-receipt.json`,
      sha256: sha256(receiptBytes), validated: true,
    } };
  const rowManifest = { rowId };
  for (const [file, value] of Object.entries({ 'runner-metadata.json': metadata,
    'row-manifest.json': rowManifest, 'run-result.json': runResult, 'row-result.json': rowResult })) {
    await writeFile(path.join(runDir, file), JSON.stringify(value));
  }
  await writeFile(path.join(receiptDir, 'process-terminal-receipt.json'), receiptBytes);
  await writeFile(path.join(receiptDir, 'suite.json'), artifact);
  return { runDir, manifest: rowManifest, metadata, runResult, rowResult };
}

test('both exporter inputs reject missing and conflicting process row identity on every surface', async () => workspace(async (dir) => {
  for (const rowId of Object.keys(PROCESS_REQUIRED_CHECKS)) {
    const fixture = await signedProcessFixture(dir, rowId);
    const files = { manifest: 'row-manifest.json', metadata: 'runner-metadata.json',
      runResult: 'run-result.json', rowResult: 'row-result.json' };
    const assertExport = (valid) => {
      for (const args of [['--run-dir', fixture.runDir],
        ['--row-result', path.join(fixture.runDir, 'row-result.json')]]) {
        const run = cli('export-row-metrics.mjs', args, { OPENCLAW_PROCESS_RECEIPT_KEY: key });
        assert.equal(run.status, valid ? 0 : 1, `${rowId}: ${run.stderr || run.stdout}`);
        assert.equal(JSON.parse(run.stdout).outcome, valid ? 'PASS-candidate' : 'FAIL-candidate');
      }
    };
    assertExport(true);
    const resolvedRowResult = { ...fixture.rowResult };
    delete resolvedRowResult.rowId;
    await writeFile(path.join(fixture.runDir, 'row-result.json'), JSON.stringify(resolvedRowResult));
    assertExport(true);
    await writeFile(path.join(fixture.runDir, 'row-result.json'), JSON.stringify(fixture.rowResult));
    for (const source of Object.keys(files)) {
      const hostile = clone(fixture[source]);
      if (source === 'runResult') hostile.evidence.row = 'R-CW-MULTI';
      else if (source === 'metadata') hostile.row = 'R-CW-MULTI';
      else hostile.rowId = 'R-CW-MULTI';
      await writeFile(path.join(fixture.runDir, files[source]), JSON.stringify(hostile));
      assertExport(false);
      await writeFile(path.join(fixture.runDir, files[source]), JSON.stringify(fixture[source]));
    }
    for (const source of ['manifest', 'metadata', 'runResult']) {
      const hostile = clone(fixture[source]);
      if (source === 'runResult') delete hostile.evidence.row;
      else if (source === 'metadata') delete hostile.row;
      else delete hostile.rowId;
      await writeFile(path.join(fixture.runDir, files[source]), JSON.stringify(hostile));
      assertExport(false);
      await writeFile(path.join(fixture.runDir, files[source]), JSON.stringify(fixture[source]));
    }
    for (const [source, field, value] of [
      ['metadata', 'rowId', 'R-CW-MULTI'], ['rowResult', 'row', 'R-CW-MULTI'],
      ['rowResult', 'candidateSha', 'e'.repeat(40)], ['rowResult', 'runId', 'another-run'],
      ['rowResult', 'docsSha', 'e'.repeat(40)], ['metadata', 'runId', 'another-run'],
    ]) {
      await writeFile(path.join(fixture.runDir, files[source]),
        JSON.stringify({ ...fixture[source], [field]: value }));
      assertExport(false);
      await writeFile(path.join(fixture.runDir, files[source]), JSON.stringify(fixture[source]));
    }
    for (const [file, content] of [
      ['producer-summary.json', { row: 'R-CW-MULTI', verdict: 'PASS-candidate' }],
      ['evidence.jsonl', { rowId: 'R-CW-MULTI' }],
      ['candidate-run-result.json', { run: { rowId: 'R-CW-MULTI' } }],
      ['fixture-result.json', { rowId: 'R-CW-MULTI' }],
    ]) {
      await writeFile(path.join(fixture.runDir, file), `${JSON.stringify(content)}\n`);
      assertExport(false);
      await rm(path.join(fixture.runDir, file));
    }
    await rm(path.join(fixture.runDir, 'run-result.json'));
    assertExport(false);
    await rm(path.join(fixture.runDir, 'row-manifest.json'));
    await rm(path.join(fixture.runDir, 'runner-metadata.json'));
    assertExport(false);
  }
}));

test('signed process run identity cannot be copied or renamed, including CW7 prerequisite directories', async () => workspace(async (dir) => {
  const priorKey = process.env.OPENCLAW_PROCESS_RECEIPT_KEY;
  process.env.OPENCLAW_PROCESS_RECEIPT_KEY = key;
  try {
    for (const rowId of ['R-CW-MULTI-COLLAPSE', 'R-CW-7']) {
      const fixture = await signedProcessFixture(dir, rowId);
      assert.equal(processTerminalValid(fixture), true);
      assert.equal(processTerminalValid({ ...fixture, manifest: {}, metadata: {}, runResult: {}, rowResult: {} }), false);
      assert.equal(processTerminalValid({ ...fixture, metadata: { ...fixture.metadata, row: 'R-CW-5' } }), false);
      const renamed = `${fixture.runDir}-renamed`;
      await cp(fixture.runDir, renamed, { recursive: true });
      const run = cli('export-row-metrics.mjs', ['--run-dir', renamed]);
      assert.equal(run.status, 1);
      assert.equal(JSON.parse(run.stdout).outcome, 'FAIL-candidate');
      assert.equal(processTerminalValid({ ...fixture, runDir: renamed }), false);
      await writeFile(path.join(renamed, 'runner-metadata.json'),
        JSON.stringify({ ...fixture.metadata, runId: path.basename(renamed) }));
      assert.equal(cli('export-row-metrics.mjs', ['--run-dir', renamed]).status, 1);
      await rename(fixture.runDir, `${fixture.runDir}-moved`);
      assert.equal(processTerminalValid({ ...fixture, runDir: `${fixture.runDir}-moved` }), false);
    }
  } finally {
    if (priorKey === undefined) delete process.env.OPENCLAW_PROCESS_RECEIPT_KEY;
    else process.env.OPENCLAW_PROCESS_RECEIPT_KEY = priorKey;
  }
}));

test('gateway journal drops concurrent unrelated-private-line despite continuation/error keywords and shared session', () => {
  const { orderedTokens } = sanitizeEvidenceRecords([{ nonce: 'row-nonce-123', run_id: 'row-run-123',
    session_key: 'shared-session-123' }]);
  const privateLine = 'continuation error shared-session-123 unrelated-private-line: confidential unrelated customer text';
  const result = sanitizeServiceLog([
    privateLine, 'continuation failed session=shared-session-123 secret-body',
    'continuation runId=row-run-123 status=ok', 'continuation runId=row-run-123-suffix private',
    'continuation runId=row-run-123:unrelated private', 'continuation runId=row-run-123.unrelated private',
    'unrelated error nonce=row-nonce-123-suffix private',
    'continuation runId=other-run note=row-run-123 unrelated-private-line',
    'continuation runId=other-run body="row-run-123" unrelated-private-line',
  ].join('\n'), orderedTokens);
  assert.equal(result.retainedLines, 1);
  assert.match(result.text, /"runidFingerprint":"[a-f0-9]{16}"/u);
  assert.match(result.text, /"status":"ok"/u);
  assert.doesNotMatch(result.text, /confidential|private|secret-body|row-run-123/);
});

test('stale PASS and zero failure metrics are overridden by each effective failure channel in report and metrics', async () => workspace(async (dir) => {
  for (const field of ['k6ExitCode', 'postprocessExitCode', 'effectiveExitCode']) {
    const runDir = path.join(dir, field);
    await mkdir(runDir);
    await writeFile(path.join(runDir, 'run-result.json'), JSON.stringify({
      evidence: { row: 'R-CW-MULTI' },
      verdict: 'PASS-candidate', k6ExitCode: 0, postprocessExitCode: 0, effectiveExitCode: 0,
      [field]: 1, review: { status: 'ready-for-human-review', pendingReceipts: [] },
    }));
    await writeFile(path.join(runDir, 'producer-summary.json'), JSON.stringify({
      verdict: 'PASS-candidate', metrics: { failures: 0 },
    }));
    const prom = path.join(runDir, 'out.prom');
    const run = cli('export-row-metrics.mjs', ['--run-dir', runDir, '--prometheus-out', prom]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).outcome, 'FAIL-candidate');
    assert.match(await readFile(prom, 'utf8'), /proof_failures_total\{[^\n]*\} 1/);
  }
  const report = path.join(dir, 'report.html');
  assert.equal(cli('render-run-report.mjs', ['--root', dir, '--out', report]).status, 0);
  assert.doesNotMatch(await readFile(report, 'utf8'), /<td>PASS-candidate<\/td>/);
  assert.match(await readFile(report, 'utf8'), /PASS-candidate: 0/);
}));

test('failed atomic publication and exporter failures remove partial and stale artifacts', async () => workspace(async (dir) => {
  const first = path.join(dir, 'first');
  await writeFile(first, 'stale PASS');
  await assert.rejects(publishArtifacts([[first, 'new'], [path.join(dir, 'absent', 'second'), 'new']]));
  assert.equal(await readFile(first, 'utf8'), 'stale PASS');
  await writeFile(path.join(dir, 'run-result.json'), '{"verdict":"PASS-candidate"');
  const prom = path.join(dir, 'out.prom');
  const otlp = path.join(dir, 'out.json');
  const report = path.join(dir, 'report.html');
  for (const file of [prom, otlp, report]) await writeFile(file, 'stale PASS');
  assert.notEqual(cli('export-row-metrics.mjs', ['--run-dir', dir, '--prometheus-out', prom, '--otlp-out', otlp]).status, 0);
  await assert.rejects(readFile(prom)); await assert.rejects(readFile(otlp));
  assert.notEqual(cli('render-run-report.mjs', ['--root', dir, '--out', report]).status, 0);
  await assert.rejects(readFile(report));
}));

test('OTLP PASS is sent only after local publication; remote failure invalidates every local output', async () => workspace(async (dir) => {
  const input = path.join(dir, 'row-result.json');
  await writeFile(input, JSON.stringify({ rowId: 'R-CW-MULTI', outcome: 'PASS-candidate',
    runId: 'publication-test', metrics: { proofFailures: 0 } }));
  const prom = path.join(dir, 'out.prom');
  const otlp = path.join(dir, 'out.otlp.json');
  const blocked = path.join(dir, 'blocked.otlp.json');
  await mkdir(blocked);
  await writeFile(path.join(blocked, 'keep'), 'not an output artifact');
  let pushes = 0;
  let locallyPublished = false;
  let status = 200;
  const server = createServer(async (request, response) => {
    pushes += 1;
    for await (const _chunk of request) { /* Drain the request before replying. */ }
    try {
      const localProm = await readFile(prom, 'utf8');
      const localOtlp = JSON.parse(await readFile(otlp, 'utf8'));
      locallyPublished = /outcome="PASS-candidate"/u.test(localProm) &&
        localOtlp.resourceMetrics.length === 1;
    } catch { locallyPublished = false; }
    response.writeHead(status).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/metrics`;
  const runExporter = (output) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(proofsDir, 'scripts/export-row-metrics.mjs'),
      '--row-result', input, '--prometheus-out', prom, '--otlp-out', output, '--push-otlp', endpoint],
    { env: process.env });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  try {
    assert.equal((await runExporter(blocked)).status, 1);
    assert.equal(pushes, 0, 'rename failure must never reach the remote collector');
    await assert.rejects(readFile(prom));
    status = 503;
    assert.equal((await runExporter(otlp)).status, 1);
    assert.equal(pushes, 1);
    assert.equal(locallyPublished, true);
    await assert.rejects(readFile(prom));
    await assert.rejects(readFile(otlp));
    status = 200;
    const result = await runExporter(otlp);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(pushes, 2);
    assert.equal(locallyPublished, true);
    assert.equal(JSON.parse(result.stdout).push.ok, true);
    assert.ok((await readdir(dir)).every((name) => !name.endsWith('.pending')));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}));

test('malformed auxiliary summaries cannot interrupt invalidation of later PASS surfaces', async () => workspace(async (dir) => {
  for (const [file, value] of [
    ['run-result.json', '{"verdict":"PASS-candidate","review":{"pendingReceipts":42}}'],
    ['a-summary.json', '{"verdict":"PASS-candidate"'],
    ['z-summary.json', '{"verdict":"PASS-candidate","metrics":{"failures":0}}'],
    ['row-result.json', '{"outcome":"PASS-candidate","metrics":{"proofFailures":0}}'],
    ['fixture-result.json', '{"verdict":"PASS-candidate"}'],
    ['candidate-run-result.json', '{"result":{"outcome":"PASS-candidate"}}'],
    ['openclaw-proofs-k6.prom', 'outcome="PASS-candidate"'],
    ['openclaw-proofs-k6.otlp.json', 'PASS-candidate'],
    ['metrics-export.json', '{"outcome":"PASS-candidate"}'],
  ]) await writeFile(path.join(dir, file), value);
  const result = cli('fail-run-result.mjs', [dir, 'report-generation-failed']);
  assert.equal(result.status, 1, 'cleanup defects remain visible to the caller');
  for (const file of ['run-result.json', 'a-summary.json', 'z-summary.json', 'row-result.json', 'fixture-result.json']) {
    const raw = await readFile(path.join(dir, file), 'utf8');
    assert.doesNotMatch(raw, /PASS-candidate/);
    assert.equal(JSON.parse(raw).verdict, 'FAIL-candidate');
  }
  for (const file of ['candidate-run-result.json', 'openclaw-proofs-k6.prom',
    'openclaw-proofs-k6.otlp.json', 'metrics-export.json']) await assert.rejects(readFile(path.join(dir, file)));
  const cleanup = JSON.parse(await readFile(path.join(dir, 'failure-invalidation.json'), 'utf8'));
  assert.equal(cleanup.ok, false);
  assert.deepEqual(cleanup.failures, ['a-summary.json:malformed-or-missing']);
}));

test('all five restored live rows hard-fail runtime mismatch before any traffic and make the matrix non-green', async () => workspace(async (dir) => {
  const harness = await buildHarnessCheckout(repoRoot, path.join(dir, 'checkout'));
  const bin = path.join(dir, 'bin'); await mkdir(bin);
  const traffic = path.join(dir, 'traffic');
  for (const tool of ['k6', 'openclaw', 'journalctl']) {
    await writeFile(path.join(bin, tool), `#!/bin/sh\necho traffic >> '${traffic}'\nexit 1\n`, { mode: 0o755 });
  }
  const rows = ['R-CD-COLLECTION-ON-COLLAPSE', 'R-CW-7', 'R-CW-DELEGATE-CHILD-LIVE',
    'R-CW-DELEGATE-TOKEN', 'R-CW-MULTI'];
  for (const candidate of [REQUIRED_PRODUCT_SHA, 'a'.repeat(40)]) {
    const out = path.join(dir, `out-${candidate.slice(0, 4)}`);
    const result = spawnSync('bash', [path.join(harness.proofsDir, 'scripts/run-proofs.sh'),
      '--live', '--docs-ref', harness.docsRef, '--out-dir', out, rows.join(','), candidate], {
      encoding: 'utf8', timeout: 120000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: dir,
        OPENCLAW_RUNTIME_BUILD_SHA: 'a'.repeat(40), OPENCLAW_SEAT_NAME: 'contract-seat',
        OPENCLAW_GATEWAY_TOKEN: '', OPENCLAW_SESSION_KEY: 'main' },
    });
    assert.equal(result.status, 78, result.stderr || result.stdout);
    const matrix = JSON.parse(await readFile(path.join(out, 'matrix-result.json')));
    assert.equal(matrix.ok, false); assert.equal(matrix.rowFailures.length, 5);
    for (const row of rows) {
      const rowDir = path.join(out, candidate, row);
      const [seatName] = await readdir(rowDir);
      const seat = path.join(rowDir, seatName);
      const [run] = await readdir(seat);
      const terminal = JSON.parse(await readFile(path.join(seat, run, 'run-result.json')));
      assert.equal(terminal.effectiveExitCode, 78);
      assert.equal(terminal.verdict, 'FAIL-candidate');
      assert.equal(terminal.evidence.dispatched, false);
    }
    const control = JSON.parse(await readFile(path.join(out, 'harness-control-receipt.json')));
    assert.equal(control.ok, false); assert.equal(control.rowsExecuted, 0);
    assert.equal(control.rowsTerminatedPreDispatch, 5);
    assert.doesNotMatch(await readFile(path.join(out, 'report.html'), 'utf8'), /<td>PASS-candidate<\/td>/);
  }
  await assert.rejects(readFile(traffic), 'no readiness, k6, journal or gateway traffic allowed');
}));

test('runner failures in k6, lineage, trace, evidence, metrics and report override stale PASS through final exit', async () => workspace(async (dir) => {
  const harness = await buildHarnessCheckout(repoRoot, path.join(dir, 'checkout'));
  const bin = path.join(dir, 'bin'); await mkdir(bin);
  const nodeShim = `#!/usr/bin/env node
const {spawnSync}=require('node:child_process');
const {writeFileSync,readdirSync}=require('node:fs');
const path=require('node:path');
const args=process.argv.slice(2), name=path.basename(args[0]||'');
const fail=process.env.INJECT_FAILURE;
const out=(flag)=>args[args.indexOf(flag)+1];
if(name==='seat-readiness-preflight.mjs') {
 console.log(JSON.stringify({outcome:'PASS-candidate',continuation:{enabled:true,defaultsPresent:true},notes:[]})); process.exit(0);
}
if(name==='run-catalog-producer.mjs' && fail==='process-authority') {
 if(args.includes('--verify-only')) console.log(JSON.stringify({validated:true,sha256:'0'.repeat(64)}));
 else writeFileSync(path.join(out('--artifact-dir'),'row-result.json'),
  JSON.stringify({rowId:out('--row'),verdict:'PASS-candidate',metrics:{failures:0}}));
 process.exit(0);
}
if(name==='render-run-report.mjs' && fail==='report-cleanup') {
 const runs=[];
 const walk=(dir)=>{for(const entry of readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()) walk(file);
  else if(entry.name==='run-result.json') runs.push(dir);
 }};
 walk(out('--root'));
 writeFileSync(path.join(runs[0],'a-summary.json'),'{"verdict":"PASS-candidate"');
 writeFileSync(path.join(runs[0],'z-summary.json'),'{"verdict":"PASS-candidate"}');
 writeFileSync(path.join(runs[0],'candidate-run-result.json'),'{"result":{"outcome":"PASS-candidate"}}');
 process.exit(1);
}
const stages={'collect-live-producer-lineage.mjs':'lineage','collect-continuation-trace.mjs':'trace',
 'extract-k6-evidence.mjs':'evidence','export-row-metrics.mjs':'metrics','render-run-report.mjs':'report'};
if(fail && stages[name]===fail) process.exit(1);
if(name==='collect-live-producer-lineage.mjs') {
 writeFileSync(out('--out'),JSON.stringify({ok:true})); console.log('{"ok":true}'); process.exit(0);
}
if(name==='collect-continuation-trace.mjs') {
 const run=out('--run-dir'); writeFileSync(path.join(run,'trace.json'),'{}');
 writeFileSync(path.join(run,'correlation.json'),'{}');
 console.log(JSON.stringify({traceId:'1'.repeat(32),traceFile:'trace.json',receiptFile:'correlation.json'})); process.exit(0);
}
const result=spawnSync(${JSON.stringify(process.execPath)},args,{stdio:'inherit'});
process.exit(result.status??1);
`;
  // Absolute shebang avoids recursing through this node shim.
  await writeFile(path.join(bin, 'node'), nodeShim.replace('#!/usr/bin/env node', `#!${process.execPath}`), { mode: 0o755 });
  await writeFile(path.join(bin, 'k6'), `#!/bin/sh
row="$(jq -r .rowId "$OPENCLAW_ROW_MANIFEST")"
echo "--- $row EVIDENCE SUMMARY ---"
jq -cn --arg row "$row" '{row:$row,nonce:"private-row-nonce",started:"2026-09-05T00:00:00Z"}'
echo '--- END EVIDENCE ---'
echo "[$row] VERDICT: PASS-candidate"
jq -cn --arg row "$row" '{row:$row,verdict:"PASS-candidate",metrics:{failures:0}}' > fixture-summary.json
if [ "$INJECT_FAILURE" = k6 ]; then exit 1; fi
`, { mode: 0o755 });
  await writeFile(path.join(bin, 'journalctl'), '#!/bin/sh\necho "continuation nonce=private-row-nonce status=ok"\n', { mode: 0o755 });
  for (const failure of ['k6', 'lineage', 'trace', 'evidence', 'metrics', 'report', 'process-authority', 'report-cleanup']) {
    const out = path.join(dir, failure);
    const rows = failure === 'process-authority' ? ['R-CW-MULTI-COLLAPSE'] :
      failure === 'report-cleanup' ? ['R-CW-MULTI', 'R-CW-DELEGATE-CHILD-LIVE'] : ['R-CW-MULTI'];
    const result = spawnSync('bash', [path.join(harness.proofsDir, 'scripts/run-proofs.sh'),
      '--live', '--docs-ref', harness.docsRef, '--out-dir', out, rows.join(','), REQUIRED_PRODUCT_SHA], {
      encoding: 'utf8', timeout: 120000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: dir,
        OPENCLAW_RUNTIME_BUILD_SHA: REQUIRED_PRODUCT_SHA, OPENCLAW_GATEWAY_TOKEN: 'test-token',
        OPENCLAW_SESSION_KEY: 'main', INJECT_FAILURE: failure,
        FINAL_PRODUCT_CHECKOUT: harness.checkout,
        OPENCLAW_PROOFS_K6_METRICS_REQUIRED: 'false', OPENCLAW_PROOFS_K6_REPORT_REQUIRED: 'false' },
    });
    assert.notEqual(result.status, 0, `${failure}: ${result.stderr || result.stdout}`);
    for (const rowId of rows) {
      const row = path.join(out, REQUIRED_PRODUCT_SHA, rowId);
      const seats = await readdir(row).catch(() => assert.fail(result.stderr || result.stdout));
      const [seat] = seats; const [run] = await readdir(path.join(row, seat));
      const runDir = path.join(row, seat, run);
      const terminal = JSON.parse(await readFile(path.join(runDir, 'run-result.json')));
      assert.equal(terminal.verdict, 'FAIL-candidate', failure);
      assert.notEqual(terminal.effectiveExitCode, 0, failure);
      const matrix = JSON.parse(await readFile(path.join(out, 'matrix-result.json')));
      assert.equal(matrix.ok, false, failure);
      assert.notEqual(matrix.effectiveExitCode, 0, failure);
      const control = JSON.parse(await readFile(path.join(out, 'harness-control-receipt.json')));
      assert.equal(control.ok, false);
      const prom = path.join(runDir, 'openclaw-proofs-k6.prom');
      if (['metrics', 'process-authority'].includes(failure)) await assert.rejects(readFile(prom));
      else assert.doesNotMatch(await readFile(prom, 'utf8'), /outcome="PASS-candidate"/);
      if (['report', 'report-cleanup'].includes(failure)) await assert.rejects(readFile(path.join(out, 'report.html')));
      else assert.doesNotMatch(await readFile(path.join(out, 'report.html'), 'utf8'), /<td>PASS-candidate<\/td>/);
      await assert.rejects(readFile(path.join(runDir, 'candidate-run-result.json')));
      for (const name of await readdir(runDir)) {
        if (name.endsWith('summary.json') || name === 'row-result.json') {
          assert.doesNotMatch(await readFile(path.join(runDir, name), 'utf8'), /PASS-candidate/, name);
        }
      }
      if (failure === 'report-cleanup') assert.ok(matrix.rowFailures.includes('REPORT:row-cleanup:1'));
    }
  }
}));
