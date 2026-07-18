import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolveRcd2AuthoritativeReceipt } from '../../lib/r-cd-2-authoritative-receipt.mjs';

const execFileAsync = promisify(execFile);
const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../collect-continuation-trace.mjs',
);

function b64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

function attr(key, value) {
  return {
    key,
    value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value },
  };
}

function span(name, traceId, spanId, parentSpanId, attrs = []) {
  return {
    name,
    traceId: b64(traceId),
    spanId: b64(spanId),
    parentSpanId: b64(parentSpanId),
    attributes: attrs,
  };
}

function traceFixture({ traceId, reasonHash, reasonLength, tool = 'continue_delegate', mode = 'normal', toolCount = 1 }) {
  const parent = 'dddddddddddddddd';
  const isWork = tool === 'continue_work';
  const acceptSpanName = isWork ? 'continuation.work' : 'continuation.delegate.dispatch';
  const fireSpanName = isWork ? 'continuation.work.fire' : 'continuation.delegate.fire';
  const continuationAttrs = [
    attr('chain.id', '11111111-1111-4111-8111-111111111111'),
    attr('reason.hash', reasonHash),
    attr('reason.length', reasonLength),
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
          )),
          span(fireSpanName, traceId, 'bbbbbbbbbbbbbbbb', parent, continuationAttrs),
          span(acceptSpanName, traceId, 'cccccccccccccccc', parent, continuationAttrs),
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
  const dir = await mkdtemp(path.join(os.tmpdir(), 'continuation-trace-test-'));
  const isWork = tool === 'continue_work';
  const isReasonPrefix = isWork && workVariant === 'reason-prefix';
  const resolvedRowId = rowId || (isReasonPrefix ? 'R-CW-3' : isWork ? 'R-CW-1' : 'R-CD-1');
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
  const manifestPath = path.join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify(evidence)}\n`);
  return { dir, manifestPath, reason, reasonHash, reasonLength: reason.length };
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

test('rejects duplicate dispatch/fire spans and unrelated causal parents', async () => {
  const fixture = await fixtureDir();
  const traceId = '1234567890abcdef1234567890abcdef';
  const base = traceFixture({ traceId, reasonHash: fixture.reasonHash, reasonLength: fixture.reasonLength });
  const spans = base.batches[0].scopeSpans[0].spans;
  const dispatch = spans.find((entry) => entry.name === 'continuation.delegate.dispatch');
  const fire = spans.find((entry) => entry.name === 'continuation.delegate.fire');
  const badCases = [
    ['duplicate-dispatch', { ...dispatch, spanId: b64('9999999999999999') }],
    ['duplicate-fire', { ...fire, spanId: b64('8888888888888888') }],
    ['different-parent', { ...fire, parentSpanId: b64('7777777777777777') }],
  ];
  for (const [label, extra] of badCases) {
    const server = await listen((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(new URL(request.url, 'http://localhost').pathname === '/api/search'
        ? { traces: [{ traceID: traceId }] }
        : { batches: [{ scopeSpans: [{ spans: label === 'different-parent'
          ? spans.map((entry) => entry === fire ? extra : entry)
          : [...spans, extra] }] }] }));
    });
    try {
      await assert.rejects(execFileAsync(process.execPath, [
        script, '--run-dir', fixture.dir, '--manifest', fixture.manifestPath,
        '--seat', 'silas-prince', '--tempo-url', server.url, '--timeout-ms', '40', '--poll-ms', '10',
      ]), new RegExp(label === 'different-parent' ? 'causal parent' : `contains 2 .*${label.slice('duplicate-'.length)}`));
    } finally { await server.close(); }
  }
  await rm(fixture.dir, { recursive: true, force: true });
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
    });
    assert.doesNotMatch(receiptText, /R-CD-2-example/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
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
      wake_run_fingerprint: runFingerprint,
      row_nonce_fingerprint: nonceFingerprint,
      accepted_send_trace_id: traceId,
      session_created: true,
      session_unbound_confirmed: true,
      send_accepted: true,
      send_run_captured: true,
      terminal_success_same_run: true,
      typed_delegate_success_same_run: true,
      wake_lifecycle_observed: true,
      post_wake_quiet: true,
      channel_message_observed: false,
      dispatch_failure_observed: false,
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
    assert.equal(receipt.tool.status.code, 'UNSET');
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
    assert.equal(traceFetches, 2);
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
