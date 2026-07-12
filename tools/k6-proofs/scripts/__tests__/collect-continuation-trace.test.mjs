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

function traceFixture({ traceId, reasonHash, reasonLength }) {
  const parent = 'dddddddddddddddd';
  return {
    batches: [{
      scopeSpans: [{
        spans: [
          span('openclaw.tool.execution', traceId, 'aaaaaaaaaaaaaaaa', parent, [
            attr('gen_ai.tool.name', 'continue_delegate'),
          ]),
          span('continuation.delegate.fire', traceId, 'bbbbbbbbbbbbbbbb', parent, [
            attr('chain.id', 'chain-example'),
            attr('reason.hash', reasonHash),
            attr('reason.length', reasonLength),
            attr('delegate.mode', 'normal'),
          ]),
          span('continuation.delegate.dispatch', traceId, 'cccccccccccccccc', parent, [
            attr('chain.id', 'chain-example'),
            attr('reason.hash', reasonHash),
            attr('reason.length', reasonLength),
            attr('delegate.mode', 'normal'),
          ]),
          span('openclaw.harness.run', traceId, 'eeeeeeeeeeeeeeee', 'cccccccccccccccc'),
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

async function fixtureDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'continuation-trace-test-'));
  const nonce = 'R-CD-1-example';
  const template = 'Proof nonce {{nonce}}: reply exactly CD1-DONE {{nonce}} only.';
  const reason = template.replaceAll('{{nonce}}', nonce);
  const reasonHash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
  const manifest = {
    rowId: 'R-CD-1',
    invocation: { tool: 'continue_delegate', mode: 'normal', promptTemplate: template },
  };
  const evidence = {
    row: 'R-CD-1',
    nonce,
    started: '2026-07-12T22:15:00.000Z',
    dispatch_accepted_at_ms: Date.parse('2026-07-12T22:15:10.000Z'),
    reason_hash: reasonHash,
    reason_length: reason.length,
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
