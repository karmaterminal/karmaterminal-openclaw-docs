// R-CW-DELEGATE-SELF-CONTINUATION reason fingerprint (karmaterminal-openclaw-docs#600).
//
// Live trap (cael, 2026-10-28): the scenario recorded no delegate reason
// fingerprint, the public evidence drops the nonce, and a post-run
// collect-continuation-trace.mjs refused with
// `invalid evidence reason hash: (empty)`, so the row's Tempo trace could never
// be attributed. These tests run the real scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs), pass its log through the real extractor and
// sanitizer as run-proofs.sh does, and hand the public evidence to the real
// collector against a local Tempo. No live gateway, seat or Tempo is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { sanitizeEvidenceRecords } from '../scripts/sanitize-k6-artifacts.mjs';
import { traceContract } from '../scripts/collect-continuation-trace.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROW = 'R-CW-DELEGATE-SELF-CONTINUATION';
const scenarioPath = path.join(root, 'scenarios/r-cw-delegate-self-continuation.js');
const manifestPath = path.join(root, 'manifests/r-cw-delegate-self.json');
const collector = path.join(root, 'scripts/collect-continuation-trace.mjs');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const traceId = '6'.repeat(32);

function sha16(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function gateway(frame) {
  if (frame?.type !== 'req') return [];
  const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
  switch (frame.method) {
    case 'connect':
      return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS[ROW]] } });
    case 'sessions.messages.subscribe':
      return ok({ subscribed: true });
    case 'sessions.send':
      return ok({ runId: 'run-dispatch-docs-600', traceId: null });
    case 'sessions.list':
      return ok({ sessions: [] });
    case 'chat.history':
      return ok({ messages: [] });
    default:
      return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
  }
}

/** Fire the real scenario once; return its private and public evidence. */
async function fireScenario() {
  const { log, frames } = await runK6Scenario({
    scenarioPath,
    gateway,
    env: {
      OPENCLAW_ROW_MANIFEST: manifestPath,
      OPENCLAW_GATEWAY_TOKEN: 'docs-600-node-runtime-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'a'.repeat(40),
      OPENCLAW_SEAT_NAME: 'cael-dgx',
      OPENCLAW_SESSION_KEY: 'agent:main:docs-600-delegate-self',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `expected one evidence record in the scenario log:\n${log}`);
  const [privateEvidence] = records;
  const { sanitized: [publicEvidence] } = sanitizeEvidenceRecords(records);
  const dispatch = frames.find((frame) => frame.method === 'sessions.send');
  assert.ok(dispatch, 'the scenario dispatched its continue_delegate instruction');
  return { privateEvidence, publicEvidence, dispatch };
}

function dispatchedTask(evidence) {
  return manifest.invocation.promptTemplate.replaceAll('{{nonce}}', evidence.nonce);
}

test('the scenario records the fingerprint of the exact task it dispatched', async () => {
  const { privateEvidence, publicEvidence, dispatch } = await fireScenario();
  assert.equal(privateEvidence.row, ROW);
  const task = dispatchedTask(privateEvidence);
  assert.ok(
    dispatch.params.message.includes(`task="${task}"`),
    'the fingerprint must describe the task the agent was told to pass to continue_delegate',
  );
  assert.equal(privateEvidence.reason_hash, sha16(task));
  assert.equal(privateEvidence.reason_length, task.length);
  assert.equal(privateEvidence.delegate_mode, manifest.invocation.mode);

  // Public evidence loses the nonce and the task, and keeps only the fingerprint.
  assert.equal(publicEvidence.nonce, undefined);
  assert.doesNotMatch(JSON.stringify(publicEvidence), new RegExp(privateEvidence.nonce));
  assert.equal(publicEvidence.reason_hash, sha16(task));
  assert.equal(publicEvidence.reason_length, task.length);
  assert.equal(publicEvidence.delegate_mode, 'normal');
});

test('the collector accepts the scenario evidence shape, private and public', async () => {
  const { privateEvidence, publicEvidence } = await fireScenario();
  const task = dispatchedTask(privateEvidence);
  // In run: the collector renders the manifest task with the private nonce and
  // the recorded fingerprint must agree with it.
  const inRun = traceContract(manifest, privateEvidence);
  assert.equal(inRun.fingerprintSource, 'manifest-nonce');
  assert.equal(inRun.hash, sha16(task));
  // After the run: the public evidence alone attributes the same trace.
  const postRun = traceContract(manifest, publicEvidence);
  assert.equal(postRun.fingerprintSource, 'public-evidence');
  assert.equal(postRun.hash, inRun.hash);
  assert.equal(postRun.length, inRun.length);
  assert.equal(postRun.mode, 'normal');
});

test('the collector hash check is not weakened: a forged fingerprint is refused', async () => {
  const { privateEvidence, publicEvidence } = await fireScenario();
  assert.throws(
    () => traceContract(manifest, { ...privateEvidence, reason_hash: 'f'.repeat(16) }),
    /evidence reason_hash mismatch/,
  );
  assert.throws(
    () => traceContract(manifest, { ...publicEvidence, reason_hash: null }),
    /invalid evidence reason hash/,
  );
  assert.throws(
    () => traceContract(manifest, { ...publicEvidence, reason_length: 0 }),
    /positive integer reason_length/,
  );
});

function attr(key, value) {
  return { key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: String(value) } };
}

function delegateTrace({ reasonHash, reasonLength }) {
  const toolOriginNs = 1793182600000000000n;
  const fireNs = toolOriginNs + 5000000000n;
  const continuation = [
    attr('reason.hash', reasonHash),
    attr('reason.length', reasonLength),
    attr('delegate.mode', 'normal'),
    attr('chain.id', '12345678-1234-4123-8123-123456789abc'),
  ];
  return {
    batches: [{ scopeSpans: [{ spans: [
      { name: 'continuation.delegate.dispatch', traceId, spanId: '2'.repeat(16), parentSpanId: '5'.repeat(16), status: { code: 1 }, attributes: continuation, startTimeUnixNano: String(fireNs), endTimeUnixNano: String(fireNs + 1000000n) },
      { name: 'continuation.delegate.fire', traceId, spanId: '3'.repeat(16), parentSpanId: '5'.repeat(16), status: { code: 1 }, attributes: [...continuation, attr('fire.deferred_ms', 5000)], startTimeUnixNano: String(fireNs), endTimeUnixNano: String(fireNs + 1000n) },
      { name: 'openclaw.tool.execution', traceId, spanId: '4'.repeat(16), parentSpanId: '5'.repeat(16), status: { code: 1 }, attributes: [attr('gen_ai.tool.name', 'continue_delegate')], startTimeUnixNano: String(toolOriginNs), endTimeUnixNano: String(toolOriginNs + 1000000n) },
    ] }] }],
  };
}

async function collectFromPublicEvidence(publicEvidence, trace) {
  const dir = await mkdtemp(path.join(tmpdir(), 'docs-600-delegate-self-collect-'));
  const queries = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      queries.push(url.searchParams.get('q'));
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
    } else {
      response.end(JSON.stringify(trace));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const evidencePath = path.join(dir, 'evidence.jsonl');
  await writeFile(evidencePath, `${JSON.stringify(publicEvidence)}\n`);
  const env = { ...process.env };
  delete env.OPENCLAW_PROOFS_SERVICE_NAME;
  try {
    const { stdout } = await run(process.execPath, [
      collector,
      '--run-dir', dir,
      '--manifest', manifestPath,
      '--seat', 'cael-dgx',
      '--evidence', evidencePath,
      '--tempo-url', `http://127.0.0.1:${server.address().port}`,
      '--timeout-ms', '100',
      '--poll-ms', '10',
    ], { encoding: 'utf8', env });
    const result = JSON.parse(stdout);
    return { ok: true, result, receipt: JSON.parse(await readFile(path.join(dir, result.receiptFile), 'utf8')), queries };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { ok: false, stderr: error.stderr, queries };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

test('post-run recovery: public evidence alone attributes the row trace (local Tempo)', async () => {
  const { privateEvidence, publicEvidence } = await fireScenario();
  const task = dispatchedTask(privateEvidence);
  const collected = await collectFromPublicEvidence(
    publicEvidence,
    delegateTrace({ reasonHash: sha16(task), reasonLength: task.length }),
  );
  assert.equal(collected.ok, true, collected.stderr);
  assert.equal(collected.result.traceId, traceId);
  assert.equal(collected.result.receiptFile, 'continuation-trace-correlation.json');
  assert.equal(collected.receipt.reason.source, 'public-evidence');
  assert.equal(collected.receipt.reason.hash, sha16(task));
  assert.equal(collected.receipt.reason.rawPersisted, false);
  assert.equal(collected.receipt.delegate.mode, 'normal');
  assert.match(collected.queries[0], new RegExp(`\\.reason\\.hash="${sha16(task)}"`));
  assert.doesNotMatch(JSON.stringify(collected.receipt), new RegExp(privateEvidence.nonce));
});

test('negative control: a trace whose dispatch carries another fingerprint is not attributed', async () => {
  const { publicEvidence } = await fireScenario();
  const collected = await collectFromPublicEvidence(
    publicEvidence,
    delegateTrace({ reasonHash: 'e'.repeat(16), reasonLength: 7 }),
  );
  assert.equal(collected.ok, false);
  assert.match(collected.stderr, /lacks the expected continuation\.delegate\.dispatch span/);
});
