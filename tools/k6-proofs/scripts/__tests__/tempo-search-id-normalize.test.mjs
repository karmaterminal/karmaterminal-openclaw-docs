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
import { normalizeTempoSearchTraceId } from '../collect-continuation-trace.mjs';

const execFileAsync = promisify(execFile);
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../collect-continuation-trace.mjs');

function b64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

function attr(key, value) {
  return {
    key,
    value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value },
  };
}

test('normalizeTempoSearchTraceId left-pads exactly 31 hex chars', () => {
  const short = '1234567890abcdef1234567890abcde'; // 31
  assert.equal(short.length, 31);
  assert.equal(normalizeTempoSearchTraceId(short), `0${short}`);
  assert.equal(normalizeTempoSearchTraceId(`0${short}`), `0${short}`);
});

test('normalizeTempoSearchTraceId rejects other lengths and all-zero IDs', () => {
  assert.throws(() => normalizeTempoSearchTraceId('abc'), /invalid search trace id/);
  assert.throws(() => normalizeTempoSearchTraceId('1'.repeat(30)), /invalid search trace id/);
  assert.throws(() => normalizeTempoSearchTraceId('1'.repeat(33)), /invalid search trace id/);
  assert.throws(() => normalizeTempoSearchTraceId('0'.repeat(32)), /invalid search trace id/);
  assert.throws(() => normalizeTempoSearchTraceId('0'.repeat(31)), /invalid search trace id/);
});

test('collector accepts 31-hex search IDs and verifies nonzero payload IDs', async () => {
  const fullTraceId = '0123456789abcdef0123456789abcdef';
  const shortSearchId = fullTraceId.slice(1); // strip leading 0 → 31 hex
  assert.equal(shortSearchId.length, 31);

  const reason = 'Proof nonce TEMPO-31: task body for normalize test';
  const reasonHash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
  const reasonLength = reason.length;
  const parent = 'dddddddddddddddd';
  const dispatch = 'aaaaaaaaaaaaaaaa';
  const fire = 'bbbbbbbbbbbbbbbb';
  const tool = 'cccccccccccccccc';
  const toolOriginNs = 1785580554339000000n;
  const fireNs = toolOriginNs + 5000000000n;
  const continuationAttrs = [
    attr('chain.id', '11111111-1111-4111-8111-111111111111'),
    attr('reason.hash', reasonHash),
    attr('reason.length', reasonLength),
    attr('delegate.mode', 'silent-wake'),
  ];
  const trace = {
    batches: [{
      scopeSpans: [{
        spans: [
          {
            name: 'continuation.delegate.dispatch',
            traceId: b64(fullTraceId),
            spanId: b64(dispatch),
            parentSpanId: b64(parent),
            status: { code: 'OK' },
            attributes: continuationAttrs,
            startTimeUnixNano: String(fireNs),
            endTimeUnixNano: String(fireNs + 1000n),
          },
          {
            name: 'continuation.delegate.fire',
            traceId: b64(fullTraceId),
            spanId: b64(fire),
            parentSpanId: b64(parent),
            status: { code: 'OK' },
            attributes: [...continuationAttrs, attr('fire.deferred_ms', 5000)],
            startTimeUnixNano: String(fireNs),
            endTimeUnixNano: String(fireNs + 1000n),
          },
          {
            name: 'openclaw.tool.execution',
            traceId: b64(fullTraceId),
            spanId: b64(tool),
            parentSpanId: b64(parent),
            status: { code: 'OK' },
            attributes: [attr('gen_ai.tool.name', 'continue_delegate')],
            startTimeUnixNano: String(toolOriginNs),
            endTimeUnixNano: String(toolOriginNs + 1000n),
          },
        ],
      }],
    }],
  };

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/search')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ traces: [{ traceID: shortSearchId }] }));
      return;
    }
    if (req.url.startsWith('/api/traces/')) {
      const requested = decodeURIComponent(req.url.split('/').pop());
      assert.equal(requested, fullTraceId);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(trace));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tempo-31-'));
  try {
    const nonce = 'TEMPO-31';
    const manifest = {
      invocation: {
        tool: 'continue_delegate',
        mode: 'silent-wake',
        promptTemplate: 'Proof nonce {{nonce}}: task body for normalize test',
      },
    };
    const evidence = {
      nonce,
      reason_hash: reasonHash,
      reason_length: reasonLength,
      delegate_mode: 'silent-wake',
      dispatch_accepted_at_ms: Date.now(),
      started: new Date().toISOString(),
      ended: new Date().toISOString(),
    };
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify(evidence)}\n`);
    const { stdout } = await execFileAsync('node', [
      script,
      '--run-dir', dir,
      '--manifest', path.join(dir, 'manifest.json'),
      '--seat', 'cael-dgx',
      '--evidence', path.join(dir, 'evidence.jsonl'),
      '--tempo-url', `http://127.0.0.1:${port}`,
      '--timeout-ms', '2000',
      '--poll-ms', '50',
    ], { timeout: 15000 });
    const result = JSON.parse(stdout);
    assert.equal(result.traceId, fullTraceId);
    const receipt = JSON.parse(await readFile(path.join(dir, 'continuation-trace-correlation.json'), 'utf8'));
    assert.equal(receipt.traceId, fullTraceId);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
