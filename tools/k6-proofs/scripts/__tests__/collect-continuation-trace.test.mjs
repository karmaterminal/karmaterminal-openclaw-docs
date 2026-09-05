import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  rCd2AuthorityIdentity,
  resolveRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';
import {
  R_CD_2_SELECTION_RECEIPT_FILE,
  signRcd2SelectedContextReceipt,
} from '../../lib/r-cd-2-authority-context.mjs';
import { publicTempoStatusCode } from '../../lib/public-tempo-trace.mjs';

const execFileAsync = promisify(execFile);
const rCd2SigningKey = 'collect-continuation-trace-r-cd-2-test-key';
process.env.OPENCLAW_GATEWAY_TOKEN ||= rCd2SigningKey;
const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../collect-continuation-trace.mjs',
);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const preservedTracePaths = {
  delegate: path.join(
    repoRoot,
    'PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/artifacts/silas-lothric/comparator-20260719/prior-two-row/raw/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-1/silas/20260719T191117Z-r-cd-1/tempo-trace-postrun.json',
  ),
  work: path.join(
    repoRoot,
    'PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/artifacts/silas-lothric/comparator-20260719/prior-two-row/raw/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-1/silas/20260719T191326Z-r-cw-1/tempo-trace-postrun.json',
  ),
};
const fixtureRoots = new Set();
process.once('exit', () => {
  for (const root of fixtureRoots) rmSync(root, { recursive: true, force: true });
});

function b64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

function attr(key, value) {
  return {
    key,
    value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value },
  };
}

function span(name, traceId, spanId, parentSpanId, attrs = [], status = 'OK', timing = {}) {
  return {
    name,
    traceId: b64(traceId),
    spanId: b64(spanId),
    parentSpanId: b64(parentSpanId),
    attributes: attrs,
    status: { code: status },
    ...timing,
  };
}

function publicAttrValue(spanEntry, key) {
  const value = spanEntry.attributes?.find((entry) => entry.key === key)?.value;
  return value?.stringValue ?? value?.intValue ?? value?.boolValue;
}

function withRawContinuationStatuses(trace) {
  return {
    ...trace,
    spans: trace.spans.map((entry) => ({
      ...entry,
      status: entry.name.startsWith('continuation.')
        ? { code: 'STATUS_CODE_OK' }
        : entry.status,
    })),
  };
}

function traceFixture({ traceId, reasonHash, reasonLength, tool = 'continue_delegate', mode = 'normal', toolCount = 1 }) {
  const parent = 'dddddddddddddddd';
  const isWork = tool === 'continue_work';
  const acceptSpanName = isWork ? 'continuation.work' : 'continuation.delegate.dispatch';
  const fireSpanName = isWork ? 'continuation.work.fire' : 'continuation.delegate.fire';
  const toolOriginNs = 1785580554339000000n;
  const fireNs = toolOriginNs + 5000000000n;
  const continuationAttrs = [
    attr('chain.id', '11111111-1111-4111-8111-111111111111'),
    attr('reason.hash', reasonHash),
    attr('reason.length', reasonLength),
    attr('delay.ms', 5000),
    ...(isWork ? [] : [attr('delegate.mode', mode)]),
  ];
  return {
    batches: [{
      scopeSpans: [{
        spans: [
          ...Array.from({ length: toolCount }, (_, index) => span(
            'openclaw.tool.execution',
            traceId,
            index === 0 ? 'aaaaaaaaaaaaaaaa' : 'ffffffffffffffff',
            parent,
            [attr('gen_ai.tool.name', tool)],
            'OK',
            {
              startTimeUnixNano: String(toolOriginNs - 1000000n + BigInt(index)),
              endTimeUnixNano: String(toolOriginNs + BigInt(index)),
            },
          )),
          span(
            fireSpanName,
            traceId,
            'bbbbbbbbbbbbbbbb',
            parent,
            [...continuationAttrs, attr('fire.deferred_ms', 5000)],
            'OK',
            { startTimeUnixNano: String(fireNs), endTimeUnixNano: String(fireNs + 1000n) },
          ),
          span(
            acceptSpanName,
            traceId,
            'cccccccccccccccc',
            parent,
            continuationAttrs,
            'OK',
            { startTimeUnixNano: String(fireNs), endTimeUnixNano: String(fireNs + 1000000n) },
          ),
          span('openclaw.harness.run', traceId, 'eeeeeeeeeeeeeeee', 'cccccccccccccccc'),
        ],
      }],
    }],
  };
}

function toolTraceFixture({ traceId, tool }) {
  return {
    batches: [{
      scopeSpans: [{
        spans: [
          span('openclaw.tool.execution', traceId, 'aaaaaaaaaaaaaaaa', 'dddddddddddddddd', [
            attr('gen_ai.tool.name', tool),
            attr('openclaw.toolName', tool),
          ]),
          span('openclaw.harness.run', traceId, 'dddddddddddddddd', 'eeeeeeeeeeeeeeee'),
        ],
      }],
    }],
  };
}

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function fixtureDir({
  tool = 'continue_delegate',
  workVariant = 'reason',
  includeNonce = true,
  rowId,
  delegateMode,
  nonceOverride,
  extraEvidence = {},
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'continuation-trace-test-'));
  const isWork = tool === 'continue_work';
  const isReasonPrefix = isWork && workVariant === 'reason-prefix';
  const resolvedRowId = rowId || (isReasonPrefix ? 'R-CW-3' : isWork ? 'R-CW-1' : 'R-CD-1');
  const rCd2 = resolvedRowId === 'R-CD-2';
  const candidateSha = '1'.repeat(40);
  const docsRef = '3'.repeat(40);
  const seat = 'cael-prince';
  const matrixId = '20260905T032057Z-333333333333-deadbeef';
  const runId = '20260905T032100Z-r-cd-2-deadbeef';
  const dir = rCd2
    ? path.join(root, candidateSha, resolvedRowId, seat, runId)
    : root;
  if (rCd2) {
    fixtureRoots.add(root);
    await mkdir(dir, { recursive: true });
  }
  const generatedNonce = isReasonPrefix
    ? 'R-CW-3-example'
    : isWork
      ? 'R-CW-1-example'
      : 'R-CD-1-example';
  const nonce = nonceOverride || generatedNonce;
  const template = isReasonPrefix
    ? 'k6-proof-R-CW-3-redaction RAW-RCW3-{{nonce}}; on continuation wake reply exactly CW3-WOKE {{nonce}}'
    : isWork
      ? 'k6-proof-R-CW-1-{{nonce}} -- on continuation wake reply exactly CW-WOKE {{nonce}}'
    : 'Proof nonce {{nonce}}: reply exactly CD1-DONE {{nonce}} only.';
  const templatedReason = template.replaceAll('{{nonce}}', nonce);
  const reason = templatedReason;
  const reasonHash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
  const manifest = {
    ...(rCd2 ? {
      schema: 'openclaw.k6.proof-row-manifest.v1',
      candidateSha,
      seat,
      transport: 'websocket',
      toolSurface: 'typed-tool',
      scenario: { name: 'r-cd-2-silent-wake', file: 'r-cd-2-silent-wake.js' },
      review: { candidateOnly: true, foldRequiresReview: true },
      liveRunSafety: {
        expectedArtifactClass: 'PASS-candidate',
        foldRequiresReview: true,
        requiredReceipts: ['dispatch-accepted', 'parent-wake-event', 'no-channel-delivery'],
      },
    } : {}),
    rowId: resolvedRowId,
    invocation: isWork
      ? { tool, reason: template }
      : { tool, mode: delegateMode || 'normal', promptTemplate: template },
  };
  const evidence = {
    row: manifest.rowId,
    ...(includeNonce ? { nonce } : {}),
    started: '2026-07-12T22:15:00.000Z',
    dispatch_accepted_at_ms: Date.parse('2026-07-12T22:15:10.000Z'),
    reason_hash: reasonHash,
    reason_length: reason.length,
    ...(isWork ? {} : { delegate_mode: delegateMode || 'normal' }),
    ...extraEvidence,
  };
  const manifestBody = JSON.stringify(manifest);
  const scenarioBody = 'export default function () {}\n';
  const manifestPath = path.join(dir, rCd2 ? 'row-manifest.json' : 'manifest.json');
  await writeFile(manifestPath, manifestBody);
  await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify(evidence)}\n`);
  if (rCd2) {
    const manifestSha256 = createHash('sha256').update(manifestBody).digest('hex');
    const scenarioSha256 = createHash('sha256').update(scenarioBody).digest('hex');
    await writeFile(path.join(dir, 'row-scenario.js'), scenarioBody);
    await writeFile(path.join(dir, 'runner-metadata.json'), `${JSON.stringify({
      row: resolvedRowId,
      scenario: 'r-cd-2-silent-wake.js',
      candidateSha,
      runtimeBuildSha: candidateSha,
      seat,
      docsRef,
      repository: 'karmaterminal/karmaterminal-openclaw-docs',
      matrixId,
      runId,
      manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
      manifestSha256,
      scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
      scenarioSha256,
    })}\n`);
    const seatReadinessBody = `${JSON.stringify({
      schema: 'openclaw.k6.seat-readiness.v1',
      outcome: 'PASS-candidate',
      candidate: { sha: candidateSha, valid40Hex: true },
      seat: { name: seat, class: 'message-body' },
    })}\n`;
    const authorityIdentity = rCd2AuthorityIdentity({
      candidateSha,
      runtimeBuildSha: candidateSha,
      docsRef,
      repository: 'karmaterminal/karmaterminal-openclaw-docs',
      seat,
      matrixId,
      row: resolvedRowId,
      scenario: 'r-cd-2-silent-wake.js',
      manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
      manifestSha256,
      scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
      scenarioSha256,
    }, runId);
    const selectionReceipt = signRcd2SelectedContextReceipt({
      identity: authorityIdentity,
      signingKey: process.env.OPENCLAW_GATEWAY_TOKEN,
    });
    const provenance = {
      schema: 'openclaw.k6.harness-provenance.v1',
      classification: 'harness-provenance',
      matrixId,
      mode: 'live',
      docsRef,
      docsRefSource: 'approved-input',
      repository: 'karmaterminal/karmaterminal-openclaw-docs',
      harnessIdentityVerified: true,
      candidateSha,
      runtimeIdentity: {
        seat,
        runtimeBuildSha: candidateSha,
        candidateMatchesRuntime: true,
        seatReadinessReceipt: 'seat-readiness.json',
        seatReadinessSha256: createHash('sha256').update(seatReadinessBody).digest('hex'),
      },
      rowSelection: [resolvedRowId],
      rows: [{
        rowId: resolvedRowId,
        manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
        manifestSha256,
        scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
        scenarioSha256,
      }],
      candidateOnly: true,
      foldRequiresReview: true,
    };
    await mkdir(path.join(root, 'harness-provenance'), { recursive: true });
    await writeFile(path.join(root, 'seat-readiness.json'), seatReadinessBody);
    await writeFile(path.join(dir, 'seat-readiness.json'), seatReadinessBody);
    await writeFile(
      path.join(dir, R_CD_2_SELECTION_RECEIPT_FILE),
      `${JSON.stringify(selectionReceipt)}\n`,
    );
    await writeFile(
      path.join(root, 'harness-provenance', `${matrixId}.json`),
      `${JSON.stringify(provenance)}\n`,
    );
  }
  return { root, dir, manifestPath, reason, reasonHash, reasonLength: reason.length };
}

test('correlates a unique trace and validates tool/fire/dispatch topology', async () => {
  const fixture = await fixtureDir();
  const traceId = '11111111111111111111111111111111';
  let observedQuery = '';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      observedQuery = url.searchParams.get('q') || '';
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    response.end(JSON.stringify(traceFixture({
      traceId,
      reasonHash: fixture.reasonHash,
      reasonLength: fixture.reasonLength,
    })));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));

    assert.equal(result.traceId, traceId);
    assert.equal(receipt.reason.hash, fixture.reasonHash);
    assert.equal(receipt.reason.source, 'manifest-nonce');
    assert.equal(receipt.sameTrace, true);
    assert.equal(receipt.distinctSpans, true);
    assert.equal(receipt.stabilization.ingestionSettleMs, 10);
    assert.equal(receipt.stabilization.pollIntervalMs, 10);
    assert.ok(receipt.stabilization.searchQueryCount >= 2);
    assert.ok(receipt.stabilization.stabilizationQueryCount >= 1);
    assert.equal(receipt.stabilization.finalQueryCount, 1);
    assert.deepEqual(receipt.childSpans, [{
      name: 'openclaw.harness.run',
      spanId: 'eeeeeeeeeeeeeeee',
    }]);
    assert.match(observedQuery, new RegExp(`reason\\.hash="${fixture.reasonHash}"`));
    assert.doesNotMatch(JSON.stringify(receipt), /Proof nonce/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('treats the first valid Tempo trace as provisional until uniqueness stabilizes', async () => {
  const fixture = await fixtureDir();
  const traceA = '17171717171717171717171717171717';
  const traceB = '18181818181818181818181818181818';
  let searchCount = 0;
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      searchCount += 1;
      response.end(JSON.stringify({
        traces: searchCount === 1
          ? [{ traceID: traceA }]
          : [{ traceID: traceA }, { traceID: traceB }],
      }));
      return;
    }
    response.end(JSON.stringify(traceFixture({
      traceId: traceA,
      reasonHash: fixture.reasonHash,
      reasonLength: fixture.reasonLength,
    })));
  });

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        '--run-dir', fixture.dir,
        '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince',
        '--tempo-url', server.url,
        '--timeout-ms', '100',
        '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /trace correlation is ambiguous: 2 Tempo traces matched/);
        return true;
      },
    );
    assert.ok(searchCount >= 2);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('fails closed when the Tempo candidate set churns during stabilization', async () => {
  const fixture = await fixtureDir();
  const traceA = '19191919191919191919191919191919';
  const traceB = '20202020202020202020202020202020';
  let searchCount = 0;
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      searchCount += 1;
      response.end(JSON.stringify({
        traces: [{ traceID: searchCount === 1 ? traceA : traceB }],
      }));
      return;
    }
    response.end(JSON.stringify(traceFixture({
      traceId: traceA,
      reasonHash: fixture.reasonHash,
      reasonLength: fixture.reasonLength,
    })));
  });

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        '--run-dir', fixture.dir,
        '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince',
        '--tempo-url', server.url,
        '--timeout-ms', '100',
        '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /candidate set changed during stabilization/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('fails closed when no Tempo trace appears before the bounded timeout', async () => {
  const fixture = await fixtureDir();
  let searchCount = 0;
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    searchCount += 1;
    response.end(JSON.stringify({ traces: [] }));
  });

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        '--run-dir', fixture.dir,
        '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince',
        '--tempo-url', server.url,
        '--timeout-ms', '30',
        '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /no Tempo trace matched .* before timeout/);
        return true;
      },
    );
    assert.ok(searchCount >= 1);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('rejects duplicate delegate dispatch/fire spans but retains different parents diagnostically', async () => {
  const fixture = await fixtureDir();
  const traceId = '1234567890abcdef1234567890abcdef';
  const base = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
  const spans = base.batches[0].scopeSpans[0].spans;
  const dispatch = spans.find((entry) => entry.name === 'continuation.delegate.dispatch');
  const fire = spans.find((entry) => entry.name === 'continuation.delegate.fire');
  const badCases = [
    ['duplicate-dispatch', { ...dispatch, spanId: b64('9999999999999999') }],
    ['duplicate-fire', { ...fire, spanId: b64('8888888888888888') }],
  ];
  for (const [label, extra] of badCases) {
    const server = await listen((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : { batches: [{ scopeSpans: [{ spans: [...spans, extra] }] }] }));
    });
    try {
      await assert.rejects(execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '40', '--poll-ms', '10',
      ]), new RegExp(`contains 2 .*${label.slice('duplicate-'.length)}`));
    } finally { await server.close(); }
  }
  const differentParent = { ...fire, parentSpanId: b64('7777777777777777') };
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
      ? { traces: [{ traceID: traceId }] }
      : { batches: [{ scopeSpans: [{ spans: spans.map((entry) => entry === fire ? differentParent : entry) }] }] }));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '40', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    assert.equal(receipt.dispatchParentSpanId, 'dddddddddddddddd');
    assert.deepEqual(receipt.fireParentSpanIds, ['7777777777777777']);
    assert.deepEqual(receipt.toolParentSpanIds, ['dddddddddddddddd']);
  } finally { await server.close(); }
  await rm(fixture.dir, { recursive: true, force: true });
});

test('maps omitted, numeric, short, and protobuf Tempo status enums and fails unknown values closed', () => {
  assert.deepEqual(
    [undefined, null, 0, 'UNSET', 'STATUS_CODE_UNSET', 1, 'OK', 'STATUS_CODE_OK', 2, 'ERROR', 'STATUS_CODE_ERROR']
      .map(publicTempoStatusCode),
    ['UNSET', 'UNSET', 'UNSET', 'UNSET', 'UNSET', 'OK', 'OK', 'OK', 'ERROR', 'ERROR', 'ERROR'],
  );
  assert.equal(publicTempoStatusCode('STATUS_CODE_FUTURE'), 'UNKNOWN');
});

test('replays immutable R-CD-1 and R-CW-1 topology against raw protobuf status forms', async (t) => {
  for (const packet of [
    { label: 'R-CD-1', path: preservedTracePaths.delegate, tool: 'continue_delegate', expectedFires: 1 },
    { label: 'R-CW-1', path: preservedTracePaths.work, tool: 'continue_work', expectedFires: 2 },
  ]) {
    await t.test(packet.label, async () => {
      const preserved = JSON.parse(await readFile(packet.path, 'utf8'));
      const trace = withRawContinuationStatuses(preserved);
      const acceptName = packet.tool === 'continue_work'
        ? 'continuation.work'
        : 'continuation.delegate.dispatch';
      const accept = trace.spans.find((entry) => entry.name === acceptName);
      assert.ok(accept, `${packet.label} preserved packet lacks ${acceptName}`);
      const reasonHash = publicAttrValue(accept, 'reason.hash');
      const reasonLength = Number(publicAttrValue(accept, 'reason.length'));
      const fixture = await fixtureDir({
        tool: packet.tool,
        includeNonce: false,
        extraEvidence: {
          reason_hash: reasonHash,
          reason_length: reasonLength,
        },
      });
      const server = await listen((request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
          ? { traces: [{ traceID: preserved.traceId }] }
          : trace));
      });

      try {
        const { stdout } = await execFileAsync(process.execPath, [
          script,
          '--run-dir', fixture.dir,
          '--manifest', fixture.manifestPath,
          '--seat', 'silas-prince',
          '--tempo-url', server.url,
          '--timeout-ms', '100',
          '--poll-ms', '10',
        ]);
        const result = JSON.parse(stdout);
        const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
        const projected = JSON.parse(await readFile(path.join(fixture.dir, result.traceFile), 'utf8'));
        assert.equal(receipt.traceId, preserved.traceId);
        assert.equal(receipt.fireAttemptCount, packet.expectedFires);
        assert.equal(receipt.fireSpanIds.length, packet.expectedFires);
        assert.equal(receipt.reason.hash, reasonHash);
        assert.equal(receipt.reason.length, reasonLength);
        assert.equal(receipt.reason.source, 'public-evidence');
        assert.equal(
          projected.spans.find((entry) => entry.name === acceptName)?.status?.code,
          'OK',
        );
        assert.equal(
          projected.spans.find((entry) =>
            entry.name === 'openclaw.tool.execution' &&
            publicAttrValue(entry, 'gen_ai.tool.name') === packet.tool)?.status?.code,
          'UNSET',
        );
      } finally {
        await server.close();
        await rm(fixture.dir, { recursive: true, force: true });
      }
    });
  }
});

test('accepts Tempo typed-tool spans with canonical empty protobuf status objects', async () => {
  const fixture = await fixtureDir();
  const traceId = '12121212121212121212121212121213';
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
  });
  const spans = trace.batches[0].scopeSpans[0].spans;
  for (const entry of spans) {
    if (entry.name.startsWith('continuation.')) entry.status = { code: 'STATUS_CODE_OK' };
    if (entry.name === 'openclaw.tool.execution') entry.status = {};
  }
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
      ? { traces: [{ traceID: traceId }] }
      : trace));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '40', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const publicTrace = JSON.parse(await readFile(path.join(fixture.dir, result.traceFile), 'utf8'));
    assert.equal(
      publicTrace.spans.find((entry) => entry.name === 'openclaw.tool.execution').status.code,
      'UNSET',
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('accepts protobuf OK continuation spans and successful UNSET typed-tool spans', async () => {
  const fixture = await fixtureDir();
  const traceId = '12121212121212121212121212121212';
  const trace = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
  const spans = trace.batches[0].scopeSpans[0].spans;
  for (const entry of spans) {
    if (entry.name.startsWith('continuation.')) entry.status = { code: 'STATUS_CODE_OK' };
    if (entry.name === 'openclaw.tool.execution') entry.status = { code: 'STATUS_CODE_UNSET' };
  }
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
      ? { traces: [{ traceID: traceId }] }
      : trace));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '40', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const publicTrace = JSON.parse(await readFile(path.join(fixture.dir, result.traceFile), 'utf8'));
    assert.deepEqual(
      publicTrace.spans
        .filter((entry) => entry.name.startsWith('continuation.'))
        .map((entry) => entry.status.code),
      ['OK', 'OK'],
    );
    assert.equal(
      publicTrace.spans.find((entry) => entry.name === 'openclaw.tool.execution').status.code,
      'UNSET',
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('rejects typed-tool ERROR, blocked, and unknown status while accepting explicit OK', async (t) => {
  for (const variant of ['OK', 'ERROR', 'blocked', 'unknown']) {
    await t.test(variant, async () => {
      const fixture = await fixtureDir();
      const traceId = variant === 'OK'
        ? '13131313131313131313131313131313'
        : variant === 'ERROR'
          ? '14141414141414141414141414141414'
          : variant === 'blocked'
            ? '15151515151515151515151515151515'
            : '16161616161616161616161616161616';
      const trace = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
      const tool = trace.batches[0].scopeSpans[0].spans
        .find((entry) => entry.name === 'openclaw.tool.execution');
      tool.status = { code: variant === 'unknown' ? 'STATUS_CODE_FUTURE' : variant === 'blocked' ? 'UNSET' : variant };
      if (variant === 'blocked') tool.attributes.push(attr('openclaw.outcome', 'blocked'));
      const server = await listen((request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
          ? { traces: [{ traceID: traceId }] }
          : trace));
      });
      try {
        const run = () => execFileAsync(process.execPath, [
          script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
          '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
        ]);
        if (variant === 'OK') {
          await run();
        } else {
          await assert.rejects(run(), /error, blocked, or has unknown status/);
        }
      } finally {
        await server.close();
        await rm(fixture.dir, { recursive: true, force: true });
      }
    });
  }
});

test('accepts distinct repeated continue_work fire attempts and preserves every receipt', async () => {
  const fixture = await fixtureDir({ tool: 'continue_work' });
  const traceId = '17171717171717171717171717171717';
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    tool: 'continue_work',
  });
  const spans = trace.batches[0].scopeSpans[0].spans;
  const fire = spans.find((entry) => entry.name === 'continuation.work.fire');
  spans.push({
    ...fire,
    spanId: b64('9999999999999999'),
    parentSpanId: b64('7777777777777777'),
  });
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
      ? { traces: [{ traceID: traceId }] }
      : trace));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '40', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    assert.equal(receipt.fireAttemptCount, 2);
    assert.deepEqual(receipt.fireSpanIds, ['bbbbbbbbbbbbbbbb', '9999999999999999']);
    assert.deepEqual(receipt.fireParentSpanIds, ['dddddddddddddddd', '7777777777777777']);
    assert.equal(receipt.fireSpanId, 'bbbbbbbbbbbbbbbb');
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('deduplicates retried exports of the same continue_work fire span', async () => {
  const fixture = await fixtureDir({ tool: 'continue_work' });
  const traceId = '18181818181818181818181818181818';
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    tool: 'continue_work',
  });
  const spans = trace.batches[0].scopeSpans[0].spans;
  const fire = spans.find((entry) => entry.name === 'continuation.work.fire');
  spans.push({ ...fire });
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
      ? { traces: [{ traceID: traceId }] }
      : trace));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    assert.equal(receipt.fireAttemptCount, 1);
    assert.deepEqual(receipt.fireSpanIds, ['bbbbbbbbbbbbbbbb']);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 correlation carries only matching opaque send run and nonce bindings', async () => {
  const rowNonce = 'R-CD-2-example';
  const fixture = await fixtureDir({
    rowId: 'R-CD-2',
    delegateMode: 'silent-wake',
    nonceOverride: rowNonce,
    extraEvidence: {
      send_run_fingerprint: 'a'.repeat(16),
      row_nonce_fingerprint: createHash('sha256').update(rowNonce).digest('hex').slice(0, 16),
      accepted_send_trace_id: '1'.repeat(32),
    },
  });

  const traceId = '1'.repeat(32);
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength, mode: 'silent-wake' }),
    ));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '100', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receiptText = await readFile(path.join(fixture.dir, result.receiptFile), 'utf8');
    const receipt = JSON.parse(receiptText);
    assert.equal(receipt.continuation.tool, 'continue_delegate');
    assert.equal(receipt.delegate.mode, 'silent-wake');
    assert.deepEqual(receipt.toolSpanIds, ['aaaaaaaaaaaaaaaa']);
    assert.equal(receipt.chainId, '11111111-1111-4111-8111-111111111111');
    assert.deepEqual(receipt.rowBinding, {
      acceptedSendRunFingerprint: 'a'.repeat(16),
      nonceFingerprint: createHash('sha256').update(rowNonce).digest('hex').slice(0, 16),
      acceptedSendTraceId: traceId,
      acceptedSendTraceSource: 'sessions-send-response',
    });
    assert.equal(receipt.authorityIdentity.candidateSha, '1'.repeat(40));
    assert.equal(receipt.authorityIdentity.runtimeBuildSha, '1'.repeat(40));
    assert.equal(receipt.authorityIdentity.matrixId, '20260905T032057Z-333333333333-deadbeef');
    assert.equal(receipt.authorityIdentity.runId, '20260905T032100Z-r-cd-2-deadbeef');
    assert.doesNotMatch(receiptText, /R-CD-2-example/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 derives the nonce fingerprint and rejects a supplied copied mismatch', async () => {
  const rowNonce = 'R-CD-2-derived-fingerprint';
  const derived = createHash('sha256').update(rowNonce).digest('hex').slice(0, 16);
  const wrong = 'e'.repeat(16);
  assert.notEqual(wrong, derived);

  for (const supplied of [undefined, derived, wrong]) {
    const fixture = await fixtureDir({
      rowId: 'R-CD-2',
      delegateMode: 'silent-wake',
      nonceOverride: rowNonce,
      extraEvidence: {
        send_run_fingerprint: 'a'.repeat(16),
        ...(supplied === undefined ? {} : { row_nonce_fingerprint: supplied }),
        accepted_send_trace_id: '7'.repeat(32),
      },
    });
    const traceId = '7'.repeat(32);
    const server = await listen((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(
        new URL(request.url, 'http://localhost').pathname === '/api/search'
          ? { traces: [{ traceID: traceId }] }
          : traceFixture({
              traceId,
              reasonHash: fixture.reasonHash,
              reasonLength: fixture.reasonLength,
              mode: 'silent-wake',
            }),
      ));
    });
    try {
      const collect = () => execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'cael-prince', '--tempo-url', server.url,
        '--timeout-ms', '100', '--poll-ms', '10',
      ]);
      if (supplied === wrong) {
        await assert.rejects(collect(), /row_nonce_fingerprint mismatch/);
      } else {
        const { stdout } = await collect();
        const result = JSON.parse(stdout);
        const receipt = JSON.parse(
          await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'),
        );
        assert.equal(receipt.rowBinding.nonceFingerprint, derived);
      }
    } finally {
      await server.close();
      await rm(fixture.dir, { recursive: true, force: true });
    }
  }
});

test('R-CD-2 resolver accepts the collector-shaped receipt, not a synthetic topology', async () => {
  const rowNonce = 'R-CD-2-resolver-example';
  const traceId = '2'.repeat(32);
  const runFingerprint = 'a'.repeat(16);
  const nonceFingerprint = createHash('sha256').update(rowNonce).digest('hex').slice(0, 16);
  const fixture = await fixtureDir({
    rowId: 'R-CD-2',
    delegateMode: 'silent-wake',
    nonceOverride: rowNonce,
    extraEvidence: {
      send_run_fingerprint: runFingerprint,
      terminal_run_fingerprint: runFingerprint,
      wake_run_fingerprint: 'f'.repeat(16),
      row_nonce_fingerprint: nonceFingerprint,
      accepted_send_trace_id: traceId,
      session_created: true,
      session_unbound_confirmed: true,
      send_accepted: true,
      send_run_captured: true,
      dispatch_terminal_sentinel_observed: true,
      dispatch_terminal_sentinel_same_run_window: true,
      terminal_success_same_run: true,
      typed_delegate_success_same_run: true,
      wake_lifecycle_observed: true,
      post_wake_quiet: true,
      channel_message_observed: false,
      dispatch_failure_observed: false,
      dispatch_accepted_at_ms: 100,
      dispatch_terminal_sentinel_at_ms: 200,
      dispatch_lifecycle_end_at_ms: 300,
      wake_lifecycle_at_ms: 400,
      post_wake_quiet_at_ms: 500,
    },
  });
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength, mode: 'silent-wake' }),
    ));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '100', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const correlation = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    const evidence = JSON.parse(await readFile(path.join(fixture.dir, 'evidence.jsonl'), 'utf8'));
    const resolved = resolveRcd2AuthoritativeReceipt({
      evidence,
      correlation,
      identity: {
        schema: 'openclaw.k6.r-cd-2-authority-identity.v1',
        candidateSha: '1'.repeat(40),
        runtimeBuildSha: '1'.repeat(40),
        docsRef: '3'.repeat(40),
        repository: 'karmaterminal/karmaterminal-openclaw-docs',
        seat: 'cael-prince',
        matrixId: '20260905T032057Z-333333333333-deadbeef',
        runId: path.basename(fixture.dir),
        row: 'R-CD-2',
        scenario: 'r-cd-2-silent-wake.js',
        harness: {
          manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
          manifestSha256: '4'.repeat(64),
          scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
          scenarioSha256: '5'.repeat(64),
        },
      },
      signingKey: 'collector-shaped-r-cd-2-test-key',
    });
    assert.equal(resolved.verdict, 'PASS-candidate');
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 collector rejects repeated continue_delegate tool spans', async () => {
  const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
  const traceId = '3'.repeat(32);
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength, mode: 'silent-wake', toolCount: 2 }),
    ));
  });
  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /contains 2 continue_delegate tool spans/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 scopes a reused trace to the continue_delegate call that scheduled the matched dispatch', async () => {
  const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
  const traceId = '4'.repeat(32);
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    mode: 'silent-wake',
  });
  const spans = trace.batches[0].scopeSpans[0].spans;
  const priorAttrs = [
    attr('chain.id', '22222222-2222-4222-8222-222222222222'),
    attr('reason.hash', 'f'.repeat(16)),
    attr('reason.length', 139),
    attr('delay.ms', 5000),
    attr('delegate.mode', 'normal'),
  ];
  spans.unshift(
    span(
      'openclaw.tool.execution',
      traceId,
      '9999999999999999',
      'dddddddddddddddd',
      [attr('gen_ai.tool.name', 'continue_delegate')],
      'OK',
      {
        startTimeUnixNano: '1785580316865000000',
        endTimeUnixNano: '1785580316868000000',
      },
    ),
    span(
      'continuation.delegate.fire',
      traceId,
      '8888888888888888',
      'dddddddddddddddd',
      [...priorAttrs, attr('fire.deferred_ms', 5000)],
      'OK',
      {
        startTimeUnixNano: '1785580321868000000',
        endTimeUnixNano: '1785580321868001000',
      },
    ),
    span(
      'continuation.delegate.dispatch',
      traceId,
      '7777777777777777',
      'dddddddddddddddd',
      priorAttrs,
      'OK',
      {
        startTimeUnixNano: '1785580321868000000',
        endTimeUnixNano: '1785580321869000000',
      },
    ),
  );
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '100', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    const publicTrace = JSON.parse(await readFile(path.join(fixture.dir, result.traceFile), 'utf8'));
    assert.deepEqual(receipt.toolSpanIds, ['aaaaaaaaaaaaaaaa']);
    assert.deepEqual(
      publicTrace.spans
        .filter((entry) => entry.name === 'openclaw.tool.execution')
        .map((entry) => entry.spanId),
      ['aaaaaaaaaaaaaaaa'],
    );
    assert.equal(
      publicTrace.spans.some((entry) => ['7777777777777777', '8888888888888888', '9999999999999999'].includes(entry.spanId)),
      false,
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 rejects partially timed traces that cannot establish the tool generation', async () => {
  const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
  const traceId = '5'.repeat(32);
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    mode: 'silent-wake',
  });
  for (const entry of trace.batches[0].scopeSpans[0].spans) {
    if (entry.name === 'continuation.delegate.fire' ||
        entry.name === 'continuation.delegate.dispatch') {
      entry.attributes = entry.attributes.filter((attribute) =>
        !['fire.deferred_ms', 'delay.ms'].includes(attribute.key));
    }
  }
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });
  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /lacks complete causal timing/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 does not use projected-trace compatibility for timing-free raw Tempo data', async () => {
  const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
  const traceId = '7'.repeat(32);
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    mode: 'silent-wake',
  });
  for (const entry of trace.batches[0].scopeSpans[0].spans) {
    delete entry.startTimeUnixNano;
    delete entry.endTimeUnixNano;
  }
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });
  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /lacks complete causal timing/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 rejects end-only typed-tool timing instead of using it as the causal origin', async () => {
  const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
  const traceId = '8'.repeat(32);
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    mode: 'silent-wake',
  });
  const tool = trace.batches[0].scopeSpans[0].spans
    .find((entry) => entry.name === 'openclaw.tool.execution');
  delete tool.startTimeUnixNano;
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });
  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /lacks complete causal timing/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('R-CD-2 rejects non-canonical causal timing values', async (t) => {
  const cases = [
    {
      name: 'zero fire timestamp',
      mutate(trace) {
        trace.batches[0].scopeSpans[0].spans
          .find((entry) => entry.name === 'continuation.delegate.fire')
          .startTimeUnixNano = '0';
      },
    },
    {
      name: 'zero tool timestamp',
      mutate(trace) {
        trace.batches[0].scopeSpans[0].spans
          .find((entry) => entry.name === 'openclaw.tool.execution')
          .startTimeUnixNano = '0';
      },
    },
    {
      name: 'zero deferred delay',
      mutate(trace) {
        const fire = trace.batches[0].scopeSpans[0].spans
          .find((entry) => entry.name === 'continuation.delegate.fire');
        fire.attributes.find((entry) => entry.key === 'fire.deferred_ms').value.intValue = '0';
      },
    },
    {
      name: 'string-typed deferred delay',
      mutate(trace) {
        const fire = trace.batches[0].scopeSpans[0].spans
          .find((entry) => entry.name === 'continuation.delegate.fire');
        fire.attributes.find((entry) => entry.key === 'fire.deferred_ms').value = {
          stringValue: '5000',
        };
      },
    },
    {
      name: 'boolean deferred delay',
      mutate(trace) {
        const fire = trace.batches[0].scopeSpans[0].spans
          .find((entry) => entry.name === 'continuation.delegate.fire');
        fire.attributes.find((entry) => entry.key === 'fire.deferred_ms').value = {
          boolValue: false,
        };
      },
    },
  ];

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
      const traceId = '9'.repeat(32);
      const trace = traceFixture({
        traceId,
        reasonHash: fixture.reasonHash,
        reasonLength: fixture.reasonLength,
        mode: 'silent-wake',
      });
      entry.mutate(trace);
      const server = await listen((request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(
          new URL(request.url, 'http://localhost').pathname === '/api/search'
            ? { traces: [{ traceID: traceId }] }
            : trace,
        ));
      });
      try {
        await assert.rejects(
          execFileAsync(process.execPath, [
            script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
            '--seat', 'cael-prince', '--tempo-url', server.url,
            '--timeout-ms', '0', '--poll-ms', '10',
          ]),
          (error) => {
            assert.match(error.stderr, /lacks complete causal timing/);
            return true;
          },
        );
      } finally {
        await server.close();
        await rm(fixture.dir, { recursive: true, force: true });
      }
    });
  }
});

test('R-CD-2 does not select a later unrelated tool inside the old symmetric tolerance', async () => {
  const fixture = await fixtureDir({ rowId: 'R-CD-2', delegateMode: 'silent-wake' });
  const traceId = '6'.repeat(32);
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    mode: 'silent-wake',
  });
  const spans = trace.batches[0].scopeSpans[0].spans;
  const fire = spans.find((entry) => entry.name === 'continuation.delegate.fire');
  spans.unshift(
    span(
      'openclaw.tool.execution',
      traceId,
      '6666666666666667',
      'dddddddddddddddd',
      [attr('gen_ai.tool.name', 'continue_delegate')],
      'OK',
      {
        startTimeUnixNano: fire.startTimeUnixNano,
        endTimeUnixNano: String(BigInt(fire.startTimeUnixNano) + 1000000n),
      },
    ),
  );
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
      '--seat', 'cael-prince', '--tempo-url', server.url, '--timeout-ms', '100', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    assert.deepEqual(receipt.toolSpanIds, ['aaaaaaaaaaaaaaaa']);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('recovers a trace from public reason fingerprint evidence without a nonce', async () => {
  const fixture = await fixtureDir({ includeNonce: false });
  const traceId = '22222222222222222222222222222222';
  let observedQuery = '';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      observedQuery = url.searchParams.get('q') || '';
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    response.end(JSON.stringify(traceFixture({
      traceId,
      reasonHash: fixture.reasonHash,
      reasonLength: fixture.reasonLength,
    })));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'cael-prince',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));

    assert.equal(result.traceId, traceId);
    assert.equal(receipt.reason.hash, fixture.reasonHash);
    assert.equal(receipt.reason.length, fixture.reasonLength);
    assert.equal(receipt.reason.source, 'public-evidence');
    assert.match(observedQuery, new RegExp(`reason\\.hash="${fixture.reasonHash}"`));
    assert.match(observedQuery, /delegate\.mode="normal"/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('rejects nonce-free evidence without a complete public reason fingerprint', async () => {
  const fixture = await fixtureDir({ includeNonce: false });
  const evidencePath = path.join(fixture.dir, 'evidence.jsonl');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  delete evidence.reason_length;
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        '--run-dir', fixture.dir,
        '--manifest', fixture.manifestPath,
        '--seat', 'cael-prince',
        '--tempo-url', 'http://127.0.0.1:1',
        '--timeout-ms', '100',
        '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /positive integer reason_length/);
        return true;
      },
    );
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('recovers a unique non-continuation tool trace by seat, tool, and evidence window', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tool-trace-test-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const traceId = '55555555555555555555555555555555';
  await writeFile(manifestPath, JSON.stringify({
    rowId: 'R-RC-1',
    invocation: { tool: 'request_compaction' },
  }));
  await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify({
    row: 'R-RC-1',
    started: '2026-07-13T03:20:19.504Z',
    ended: '2026-07-13T03:20:53.324Z',
  })}\n`);
  let observedQuery = '';
  let observedStart = '';
  let observedEnd = '';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      observedQuery = url.searchParams.get('q') || '';
      observedStart = url.searchParams.get('start') || '';
      observedEnd = url.searchParams.get('end') || '';
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    response.end(JSON.stringify(toolTraceFixture({ traceId, tool: 'request_compaction' })));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', dir,
      '--manifest', manifestPath,
      '--seat', 'ronan-dgx',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(dir, result.receiptFile), 'utf8'));

    assert.equal(result.traceId, traceId);
    assert.equal(result.tool, 'request_compaction');
    assert.equal(receipt.schema, 'openclaw.k6.tool-trace-correlation.v1');
    assert.equal(receipt.attribution, 'seat-tool-dispatch-window');
    assert.equal(receipt.tool.name, 'request_compaction');
    assert.equal(receipt.tool.spanId, 'aaaaaaaaaaaaaaaa');
    assert.equal(receipt.tool.status.code, 'OK');
    assert.equal(receipt.uniqueTrace, true);
    assert.equal('generatedAt' in receipt, false);
    assert.deepEqual(receipt.searchWindow, {
      startUnixSeconds: Math.floor(Date.parse('2026-07-13T03:20:19.504Z') / 1000) - 60,
      endUnixSeconds: Math.floor(Date.parse('2026-07-13T03:20:53.324Z') / 1000) + 60,
      paddingSeconds: 60,
      source: 'dispatch-and-evidence-ended',
    });
    assert.match(observedQuery, /service\.name="ronan-prince"/);
    assert.match(observedQuery, /gen_ai\.tool\.name="request_compaction"/);
    assert.equal(observedStart, String(Math.floor(Date.parse('2026-07-13T03:20:19.504Z') / 1000) - 60));
    assert.equal(observedEnd, String(Math.floor(Date.parse('2026-07-13T03:20:53.324Z') / 1000) + 60));
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('uses a fixed dispatch-only window when evidence has no ended time', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tool-trace-window-test-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const traceId = '66666666666666666666666666666666';
  const dispatchedAt = '2026-07-13T03:20:19.504Z';
  await writeFile(manifestPath, JSON.stringify({
    rowId: 'R-RC-1',
    invocation: { tool: 'request_compaction' },
  }));
  await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify({
    row: 'R-RC-1',
    started: dispatchedAt,
  })}\n`);
  let observedEnd = '';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      observedEnd = url.searchParams.get('end') || '';
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    response.end(JSON.stringify(toolTraceFixture({ traceId, tool: 'request_compaction' })));
  });

  try {
    const args = [
      script,
      '--run-dir', dir,
      '--manifest', manifestPath,
      '--seat', 'ronan-dgx',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ];
    const { stdout } = await execFileAsync(process.execPath, args);
    const result = JSON.parse(stdout);
    const receiptPath = path.join(dir, result.receiptFile);
    const firstReceipt = await readFile(receiptPath, 'utf8');
    await execFileAsync(process.execPath, args);
    assert.equal(await readFile(receiptPath, 'utf8'), firstReceipt);

    const dispatchSeconds = Math.floor(Date.parse(dispatchedAt) / 1000);
    const receipt = JSON.parse(firstReceipt);
    assert.equal(observedEnd, String(dispatchSeconds + 60));
    assert.deepEqual(receipt.searchWindow, {
      startUnixSeconds: dispatchSeconds - 60,
      endUnixSeconds: dispatchSeconds + 60,
      paddingSeconds: 60,
      source: 'dispatch-only',
    });
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('persists a public trace projection without private Tempo attributes or status messages', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tool-trace-public-projection-test-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const traceId = '77777777777777777777777777777777';
  const sessionKey = 'agent:main:private-session-key-not-in-evidence';
  const authorization = 'Bearer private-tempo-credential';
  const statusMessage = 'private backend status text';
  await writeFile(manifestPath, JSON.stringify({
    rowId: 'R-RC-1',
    invocation: { tool: 'request_compaction' },
  }));
  await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify({
    row: 'R-RC-1',
    started: '2026-07-13T03:20:19.504Z',
    ended: '2026-07-13T03:20:53.324Z',
  })}\n`);

  const unsafePrivateTrace = toolTraceFixture({ traceId, tool: 'request_compaction' });
  const toolSpan = unsafePrivateTrace.batches[0].scopeSpans[0].spans[0];
  toolSpan.attributes.push(
    attr('session.key', sessionKey),
    attr('authorization', authorization),
  );
  toolSpan.status = { code: 'ERROR', message: statusMessage };

  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      url.pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : unsafePrivateTrace,
    ));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', dir,
      '--manifest', manifestPath,
      '--seat', 'ronan-dgx',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const traceText = await readFile(path.join(dir, result.traceFile), 'utf8');
    const receiptText = await readFile(path.join(dir, result.receiptFile), 'utf8');
    const publicTrace = JSON.parse(traceText);
    const receipt = JSON.parse(receiptText);

    assert.equal(publicTrace.schema, 'openclaw.k6.public-tempo-trace.v1');
    assert.equal(publicTrace.traceId, traceId);
    assert.match(traceText, /gen_ai\.tool\.name/);
    for (const privateValue of [sessionKey, authorization, statusMessage]) {
      assert.doesNotMatch(traceText, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(receiptText, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.deepEqual(receipt.tool.status, { code: 'ERROR' });
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('correlates continue_work tool/accept/fire topology by safe reason fingerprint', async () => {
  const fixture = await fixtureDir({ tool: 'continue_work' });
  const traceId = '33333333333333333333333333333333';
  let observedQuery = '';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      observedQuery = url.searchParams.get('q') || '';
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    response.end(JSON.stringify(traceFixture({
      traceId,
      reasonHash: fixture.reasonHash,
      reasonLength: fixture.reasonLength,
      tool: 'continue_work',
    })));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));

    assert.equal(result.traceId, traceId);
    assert.equal(receipt.continuation.tool, 'continue_work');
    assert.equal(receipt.workSpanId, 'cccccccccccccccc');
    assert.equal(receipt.fireSpanId, 'bbbbbbbbbbbbbbbb');
    assert.equal(receipt.sameTrace, true);
    assert.equal(receipt.distinctSpans, true);
    assert.match(observedQuery, /name="continuation\.work"/);
    assert.doesNotMatch(JSON.stringify(receipt), /CW-WOKE R-CW-1-example/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('reconstructs deterministic R-CW-3 reason telemetry without persisting the raw sentinel', async () => {
  const fixture = await fixtureDir({ tool: 'continue_work', workVariant: 'reason-prefix' });
  const traceId = '44444444444444444444444444444444';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      url.pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : traceFixture({
            traceId,
            reasonHash: fixture.reasonHash,
            reasonLength: fixture.reasonLength,
            tool: 'continue_work',
          }),
    ));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'cael-dgx',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    const publicTraceText = await readFile(path.join(fixture.dir, result.traceFile), 'utf8');

    assert.equal(receipt.row, 'R-CW-3');
    assert.equal(receipt.reason.hash, fixture.reasonHash);
    assert.match(publicTraceText, /reason\.hash/);
    assert.match(publicTraceText, new RegExp(fixture.reasonHash));
    assert.match(publicTraceText, /reason\.length/);
    assert.doesNotMatch(publicTraceText, /RAW-RCW3/);
    assert.doesNotMatch(JSON.stringify(receipt), /RAW-RCW3/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('deduplicates retried exports of the same R-CW-3 tool span', async () => {
  const fixture = await fixtureDir({ tool: 'continue_work', workVariant: 'reason-prefix' });
  const traceId = '45454545454545454545454545454545';
  const trace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
    tool: 'continue_work',
  });
  const spans = trace.batches[0].scopeSpans[0].spans;
  trace.batches[0].scopeSpans[0].spans = [spans[0], spans[0], spans[0], ...spans.slice(1)];
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      url.pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'cael-dgx',
      '--tempo-url', server.url,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    assert.equal(receipt.row, 'R-CW-3');
    assert.equal(receipt.toolSpanIds.length, 1);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('rejects ambiguous hash correlation instead of selecting the first trace', async () => {
  const fixture = await fixtureDir();
  const server = await listen((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({
      traces: [
        { traceID: '11111111111111111111111111111111' },
        { traceID: '22222222222222222222222222222222' },
      ],
    }));
  });

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        '--run-dir', fixture.dir,
        '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince',
        '--tempo-url', server.url,
        '--timeout-ms', '100',
        '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /correlation is ambiguous/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('retries until the matched trace has complete continuation topology', async () => {
  const fixture = await fixtureDir();
  const traceId = '11111111111111111111111111111111';
  let traceFetches = 0;
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    traceFetches += 1;
    response.end(JSON.stringify(traceFetches === 1 ? { batches: [] } : traceFixture({
      traceId,
      reasonHash: fixture.reasonHash,
      reasonLength: fixture.reasonLength,
    })));
  });

  try {
    await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'silas-prince',
      '--tempo-url', server.url,
      '--timeout-ms', '500',
      '--poll-ms', '10',
    ]);
    assert.equal(traceFetches, 3);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('rejects a matched trace that leaks raw task or traceparent material', async () => {
  const fixture = await fixtureDir();
  const traceId = '11111111111111111111111111111111';
  const unsafeTrace = traceFixture({
    traceId,
    reasonHash: fixture.reasonHash,
    reasonLength: fixture.reasonLength,
  });
  unsafeTrace.batches[0].scopeSpans[0].spans[0].attributes.push(
    attr('unsafe.raw_task', fixture.reason),
    attr('traceparent', '00-11111111111111111111111111111111-aaaaaaaaaaaaaaaa-01'),
  );
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      url.pathname === '/api/search' ? { traces: [{ traceID: traceId }] } : unsafeTrace,
    ));
  });

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        '--run-dir', fixture.dir,
        '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince',
        '--tempo-url', server.url,
        '--timeout-ms', '100',
        '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /forbidden traceparent|private proof attribution/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('correlates terminal bracket-token topology without a typed continue_delegate tool span', async () => {
  const fixture = await fixtureDir();
  const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
  manifest.rowId = 'R-CD-TOKEN';
  manifest.invocation.originSurface = 'raw-final-text';
  await writeFile(fixture.manifestPath, JSON.stringify(manifest));
  const traceId = '99999999999999999999999999999999';
  const trace = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
  trace.batches[0].scopeSpans[0].spans = trace.batches[0].scopeSpans[0].spans
    .filter((entry) => entry.name !== 'openclaw.tool.execution');
  trace.batches[0].scopeSpans[0].spans.unshift(
    span(
      'openclaw.tool.execution',
      traceId,
      '9999999999999998',
      'dddddddddddddddd',
      [attr('gen_ai.tool.name', 'continue_delegate')],
      'OK',
      {
        startTimeUnixNano: '1785580316865000000',
        endTimeUnixNano: '1785580316868000000',
      },
    ),
  );
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    response.end(url.pathname === '/api/search'
      ? JSON.stringify({ traces: [{ traceID: traceId }] })
      : JSON.stringify(trace));
  });
  try {
    const { stdout } = await execFileAsync(process.execPath, [script,
      '--run-dir', fixture.dir, '--manifest', fixture.manifestPath, '--seat', 'elliott-prince',
      '--tempo-url', server.url, '--timeout-ms', '100', '--poll-ms', '10',
    ]);
    const result = JSON.parse(stdout);
    const receipt = JSON.parse(await readFile(path.join(fixture.dir, result.receiptFile), 'utf8'));
    assert.equal(receipt.attribution, 'bracket-token-reason-hash-length-mode');
    assert.equal(receipt.continuation.originSurface, 'raw-final-text');
    assert.deepEqual(receipt.toolSpanIds, []);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('bracket-token topology rejects invalid raw timing rather than certifying typed-tool absence', async () => {
  const fixture = await fixtureDir();
  const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
  manifest.rowId = 'R-CD-TOKEN';
  manifest.invocation.originSurface = 'raw-final-text';
  await writeFile(fixture.manifestPath, JSON.stringify(manifest));
  const traceId = '99999999999999999999999999999998';
  const trace = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
  trace.batches[0].scopeSpans[0].spans = trace.batches[0].scopeSpans[0].spans
    .filter((entry) => entry.name !== 'openclaw.tool.execution');
  const fire = trace.batches[0].scopeSpans[0].spans
    .find((entry) => entry.name === 'continuation.delegate.fire');
  delete fire.startTimeUnixNano;
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(
      new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : trace,
    ));
  });
  try {
    await assert.rejects(
      execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'elliott-prince', '--tempo-url', server.url, '--timeout-ms', '0', '--poll-ms', '10',
      ]),
      (error) => {
        assert.match(error.stderr, /lacks complete causal timing/);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('bracket-token topology rejects a typed tool origin and duplicate dispatch spans', async (t) => {
  for (const variant of ['typed-tool', 'duplicate-dispatch']) {
    await t.test(variant, async () => {
      const fixture = await fixtureDir();
      const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
      manifest.rowId = 'R-CD-TOKEN';
      manifest.invocation.originSurface = 'raw-final-text';
      await writeFile(fixture.manifestPath, JSON.stringify(manifest));
      const traceId = variant === 'typed-tool'
        ? '88888888888888888888888888888888'
        : '77777777777777777777777777777777';
      const trace = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
      if (variant === 'duplicate-dispatch') {
        const spans = trace.batches[0].scopeSpans[0].spans;
        trace.batches[0].scopeSpans[0].spans = [
          ...spans.filter((entry) => entry.name !== 'openclaw.tool.execution'),
          span('continuation.delegate.dispatch', traceId, 'ffffffffffffffff', 'dddddddddddddddd', [
            attr('chain.id', '11111111-1111-4111-8111-111111111111'),
            attr('reason.hash', fixture.reasonHash), attr('reason.length', fixture.reasonLength),
            attr('delegate.mode', 'normal'),
          ]),
        ];
      }
      const server = await listen((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        response.setHeader('content-type', 'application/json');
        response.end(url.pathname === '/api/search'
          ? JSON.stringify({ traces: [{ traceID: traceId }] })
          : JSON.stringify(trace));
      });
      try {
        await assert.rejects(execFileAsync(process.execPath, [script,
          '--run-dir', fixture.dir, '--manifest', fixture.manifestPath, '--seat', 'elliott-prince',
          '--tempo-url', server.url, '--timeout-ms', '30', '--poll-ms', '10',
        ]), (error) => {
          assert.match(error.stderr, variant === 'typed-tool' ? /must not contain a typed/ : /contains 2 continuation\.delegate\.dispatch/);
          return true;
        });
      } finally {
        await server.close();
        await rm(fixture.dir, { recursive: true, force: true });
      }
    });
  }
});
