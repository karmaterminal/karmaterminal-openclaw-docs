import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildProducerRegistry,
  resolveProducerPlan,
} from '../../lib/producer-catalog.mjs';
import { lifecycleEvent } from '../../lib/producer-live-harness.js';
import { validateLineage } from '../collect-live-producer-lineage.mjs';
import { extractEvidence } from '../extract-k6-evidence.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const proofsDir = path.join(repoRoot, 'tools/k6-proofs');

async function json(relative) {
  return JSON.parse(await readFile(path.join(proofsDir, relative), 'utf8'));
}

test('restored behavioral rows never resolve to static validators', () => {
  const registry = buildProducerRegistry({ proofsDir });
  assert.deepEqual(registry.failures, []);
  for (const rowId of [
    'R-CD-COLLECTION-ON-COLLAPSE',
    'R-CW-7',
    'R-CW-DELEGATE-CHILD-LIVE',
    'R-CW-DELEGATE-TOKEN',
    'R-CW-MULTI',
  ]) {
    assert.equal(registry.rows[rowId].classification, 'behavioral-live');
    assert.notEqual(registry.rows[rowId].scenario, 'static-corpus-row-validator.js');
  }
  assert.equal(registry.rows['R-CW-MULTI-COLLAPSE'].classification, 'process-local');
  assert.ok(registry.rows['R-CW-7'].prerequisite);
  assert.equal(registry.rows['R-CW-7'].requiresLiveTrace, true);
  assert.doesNotMatch(registry.rows['R-CW-5'].argv.join(' '), /--pnpm-node-modules/);
});

test('live producer lifecycle accepts successful end events without invented settlement fields', () => {
  const classified = {
    kind: 'event',
    event: 'agent',
    data: {
      sessionKey: 'agent:test',
      runId: 'run-1',
      stream: 'lifecycle',
      data: { phase: 'end', status: 'ok' },
    },
  };
  assert.deepEqual(lifecycleEvent(classified, 'agent:test', 'run-1'), {
    sessionKey: 'agent:test',
    runId: 'run-1',
    phase: 'end',
    startedAt: null,
    endedAt: null,
    succeeded: true,
  });
});

test('live producer lifecycle preserves the explicit terminal status allowlist', () => {
  for (const data of [
    { phase: 'end', status: 'failed' },
    { phase: 'error' },
  ]) {
    const lifecycle = lifecycleEvent({
      kind: 'event',
      event: 'agent',
      data: {
        sessionKey: 'agent:test',
        runId: 'run-1',
        stream: 'lifecycle',
        data,
      },
    }, 'agent:test', 'run-1');
    assert.equal(lifecycle.phase, 'error');
    assert.equal(lifecycle.succeeded, false);
  }

  const successful = lifecycleEvent({
    kind: 'event',
    event: 'agent',
    data: {
      sessionKey: 'agent:test',
      runId: 'run-1',
      stream: 'lifecycle',
      data: { phase: 'end', status: 'ok', replayInvalid: true },
    },
  }, 'agent:test', 'run-1');
  assert.equal(successful.phase, 'end');
  assert.equal(successful.succeeded, true);
});

test('catalog fails a required behavioral row backed only by a static validator', () => {
  const registry = buildProducerRegistry({
    proofsDir,
    catalog: {
      schema: 'test',
      requiredBehavioralRows: ['R-CW-7'],
      defaults: {
        'k6-runnable': 'behavioral-live',
        'static-preflight-only': 'static-only',
        'construct-only': 'construct-only',
      },
      rows: { 'R-CW-7': { classification: 'behavioral-live', scenario: 'static-corpus-row-validator.js' } },
    },
  });
  assert.ok(registry.failures.some((failure) => failure.code === 'producer.behavioral-static-only'));
});

test('dependency-gated consumers require fresh exact candidate and docs receipts', () => {
  const registry = buildProducerRegistry({ proofsDir });
  const base = {
    rowId: 'R-CD-RETURN-COVENANT-AUTHORITY',
    verdict: 'PASS',
    fresh: true,
    issuedAt: '2026-04-12T00:00:00.000Z',
    expiresAt: '2026-04-12T02:00:00.000Z',
    candidateSha: 'a'.repeat(40),
    docsSha: 'b'.repeat(40),
  };
  for (const receipt of [
    { ...base, fresh: false },
    { ...base, candidateSha: 'c'.repeat(40) },
    { ...base, docsSha: 'd'.repeat(40) },
  ]) {
    const plan = resolveProducerPlan({
      selection: 'R-CD-RETURN-OVERLAP',
      registry,
      receipts: [receipt],
      candidateSha: 'a'.repeat(40),
      docsSha: 'b'.repeat(40),
      nowMs: Date.parse('2026-04-12T01:00:00.000Z'),
    });
    assert.equal(plan.ok, false);
    assert.deepEqual(plan.blocked[0].missingDependencies, ['R-CD-RETURN-COVENANT-AUTHORITY']);
  }
  const unbound = resolveProducerPlan({
    selection: 'R-CD-RETURN-OVERLAP',
    registry,
    receipts: [base],
    nowMs: Date.parse('2026-04-12T01:00:00.000Z'),
  });
  assert.equal(unbound.ok, false);
  assert.deepEqual(unbound.blocked[0].missingDependencies, ['R-CD-RETURN-COVENANT-AUTHORITY']);

  const authorityPlan = resolveProducerPlan({
    selection: 'R-CD-RETURN-COVENANT-AUTHORITY',
    registry,
    receipts: [base],
    candidateSha: 'a'.repeat(40),
    docsSha: 'b'.repeat(40),
    nowMs: Date.parse('2026-04-12T01:00:00.000Z'),
  });
  assert.equal(authorityPlan.ok, true);
  assert.equal(authorityPlan.rows[0].ownReceiptSatisfied, true);
  assert.deepEqual(authorityPlan.blocked, []);

  const overlap = {
    ...base,
    rowId: 'R-CD-RETURN-OVERLAP',
  };
  const overlapPlan = resolveProducerPlan({
    selection: 'R-CD-RETURN-OVERLAP',
    registry,
    receipts: [base, overlap],
    candidateSha: 'a'.repeat(40),
    docsSha: 'b'.repeat(40),
    nowMs: Date.parse('2026-04-12T01:00:00.000Z'),
  });
  assert.equal(overlapPlan.ok, true);
  assert.deepEqual(overlapPlan.blocked, []);
});

test('restored live producers emit evidence in the extractor contract', async () => {
  for (const file of [
    'r-cd-collection-on-collapse-producer.js',
    'r-cw-7-producer.js',
    'r-cw-delegate-child-live-producer.js',
    'r-cw-delegate-token-producer.js',
    'r-cw-multi-producer.js',
  ]) {
    const source = await readFile(path.join(proofsDir, 'scenarios', file), 'utf8');
    assert.match(source, /console\.log\(`\\n--- \$\{ROW\} EVIDENCE SUMMARY ---`\);/u);
    assert.match(source, /console\.log\(JSON\.stringify\(evidence, null, 2\)\);/u);
    assert.match(source, /console\.log\('--- END EVIDENCE ---'\);/u);
  }
  const record = { row: 'R-CW-MULTI', producer: true };
  const line = (message) =>
    `time="2026-09-05T00:00:00Z" level=info msg=${JSON.stringify(message)} source=console`;
  const log = [
    line('--- R-CW-MULTI EVIDENCE SUMMARY ---'),
    line(JSON.stringify(record, null, 2)),
    line('--- END EVIDENCE ---'),
  ].join('\n');
  assert.deepEqual(extractEvidence(log), [record]);
});

test('collection manifest uses supported mode and exact rendered tasks', async () => {
  const manifest = await json('manifests/r-cd-collection-on-collapse.json');
  assert.equal(manifest.invocation.mode, 'normal');
  assert.equal(manifest.invocation.fanoutMode, 'tree');
  assert.match(manifest.invocation.promptTemplate, /\{\{nonce\}\}/u);
  assert.match(manifest.invocation.spawnPromptTemplate, /\{\{cTaskJson\}\}/u);
  assert.notEqual(manifest.invocation.mode, 'session');
  assert.notEqual(manifest.invocation.mode, 'run');
  const scenario = await readFile(
    path.join(proofsDir, 'scenarios/r-cd-collection-on-collapse-producer.js'),
    'utf8',
  );
  assert.match(scenario, /identity\.data\.args\?\.mode === evidence\.delegate_mode/u);
  assert.match(scenario, /identity\.data\.args\?\.fanoutMode === evidence\.fanout_mode/u);
  assert.match(scenario, /evidence\.b_delegate_tool_scheduled/u);
});

test('delegate token uses exact grammar and rejects typed/message-tool substitutes', async () => {
  const manifest = await json('manifests/r-cw-delegate-token.json');
  assert.equal(manifest.invocation.lightContext, true);
  assert.match(manifest.invocation.promptTemplate, /\{\{token\}\}/u);
  const scenario = await readFile(path.join(proofsDir, 'scenarios/r-cw-delegate-token-producer.js'), 'utf8');
  assert.match(scenario, /classified\.payload\?\.groups/u);
  assert.match(scenario, /tool\?\.id/u);
  assert.match(scenario, /if \(!classified\.ok/u);
  assert.doesNotMatch(scenario, /classified\.payload\?\.tools/u);
  const evidence = {
    child_session_key: 'agent:main:subagent:child',
    child_initial_run_id: 'run-1',
    child_continue_work_tool_present: false,
    typed_continue_work_observed: false,
    message_tool_body_token_observed: false,
  };
  const flow = {
    flowId: 'flow-1',
    controllerId: 'core/continuation-work',
    ownerKey: evidence.child_session_key,
    status: 'succeeded',
    stateJson: { originRunId: evidence.child_initial_run_id, disposition: 'granted' },
  };
  const log = [
    '[continuation:trace] bracket-parse: kind=work delayMs=5000 session=agent:main:subagent:child',
    '[continuation:trace] effective-signal: origin=bracket kind=work session=agent:main:subagent:child',
  ].join('\n');
  const accepted = validateLineage({
    row: 'R-CW-DELEGATE-TOKEN', evidence, manifest, flows: [flow], gatewayLog: log,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.flows[0].originRunId, undefined);
  assert.match(accepted.flows[0].originRunFingerprint, /^[0-9a-f]{16}$/u);
  assert.equal(validateLineage({
    row: 'R-CW-DELEGATE-TOKEN',
    evidence: { ...evidence, message_tool_body_token_observed: true },
    manifest,
    flows: [flow],
    gatewayLog: log,
  }).ok, false);
});

test('lineage collector errors never echo private flow inventory content', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lineage-error-test-'));
  const secret = 'agent:main:secret-session-key-abc123';
  try {
    await writeFile(path.join(dir, 'evidence.jsonl'), '{}\n');
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
      rowId: 'R-CW-MULTI',
      invocation: { elections: [] },
    }));
    await writeFile(path.join(dir, 'flows.json'), `{"flows":[{"ownerKey":"${secret}","x":]}`);
    const run = spawnSync(process.execPath, [
      path.join(proofsDir, 'scripts/collect-live-producer-lineage.mjs'),
      '--row', 'R-CW-MULTI',
      '--evidence', path.join(dir, 'evidence.jsonl'),
      '--manifest', path.join(dir, 'manifest.json'),
      '--out', path.join(dir, 'out.json'),
      '--flow-json', path.join(dir, 'flows.json'),
    ], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.equal(run.stderr.trim(), 'live producer lineage collection failed');
    assert.doesNotMatch(run.stderr, new RegExp(secret, 'u'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('R-CW-7 discovers trace post-run and requires successor topology', async () => {
  const manifest = await json('manifests/r-cw-7.json');
  const scenario = await readFile(path.join(proofsDir, 'scenarios/r-cw-7-producer.js'), 'utf8');
  const collector = await readFile(path.join(proofsDir, 'scripts/collect-continuation-trace.mjs'), 'utf8');
  assert.equal(manifest.invocation.requireSuccessorSpan, true);
  assert.doesNotMatch(scenario, /payload\?\.traceId/u);
  assert.match(collector, /lacks a successor\/provider span/u);
});

test('restored live producers fail runtime identity per row and bind hop-two output to its run', async () => {
  const runner = await readFile(path.join(proofsDir, 'scripts/run-proofs.sh'), 'utf8');
  assert.match(runner, /restored-producer-build-identity-gate\.v1/u);
  assert.match(runner, /ROWS_TERMINAL_PRE_DISPATCH=\$\(\(ROWS_TERMINAL_PRE_DISPATCH \+ 1\)\)/u);
  assert.doesNotMatch(
    runner,
    /fail_harness[\s\S]{0,200}restored behavioral producers require exact candidate\/runtime SHA equality/u,
  );

  for (const file of [
    'scenarios/r-cw-7-producer.js',
    'scenarios/r-cw-delegate-child-live-producer.js',
    'scenarios/r-cw-delegate-token-producer.js',
  ]) {
    const scenario = await readFile(path.join(proofsDir, file), 'utf8');
    assert.match(
      scenario,
      /evidence\.hop_two_run_id\s*\?\s*assistantTextEvent\(/u,
      `${file} must not accept hop-one text as hop-two output`,
    );
  }
});

test('process-local rows use private artifact directories and emit standard terminal results', async () => {
  const runner = await readFile(path.join(proofsDir, 'scripts/run-proofs.sh'), 'utf8');
  assert.match(runner, /\(umask 077; mkdir -p "\$PROCESS_RUN_DIR"\)/u);
  assert.match(runner, /"\$PROCESS_RUN_DIR\/run-result\.json"/u);
  assert.match(runner, /verdictSource:"process-local-producer"/u);
  assert.match(runner, /verdictSource:"process-local-prerequisite-unavailable"/u);
  assert.match(runner, /verdictSource:"process-local-prerequisite-failed"/u);
  assert.match(runner, /fixture-result\.json/u);
  assert.match(runner, /if \[\[ "\$process_rc" -ne 0 \]\]; then\s+process_verdict="FAIL-fixture"/u);
  assert.match(runner, /-z "\$process_result_file" \|\| -z "\$process_verdict"/u);
  assert.match(runner, /elif \[\[ "\$process_verdict" != "PASS-candidate" \]\]; then\s+process_rc=1/u);
  assert.match(runner, /openclaw\.k6\.process-local-prerequisite-receipt\.v1/u);
  assert.match(runner, /verdictSource:"process-local-prerequisite-missing"/u);
  assert.match(runner, /"process-local-propagation-tests","live-behavioral-receipt"/u);
  assert.doesNotMatch(runner, /process-local-prerequisite\/stdout\.log/u);
  assert.doesNotMatch(runner, /process-local-prerequisite\/stderr\.log/u);
});

test('required Tempo evidence fails postprocessing instead of remaining review-only', async () => {
  const runner = await readFile(path.join(proofsDir, 'scripts/run-proofs.sh'), 'utf8');
  assert.match(
    runner,
    /TRACE CORRELATION FAILED; see \$COLLECTOR_ERROR[\s\S]{0,80}POSTPROCESS_RC=1/u,
  );
  assert.match(
    runner,
    /elif \[\[ "\$TRACE_REQUIRED" == "true" \]\]; then\s+TRACE_STATUS="missing"\s+POSTPROCESS_RC=1/u,
  );
});

test('multi rejects duplicate flows and repeated/multiply-labelled wakes', async () => {
  const manifest = await json('manifests/r-cw-multi.json');
  assert.deepEqual(manifest.invocation.forms, ['typed-tool', 'response-token']);
  const nonce = 'NONCE';
  const evidence = {
    nonce,
    session_key: 'session',
    origin_run_id: 'origin',
    token_origin_run_id: 'token-origin',
    token_wake_run_id: 'token-wake',
    token_wake_terminal_phase: 'end',
    token_wake_sentinel_bound: true,
    wake_runs: [
      { startedAt: 1, endedAt: 2, terminalPhase: 'end', labels: ['immediate', 'delay-60'] },
      { startedAt: 1, endedAt: 2, terminalPhase: 'end', labels: ['delay-120'] },
      { startedAt: 1, endedAt: 2, terminalPhase: 'end', labels: ['delay-120'] },
    ],
  };
  const reason = manifest.invocation.elections[0].reason.replaceAll('{{nonce}}', nonce);
  const duplicated = [0, 1, 2].map(() => ({
    flowId: 'same-flow',
    controllerId: 'core/continuation-work',
    ownerKey: 'session',
    status: 'succeeded',
    stateJson: { reason, delayMs: 0, originRunId: 'origin', disposition: 'granted' },
  }));
  const result = validateLineage({
    row: 'R-CW-MULTI', evidence, manifest, flows: duplicated,
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('three distinct work flowIds')));
  assert.ok(result.failures.some((failure) => failure.includes('uniquely labelled wake runs')));
});

test('multi accepts three typed elections plus one isolated response-token parity flow', async () => {
  const manifest = await json('manifests/r-cw-multi.json');
  const nonce = 'NONCE';
  const evidence = {
    nonce,
    session_key: 'session',
    origin_run_id: 'typed-origin',
    token_origin_run_id: 'token-origin',
    token_wake_run_id: 'token-wake',
    token_wake_terminal_phase: 'end',
    token_wake_sentinel_bound: true,
    wake_runs: manifest.invocation.elections.map((entry, index) => ({
      startedAt: index + 1,
      endedAt: index + 2,
      terminalPhase: 'end',
      labels: [entry.label],
    })),
  };
  const typed = manifest.invocation.elections.map((entry, index) => ({
    flowId: `typed-flow-${index}`,
    controllerId: 'core/continuation-work',
    ownerKey: evidence.session_key,
    status: 'succeeded',
    stateJson: {
      reason: entry.reason.replaceAll('{{nonce}}', nonce),
      delayMs: entry.delaySeconds * 1000,
      originRunId: evidence.origin_run_id,
      disposition: 'granted',
    },
  }));
  const token = {
    flowId: 'token-flow',
    controllerId: 'core/continuation-work',
    ownerKey: evidence.session_key,
    status: 'succeeded',
    stateJson: {
      reason: '',
      delayMs: 0,
      originRunId: evidence.token_origin_run_id,
      disposition: 'granted',
    },
  };
  const gatewayLog = [
    '[continuation:trace] bracket-parse: kind=work delayMs=0 session=session',
    '[continuation:trace] effective-signal: origin=bracket kind=work session=session',
  ].join('\n');
  const result = validateLineage({
    row: 'R-CW-MULTI',
    evidence,
    manifest,
    flows: [...typed, token],
    gatewayLog,
  });
  assert.equal(result.ok, true);
  assert.equal(result.flows.length, 4);
  assert.equal(result.flows.every((flow) => flow.flowId === undefined), true);
  assert.equal(result.flows.every((flow) => /^[0-9a-f]{16}$/u.test(flow.flowIdFingerprint)), true);
  const runner = await readFile(path.join(proofsDir, 'scripts/run-proofs.sh'), 'utf8');
  assert.match(
    runner,
    /"\$ROW_ID" == "R-CW-DELEGATE-TOKEN" \|\| "\$ROW_ID" == "R-CW-MULTI"[\s\S]{0,100}LINEAGE_ARGS\+=\(--gateway-log "\$PRIVATE_GATEWAY_LOG"\)/u,
  );
  assert.match(runner, /SUMMARY_VERDICT_SOURCE="live-producer-lineage-failed"/u);
  assert.match(runner, /\$current \+ \["taskflow-lineage"\] \| unique/u);
  assert.match(runner, /\$current \+ \["bracket-parser-origin"\] \| unique/u);
});

test('delegate-child lineage fails without the parent delegate flow', async () => {
  const manifest = await json('manifests/r-cw-delegate-child-live.json');
  const evidence = {
    nonce: 'NONCE',
    parent_session_key: 'parent-session',
    parent_run_id: 'parent-run',
    delegate_flow_id: 'delegate-flow',
    child_session_key: 'child-session',
    child_initial_run_id: 'child-run',
  };
  const result = validateLineage({
    row: 'R-CW-DELEGATE-CHILD-LIVE',
    evidence,
    manifest,
    flows: [{
      flowId: 'work-flow',
      controllerId: 'core/continuation-work',
      ownerKey: evidence.child_session_key,
      status: 'succeeded',
      stateJson: {
        reason: manifest.invocation.reason.replaceAll('{{nonce}}', evidence.nonce),
        originRunId: evidence.child_initial_run_id,
        disposition: 'granted',
      },
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('parent-owned delegate flow')));
});

test('restored source does not import return-covenant implementation or corpus artifacts', async () => {
  const files = [
    'qualification/producer-catalog.json',
    'scripts/collect-live-producer-lineage.mjs',
    'scripts/run-catalog-producer.mjs',
    'scenarios/r-cd-collection-on-collapse-producer.js',
    'scenarios/r-cw-7-producer.js',
    'scenarios/r-cw-delegate-child-live-producer.js',
    'scenarios/r-cw-delegate-token-producer.js',
    'scenarios/r-cw-multi-producer.js',
  ];
  const source = (await Promise.all(files.map((file) => readFile(path.join(proofsDir, file), 'utf8')))).join('\n');
  assert.doesNotMatch(source, /return-covenant-fixture|PROOFS\/7cb9|#536 implementation/u);
});
