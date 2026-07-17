import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = path.resolve('tools/k6-proofs/scripts/fetch-tempo-trace.mjs');
const runNode = promisify(execFile);

async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('fetches and projects Tempo trace JSON by trace id without persisting private fields', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tempo-fetch-'));
  try {
    await withServer((req, res) => {
      assert.equal(req.url, '/api/traces/0123456789abcdef');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ batches: [{ resource: { attributes: [{ key: 'host.secret', value: { stringValue: 'private-resource' } }] }, scopeSpans: [{ spans: [{
        traceId: '0123456789abcdef',
        spanId: '0123456789abcdef',
        name: 'openclaw.tool',
        status: { code: 2, message: 'private status text' },
        attributes: [
          { key: 'openclaw.toolName', value: { stringValue: 'continue_work' } },
          { key: 'session.key', value: { stringValue: 'agent:private:session' } },
          { key: 'authorization', value: { stringValue: 'Bearer private-token' } },
          { key: 'task.text', value: { stringValue: 'private task prompt' } },
        ],
        events: [{ name: 'private event', attributes: [{ key: 'prompt', value: { stringValue: 'private prompt' } }] }],
      }] }] }] }));
    }, async (baseUrl) => {
      const out = path.join(root, 'trace.json');
      const run = await runNode(process.execPath, [script, '--trace-id', '0123456789abcdef', '--tempo-url', baseUrl, '--out', out], { encoding: 'utf8' });
      const receipt = JSON.parse(run.stdout);
      assert.equal(receipt.fetched, true);
      assert.equal(receipt.traceId, '0123456789abcdef');
      assert.equal(receipt.spans, 1);
      assert.equal(receipt.tempoUrl.includes('0123456789abcdef'), false);
      const body = JSON.parse(await readFile(out, 'utf8'));
      assert.equal(body.schema, 'openclaw.k6.public-tempo-trace.v1');
      assert.equal(body.spans.length, 1);
      assert.equal(body.spans[0].name, 'openclaw.tool');
      assert.deepEqual(body.spans[0].status, { code: 'ERROR' });
      assert.deepEqual(body.spans[0].attributes, [
        { key: 'openclaw.toolName', value: { stringValue: 'continue_work' } },
      ]);
      const serialized = JSON.stringify({ body, receipt });
      for (const forbidden of ['session.key', 'authorization', 'agent:private:session', 'private-token', 'private status text', 'private-resource', 'private task prompt', 'private prompt']) {
        assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('can discover trace id from run-dir evidence.jsonl', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tempo-fetch-rundir-'));
  try {
    const runDir = path.join(root, 'run');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'evidence.jsonl'), `${JSON.stringify({ trace_id: 'abcdef0123456789' })}\n`);
    await withServer((req, res) => {
      assert.equal(req.url, '/api/traces/abcdef0123456789');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ trace: { spans: [{ spanId: '0123456789abcdef', name: 'continuation.work' }] } }));
    }, async (baseUrl) => {
      const run = await runNode(process.execPath, [script, '--run-dir', runDir, '--tempo-url', baseUrl], { encoding: 'utf8' });
      const receipt = JSON.parse(run.stdout);
      assert.equal(receipt.traceId, 'abcdef0123456789');
      assert.match(receipt.out, /tempo-trace-abcdef012345\.json$/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('can discover trace id from Tempo TraceQL search', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tempo-fetch-traceql-'));
  try {
    await withServer((req, res) => {
      if (req.url.startsWith('/api/search?')) {
        assert.match(req.url, /q=%7B\+\.chain\.id\+%3D\+%22chain-1%22\+%7D/);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ traces: [{ traceID: 'fedcba9876543210' }] }));
        return;
      }
      assert.equal(req.url, '/api/traces/fedcba9876543210');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ trace: { spans: [
        { spanId: '0123456789abcdef', name: 'continuation.work' },
        { spanId: 'fedcba9876543210', name: 'continuation.work.fire' },
      ] } }));
    }, async (baseUrl) => {
      const out = path.join(root, 'trace.json');
      const run = await runNode(process.execPath, [script, '--traceql', '{ .chain.id = "chain-1" }', '--tempo-url', baseUrl, '--start', '1783518200', '--end', '1783518400', '--out', out], { encoding: 'utf8' });
      const receipt = JSON.parse(run.stdout);
      assert.equal(receipt.fetched, true);
      assert.equal(receipt.traceId, 'fedcba9876543210');
      assert.equal(receipt.spans, 2);
      const body = JSON.parse(await readFile(out, 'utf8'));
      assert.equal(body.spans.length, 2);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('uses OPENCLAW_PROOFS_TEMPO_BASE_URL when --tempo-url is omitted', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tempo-fetch-env-'));
  try {
    await withServer((req, res) => {
      assert.equal(req.url, '/api/traces/1111222233334444');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ trace: { spans: [{ spanId: '0123456789abcdef', name: 'continuation.work' }] } }));
    }, async (baseUrl) => {
      const out = path.join(root, 'trace.json');
      const run = await runNode(process.execPath, [script, '--trace-id', '1111222233334444', '--out', out], {
        encoding: 'utf8',
        env: { ...process.env, OPENCLAW_PROOFS_TEMPO_BASE_URL: baseUrl, TEMPO_BASE_URL: 'http://unused.invalid' },
      });
      const receipt = JSON.parse(run.stdout);
      assert.equal(receipt.fetched, true);
      assert.equal(receipt.traceId, '1111222233334444');
      assert.equal(receipt.spans, 1);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
