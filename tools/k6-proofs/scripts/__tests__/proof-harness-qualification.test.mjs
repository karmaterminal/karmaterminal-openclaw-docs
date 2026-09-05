import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  classifyManagedFlows,
  runHostileControls,
  signProducerReceipt,
  validateEnvironmentReceipt,
  validateExactIdentities,
  validateProducerCatalog,
  validateProducerReceipt,
  validateTerminalRollup,
} from '../../lib/proof-harness-qualification.mjs';

const sha = 'a'.repeat(40);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const identities = {
  productSha: sha,
  runtimeSha: sha,
  docsSha: sha,
  corpusSha: sha,
  gatewayUrl: 'ws://127.0.0.1:18789',
  gatewayId: 'elliott-local',
  seat: 'elliott',
  sessionId: 'qualification-session',
  runId: 'qualification-run',
};

test('requires every exact identity and rejects malformed gateway bindings', () => {
  assert.deepEqual(validateExactIdentities(identities), []);
  assert.ok(validateExactIdentities({ ...identities, runtimeSha: null }).length > 0);
  assert.ok(validateExactIdentities({ ...identities, docsSha: 'A'.repeat(40) }).length > 0);
  assert.ok(validateExactIdentities({ ...identities, gatewayUrl: 'http://gateway' }).length > 0);
});

test('requires exact gateway, diagnostics, Tempo, and disposable-session readiness', () => {
  const receipt = {
    gateway: {
      url: identities.gatewayUrl,
      targetId: identities.gatewayId,
      instanceId: 'instance-a',
      reachable: true,
      configValid: true,
      runtimeExactMatches: true,
    },
    observability: {
      diagnosticsOtelLoaded: true,
      tempoQueryReachable: true,
      tempoIntakeReachable: true,
    },
    disposableSession: { id: identities.sessionId, created: true, cleaned: true },
  };
  assert.deepEqual(validateEnvironmentReceipt(receipt, identities), []);
  for (const mutation of [
    { gateway: { ...receipt.gateway, url: 'ws://127.0.0.1:9999' } },
    { gateway: { ...receipt.gateway, targetId: 'other', instanceId: 'other' } },
    { gateway: { ...receipt.gateway, runtimeExactMatches: false } },
    { observability: { ...receipt.observability, diagnosticsOtelLoaded: false } },
    { observability: { ...receipt.observability, tempoQueryReachable: false } },
    { observability: { ...receipt.observability, tempoIntakeReachable: false } },
    { disposableSession: { ...receipt.disposableSession, created: false } },
    { disposableSession: { ...receipt.disposableSession, cleaned: false } },
  ]) {
    assert.ok(validateEnvironmentReceipt({ ...receipt, ...mutation }, identities).length > 0);
  }
});

test('rejects stale, unsigned, consumed, cross-run, cross-session, and cross-SHA receipts', () => {
  const expected = {
    row: 'R-PRODUCER',
    runId: identities.runId,
    sessionId: identities.sessionId,
    productSha: identities.productSha,
    runtimeSha: identities.runtimeSha,
    docsSha: identities.docsSha,
    corpusSha: identities.corpusSha,
    seat: identities.seat,
  };
  const valid = {
    ...expected,
    verdict: 'PASS',
    signed: true,
    consumptionState: 'fresh',
    issuedAt: '2026-09-03T23:00:00Z',
    expiresAt: '2026-09-04T01:00:00Z',
  };
  const signingKey = Buffer.from('test-signing-key');
  valid.signatureDigest = signProducerReceipt(valid, signingKey);
  const options = { signingKey, now: Date.parse('2026-09-04T00:00:00Z') };
  assert.deepEqual(validateProducerReceipt(valid, expected, options), []);
  for (const mutation of [
    { signed: false },
    { consumptionState: 'consumed' },
    { runId: 'other-run' },
    { sessionId: 'other-session' },
    { productSha: 'c'.repeat(40) },
    { runtimeSha: 'd'.repeat(40) },
    { verdict: 'PARTIAL' },
    { expiresAt: '2026-09-03T23:30:00Z' },
  ]) {
    assert.ok(validateProducerReceipt({ ...valid, ...mutation }, expected, options).length > 0);
  }
});

test('accepts only numeric receipt-backed R-RC-2 honest limit in a terminal rollup', () => {
  const evidence = {
    row: 'R-RC-2',
    parent_delegate_argument_policy_valid: true,
    parent_delegate_tool_call_count: 1,
    parent_delegate_arguments_exact: true,
    parent_delegate_argument_keys: ['delaySeconds', 'mode', 'task'],
    parent_dispatch_accepted: true,
    delegate_requested: true,
    child_session_observed: true,
    delegate_child_report_observed: true,
    child_reported_context_threshold: true,
    request_compaction_tool_result_observed: true,
    request_compaction_receipt_role: 'toolResult',
    request_compaction_receipt_tool_name: 'request_compaction',
    request_compaction_receipt_status: 'rejected',
    request_compaction_invocation_bound: true,
    request_compaction_rejected_context_threshold: true,
    guard: 'context_threshold',
    context_usage: 10,
    threshold: 70,
    reported_context_usage: 10,
    reported_threshold: 70,
  };
  assert.deepEqual(validateTerminalRollup([
    { row: 'R-CW-1', verdict: 'PASS' },
    { row: 'R-RC-2', verdict: 'HONEST-LIMIT', evidence },
  ]), []);
  assert.ok(validateTerminalRollup([{ row: 'R-CW-1', verdict: 'PASS' }], ['R-CW-1', 'R-CW-2']).length > 0);
  assert.ok(validateTerminalRollup([
    { row: 'R-CW-1', verdict: 'PASS' },
    { row: 'R-CW-1', verdict: 'PASS' },
  ], ['R-CW-1']).length > 0);
  for (const row of [
    { row: 'R-CW-1', verdict: 'PARTIAL' },
    { row: 'R-CW-1', verdict: 'MISSING' },
    { row: 'R-CW-1', verdict: 'THIN' },
    { row: 'R-CW-1', verdict: 'FAIL' },
    { row: 'R-CW-1', verdict: 'HONEST-LIMIT', evidence },
    { row: 'R-RC-2', verdict: 'HONEST-LIMIT', evidence: { ...evidence, context_usage: null } },
    { row: 'R-RC-2', verdict: 'HONEST-LIMIT', evidence: { ...evidence, context_usage: '10' } },
  ]) {
    assert.ok(validateTerminalRollup([row]).length > 0);
  }
});

test('publishes safe stale-flow metadata and fails closed on an unbound queued proof flow', () => {
  const result = classifyManagedFlows({
    inventory: {
      flows: [{
        flowId: 'secret-flow-id',
        ownerKey: 'agent:main:private-session',
        syncMode: 'managed',
        controllerId: 'core/continuation-delegate',
        status: 'queued',
        goal: 'Post-compaction delegate: R-CD-3 post-compaction lifeboat nonce private',
        updatedAt: 1000,
        taskSummary: { active: 0, total: 0 },
        stateJson: {},
      }],
    },
    identities,
    nowMs: 6000,
  });
  assert.equal(result.failures.length, 1);
  assert.equal(result.inventory[0].row, 'R-CD-3');
  assert.equal(result.inventory[0].ageSeconds, 5);
  assert.equal(result.inventory[0].namespace, 'historical-or-unbound');
  assert.equal(result.inventory[0].contaminating, true);
  assert.doesNotMatch(JSON.stringify(result), /secret-flow-id|private-session|nonce private/);
});

test('inventories unlabeled managed proof flows instead of silently dropping them', () => {
  const result = classifyManagedFlows({
    inventory: {
      flows: [{
        flowId: 'unknown-proof-flow',
        ownerKey: 'private-owner',
        syncMode: 'managed',
        controllerId: 'proof-controller',
        status: 'running',
        goal: 'continuation qualification',
        updatedAt: 1000,
        taskSummary: { active: 0, total: 0 },
        stateJson: {},
      }],
    },
    identities,
    nowMs: 2000,
  });
  assert.equal(result.inventory.length, 1);
  assert.equal(result.inventory[0].row, null);
  assert.equal(result.inventory[0].contaminating, true);
  assert.equal(result.failures.length, 1);
});

test('explicit consumer catalog dependencies override generic runnable classification', async () => {
  const manifestNames = ['r-cd-return-overlap.json', 'r-obs-2.json'];
  const manifests = await Promise.all(manifestNames.map(async (name) =>
    JSON.parse(await readFile(path.join(root, 'tools/k6-proofs/manifests', name), 'utf8'))));
  const catalog = JSON.parse(await readFile(
    path.join(root, 'tools/k6-proofs/qualification/producer-catalog.json'),
    'utf8',
  ));
  const result = validateProducerCatalog({
    requiredRows: ['R-CD-RETURN-OVERLAP', 'R-OBS-2'],
    manifests,
    catalog,
    docsRoot: root,
    productRoot: root,
  });
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.producers['R-CD-RETURN-OVERLAP'].dependsOn, ['R-CD-RETURN-COVENANT-AUTHORITY']);
  assert.equal(result.producers['R-OBS-2'].dependsOn.length, 18);
});

test('the built-in hostile suite exercises every required rejection class', () => {
  const controls = runHostileControls();
  assert.equal(controls.ok, true);
  assert.deepEqual(
    controls.controls.map((control) => control.name),
    [
      'malformed-sha',
      'null-numeric',
      'wrong-row-receipt',
      'cross-run-receipt',
      'cross-session-receipt',
      'cross-sha-receipt',
      'stale-receipt',
      'consumed-receipt',
      'unsigned-receipt',
      'partial-rollup',
      'legacy-seat-label-not-gate',
      'stale-flow',
    ],
  );
});

test('both live workflows require and propagate an exact runtime SHA', async () => {
  for (const workflow of ['project81-k6-proof.yml', 'k6-proof.yml']) {
    const source = await readFile(path.join(root, '.github/workflows', workflow), 'utf8');
    assert.match(source, /runtime_sha:/);
    assert.match(source, /runtime_sha must be a 40-char hex string when dry_run=false/);
    assert.match(source, /OPENCLAW_RUNTIME_BUILD_SHA: \$\{\{ (?:github\.event\.)?inputs\.runtime_sha \}\}/);
  }
});

test('the runner waives trace debt only for receipt-backed R-RC-2 honest limit', async () => {
  const source = await readFile(path.join(root, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');
  assert.match(
    source,
    /ROW_ID" == "R-RC-2" && "\$SUMMARY_VERDICT" == "HONEST-LIMIT-candidate"[\s\S]+TRACE_REQUIRED=false/u,
  );
  assert.doesNotMatch(source, /ROW_ID" != "R-RC-2"[\s\S]{0,120}TRACE_REQUIRED=false/u);
});
