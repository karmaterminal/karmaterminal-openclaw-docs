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

function traceFixture({ traceId, reasonHash, reasonLength, tool = 'continue_delegate' }) {
  const parent = 'dddddddddddddddd';
  const isWork = tool === 'continue_work';
  const acceptSpanName = isWork ? 'continuation.work' : 'continuation.delegate.dispatch';
  const fireSpanName = isWork ? 'continuation.work.fire' : 'continuation.delegate.fire';
  const continuationAttrs = [
    attr('chain.id', 'chain-example'),
    attr('reason.hash', reasonHash),
    attr('reason.length', reasonLength),
    ...(isWork ? [] : [attr('delegate.mode', 'normal')]),
  ];
  return {
    batches: [{
      scopeSpans: [{
        spans: [
          span('openclaw.tool.execution', traceId, 'aaaaaaaaaaaaaaaa', parent, [
            attr('gen_ai.tool.name', tool),
          ]),
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
} = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'continuation-trace-test-'));
  const isWork = tool === 'continue_work';
  const isReasonPrefix = isWork && workVariant === 'reason-prefix';
  const nonce = isReasonPrefix
    ? 'R-CW-3-example'
    : isWork
      ? 'R-CW-1-example'
      : 'R-CD-1-example';
  const template = isReasonPrefix
    ? 'k6-proof-R-CW-3-redaction RAW-RCW3-{{nonce}}; on continuation wake reply exactly CW3-WOKE {{nonce}}'
    : isWork
      ? 'k6-proof-R-CW-1-{{nonce}} -- on continuation wake reply exactly CW-WOKE {{nonce}}'
    : 'Proof nonce {{nonce}}: reply exactly CD1-DONE {{nonce}} only.';
  const templatedReason = template.replaceAll('{{nonce}}', nonce);
  const reason = templatedReason;
  const reasonHash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
  const manifest = {
    rowId: isReasonPrefix ? 'R-CW-3' : isWork ? 'R-CW-1' : 'R-CD-1',
    invocation: isWork
      ? { tool, reason: template }
      : { tool, mode: 'normal', promptTemplate: template },
  };
  const evidence = {
    row: manifest.rowId,
    ...(includeNonce ? { nonce } : {}),
    started: '2026-07-12T22:15:00.000Z',
    dispatch_accepted_at_ms: Date.parse('2026-07-12T22:15:10.000Z'),
    reason_hash: reasonHash,
    reason_length: reason.length,
    ...(isWork ? {} : { delegate_mode: 'normal' }),
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
    assert.match(observedQuery, /service\.name="ronan-prince"/);
    assert.match(observedQuery, /gen_ai\.tool\.name="request_compaction"/);
    assert.equal(observedStart, String(Math.floor(Date.parse('2026-07-13T03:20:19.504Z') / 1000) - 60));
    assert.equal(observedEnd, String(Math.floor(Date.parse('2026-07-13T03:20:53.324Z') / 1000) + 60));
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

    assert.equal(receipt.row, 'R-CW-3');
    assert.equal(receipt.reason.hash, fixture.reasonHash);
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
