import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  TRACE_OUTCOME,
  validateObservabilityOutcome,
} from '../../lib/observability-outcome.mjs';

const execFileAsync = promisify(execFile);
const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../collect-continuation-trace.mjs',
);
const OUTCOME_FILE = 'continuation-trace-observability.json';

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function fixtureDir({ tool = 'continue_work', row = 'R-CW-3', invocation } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'observability-outcome-'));
  const nonce = `${row}-example`;
  const template = 'k6-proof-{{nonce}} -- on continuation wake reply exactly CW-WOKE {{nonce}}';
  const reason = template.replaceAll('{{nonce}}', nonce);
  const manifest = {
    rowId: row,
    invocation: invocation ?? (tool === 'continue_work'
      ? { tool, reason: template }
      : { tool, mode: 'normal', promptTemplate: template }),
  };
  const evidence = {
    row,
    nonce,
    sessionKey: 'agent:main:k6-observability-fixture',
    started: '2026-07-12T22:15:00.000Z',
    ended: '2026-07-12T22:15:40.000Z',
    dispatch_accepted_at_ms: Date.parse('2026-07-12T22:15:10.000Z'),
    reason_hash: createHash('sha256').update(reason).digest('hex').slice(0, 16),
    reason_length: reason.length,
  };
  const manifestPath = path.join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(path.join(dir, 'evidence.jsonl'), `${JSON.stringify(evidence)}\n`);
  return { dir, manifestPath, nonce };
}

async function runCollector(fixture, tempoUrl) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      '--run-dir', fixture.dir,
      '--manifest', fixture.manifestPath,
      '--seat', 'cael-dgx',
      '--tempo-url', tempoUrl,
      '--timeout-ms', '60',
      '--poll-ms', '10',
    ]);
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, stderr: String(error.stderr || error.message) };
  }
}

async function readOutcome(dir) {
  return JSON.parse(await readFile(path.join(dir, OUTCOME_FILE), 'utf8'));
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

test('a reachable Tempo with no matching trace leaves an explicit, re-bindable outcome', async () => {
  const fixture = await fixtureDir();
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ traces: [] }));
  });
  try {
    const run = await runCollector(fixture, server.url);
    assert.equal(run.ok, false, 'a missing trace must remain a non-zero collector exit');

    const outcome = await readOutcome(fixture.dir);
    assert.deepEqual(validateObservabilityOutcome(outcome), { valid: true, status: TRACE_OUTCOME.NO_MATCHING_TRACE });
    assert.equal(outcome.row, 'R-CW-3');
    assert.equal(outcome.seat, 'cael-dgx');
    assert.equal(outcome.resolved, false);
    assert.deepEqual(outcome.reviewDebt, ['tempo-trace-json', 'continuation-trace-correlation']);

    // The whole point: the row can be re-bound later without refiring it.
    assert.equal(outcome.rebind.serviceName, 'cael-prince');
    assert.match(outcome.rebind.query, /name="continuation\.work"/);
    assert.match(outcome.rebind.reason.hash, /^[a-f0-9]{16}$/);
    assert.ok(Number.isInteger(outcome.rebind.searchWindow.startUnixSeconds));
    assert.ok(Number.isInteger(outcome.rebind.searchWindow.endUnixSeconds));
    assert.ok(outcome.rebind.searchWindow.endUnixSeconds > outcome.rebind.searchWindow.startUnixSeconds);
    assert.match(outcome.rebind.rowNonceFingerprint, /^[a-f0-9]{16}$/);
    assert.equal(outcome.rebind.sessionFingerprints.length, 1);

    // Private material never reaches the artifact.
    const serialized = JSON.stringify(outcome);
    assert.ok(!serialized.includes(fixture.nonce));
    assert.ok(!serialized.includes('agent:main:k6-observability-fixture'));

    // And no correlation artifact was invented.
    assert.equal(await exists(path.join(fixture.dir, 'continuation-trace-correlation.json')), false);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('an unreachable Tempo is classified as backend-unavailable, not as an absent trace', async () => {
  const fixture = await fixtureDir();
  const server = await listen(() => {});
  const deadUrl = server.url;
  await server.close();
  try {
    const run = await runCollector(fixture, deadUrl);
    assert.equal(run.ok, false);
    const outcome = await readOutcome(fixture.dir);
    assert.deepEqual(validateObservabilityOutcome(outcome), { valid: true, status: TRACE_OUTCOME.BACKEND_UNAVAILABLE });
    assert.ok(outcome.rebind, 'an unavailable backend must still be re-bindable when it returns');
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('a Tempo error response is backend-unavailable and never a product verdict', async () => {
  const fixture = await fixtureDir();
  const server = await listen((request, response) => {
    response.statusCode = 503;
    response.end('service unavailable');
  });
  try {
    const run = await runCollector(fixture, server.url);
    assert.equal(run.ok, false);
    const outcome = await readOutcome(fixture.dir);
    assert.equal(outcome.status, TRACE_OUTCOME.BACKEND_UNAVAILABLE);
    assert.equal(outcome.resolved, false);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('two matching traces are ambiguous, never silently first-wins', async () => {
  const fixture = await fixtureDir();
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({
      traces: [
        { traceID: '11111111111111111111111111111111' },
        { traceID: '22222222222222222222222222222222' },
      ],
    }));
  });
  try {
    const run = await runCollector(fixture, server.url);
    assert.equal(run.ok, false);
    const outcome = await readOutcome(fixture.dir);
    assert.equal(outcome.status, TRACE_OUTCOME.AMBIGUOUS_TRACE);
    assert.equal(outcome.candidateCount, 2);
    assert.equal(outcome.traceId, null);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('a matched trace that fails a topology gate is topology-invalid, not backend trouble', async () => {
  const fixture = await fixtureDir();
  const traceId = '33333333333333333333333333333333';
  const server = await listen((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
      return;
    }
    // A real trace payload that simply does not carry the expected spans.
    response.end(JSON.stringify({ batches: [{ scopeSpans: [{ spans: [] }] }] }));
  });
  try {
    const run = await runCollector(fixture, server.url);
    assert.equal(run.ok, false);
    const outcome = await readOutcome(fixture.dir);
    assert.equal(outcome.status, TRACE_OUTCOME.TOPOLOGY_INVALID);
    assert.equal(outcome.candidateCount, 1);
    assert.match(outcome.detail, /continuation\.work/);
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('an unusable manifest contract is contract-invalid and still records its outcome', async () => {
  const fixture = await fixtureDir({ invocation: {} });
  const server = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ traces: [] }));
  });
  try {
    const run = await runCollector(fixture, server.url);
    assert.equal(run.ok, false);
    assert.match(run.stderr, /invocation\.tool is required/);
    const outcome = await readOutcome(fixture.dir);
    assert.equal(outcome.status, TRACE_OUTCOME.CONTRACT_INVALID);
    assert.equal(outcome.rebind.query, null, 'no query could be built, and none is invented');
  } finally {
    await server.close();
    await rm(fixture.dir, { recursive: true, force: true });
  }
});
