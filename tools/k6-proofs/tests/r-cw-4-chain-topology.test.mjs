// R-CW-4 chain-row trace topology (karmaterminal-openclaw-docs#600).
//
// Live trap (emeric isolated gateway, runtime and candidate
// 293c977f629f872a643fb94892603310b887293b, docs 313a70c625, targeted refire
// 030423Z, run 20261029T032246Z-r-cw-4-844f2bba): the row's behaviour passed
// (the journal shows work-wake hop=1/200, 2/200 and 3/200 on one session and
// CW4-DONE arrived), but collect-continuation-trace.mjs refused the trace with
// `Tempo trace did not reach valid continuation topology before timeout:
// matched trace contains 3 continue_work tool spans`.
//
// Product shape at karmaterminal/openclaw 293c977f62 (source walk; no fresh
// GitNexus index exists for that SHA):
// - continue_work captures the live span as its traceparent
//   (src/agents/tools/continue-work-tool.ts formatCurrentSpanContinuationTraceparent),
//   so continuation.work and continuation.work.fire are children of the
//   openclaw.tool.execution span that elected them
//   (src/auto-reply/continuation/work-dispatch.ts emitContinuationWorkSpan,
//   work-dispatch-execution.ts emitContinuationWorkFireSpan). The committed
//   R-CW-1 and R-CW-3 projections from the same matrix show exactly that.
// - the wake turn runs under that traceparent
//   (work-dispatch-execution.ts driveContinuationTurn ->
//   runWithDiagnosticTraceparent(work.traceparent, ...)), so its
//   openclaw.harness.run is a child of the electing tool span and the next
//   hop's tool span descends from it, on the same trace. chain.id is the
//   session's chain state, the same for every hop.
// A correct three-hop chain therefore carries three continue_work tool spans
// on hop 1's trace. Only hop 1's continuation.work carries the row's reason
// fingerprint.
//
// Each test fires the real R-CW-4 scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs), passes its log through the real extractor, takes
// the three hop reasons from the instruction the scenario sent, and runs the
// real collector against a local Tempo holding the spans above. No live
// gateway, seat or Tempo is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collector = path.join(root, 'scripts/collect-continuation-trace.mjs');
const traceId = '4c'.repeat(16);
const chainId = '5d0e8f2a-3b4c-4d5e-8f60-718293a4b5c6';
const otherChainId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
// Refire 030423Z wall clock (journal PDT + 7h): hop-1 election 03:23:04.2,
// work-wake hop 1 03:23:09.3, hop 2 03:23:21.9, wake 03:23:27.0, hop 3
// 03:23:37.2, wake 03:23:42.3, CW4-DONE 03:23:44.3.
const MS = 1_000_000n;
const T0 = BigInt(Date.parse('2026-10-29T03:23:04.214Z')) * MS;
const HOP_TIMES_MS = [0, 17_770, 32_984];
const WAKE_AFTER_MS = 5_085;

function sha16(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function b64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

function id(prefix, index) {
  return `${prefix}${String(index).padStart(2, '0')}`.padEnd(16, '0');
}

function attr(key, value) {
  if (typeof value === 'number') return { key, value: { intValue: String(value) } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  return { key, value: { stringValue: value } };
}

function rawSpan({ name, spanId, parentSpanId, attributes = [], status = 'STATUS_CODE_OK', startNs }) {
  return {
    name,
    traceId: b64(traceId),
    spanId: b64(spanId),
    ...(parentSpanId ? { parentSpanId: b64(parentSpanId) } : {}),
    attributes,
    status: status === 'STATUS_CODE_UNSET' ? {} : { code: status },
    startTimeUnixNano: String(startNs),
    endTimeUnixNano: String(startNs + 1n * MS),
  };
}

function continuationAttrs({ reason, chain, remaining, extra = [] }) {
  return [
    attr('delay.ms', 2000),
    attr('chain.step.remaining', remaining),
    attr('chain.id', chain),
    attr('reason.present', true),
    attr('reason.length', reason.length),
    attr('reason.hash', sha16(reason)),
    attr('reason.redacted', false),
    ...extra,
  ];
}

/**
 * The spans one continue_work hop emits: its tool span, the continuation.work
 * and .work.fire it elects (children of the tool span), and the wake turn that
 * fire drives (harness.run under the tool span, openclaw.run under that).
 * Returns the wake turn's run span id, under which the next hop's tool runs.
 */
function hopSpans({ index, reason, parentSpanId, startNs, chain = chainId, workParent, includeWork = true }) {
  const tool = id('a1', index);
  const work = id('b2', index);
  const fire = id('c3', index);
  const harness = id('d4', index);
  const wakeRun = id('e5', index);
  const wakeNs = startNs + BigInt(WAKE_AFTER_MS) * MS;
  const remaining = 200 - index;
  const spans = [
    rawSpan({
      name: 'openclaw.tool.execution',
      spanId: tool,
      parentSpanId,
      attributes: [attr('openclaw.toolName', 'continue_work'), attr('gen_ai.tool.name', 'continue_work')],
      status: 'STATUS_CODE_UNSET',
      startNs,
    }),
    ...(includeWork ? [rawSpan({
      name: 'continuation.work',
      spanId: work,
      parentSpanId: workParent ?? tool,
      attributes: continuationAttrs({ reason, chain, remaining }),
      startNs: startNs + 20n * MS,
    })] : []),
    rawSpan({
      name: 'continuation.work.fire',
      spanId: fire,
      parentSpanId: tool,
      attributes: continuationAttrs({ reason, chain, remaining, extra: [attr('fire.deferred_ms', WAKE_AFTER_MS)] }),
      startNs: wakeNs,
    }),
    rawSpan({ name: 'openclaw.harness.run', spanId: harness, parentSpanId: tool, status: 'STATUS_CODE_UNSET', startNs: wakeNs + 1n * MS }),
    rawSpan({ name: 'openclaw.run', spanId: wakeRun, parentSpanId: harness, status: 'STATUS_CODE_UNSET', startNs: wakeNs + 2n * MS }),
  ];
  return { spans, ids: { tool, work, fire, harness, wakeRun } };
}

const DISPATCH_HARNESS = id('f6', 0);
const DISPATCH_RUN = id('f7', 0);

/** The raw Tempo trace of a correct sequential chain, one hop per reason. */
function chainTrace(reasons, { mutate } = {}) {
  const spans = [
    rawSpan({ name: 'openclaw.harness.run', spanId: DISPATCH_HARNESS, status: 'STATUS_CODE_UNSET', startNs: T0 - 13_000n * MS }),
    rawSpan({ name: 'openclaw.run', spanId: DISPATCH_RUN, parentSpanId: DISPATCH_HARNESS, status: 'STATUS_CODE_UNSET', startNs: T0 - 12_999n * MS }),
  ];
  const hops = [];
  let parent = DISPATCH_RUN;
  reasons.forEach((reason, index) => {
    const startNs = T0 + BigInt(HOP_TIMES_MS[index] ?? HOP_TIMES_MS.at(-1) + 15_000 * (index - 2)) * MS;
    const hop = hopSpans({ index: index + 1, reason, parentSpanId: parent, startNs, ...(mutate?.hopOptions?.(index) || {}) });
    spans.push(...hop.spans);
    hops.push(hop.ids);
    parent = hop.ids.wakeRun;
  });
  const extra = mutate?.extraSpans?.({ hops, rawSpan, hopSpans }) || [];
  return { trace: { batches: [{ scopeSpans: [{ spans: [...spans, ...extra] }] }] }, hops };
}

function gateway(frame) {
  if (frame?.type !== 'req') return [];
  const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
  switch (frame.method) {
    case 'connect':
      return ok({ type: 'hello-ok', features: { methods: [] } });
    case 'sessions.create':
      return ok({ key: String(frame.params?.key || 'agent:main:subagent:continuation-r-cw-4') });
    case 'sessions.messages.subscribe':
      return ok({ subscribed: true, key: frame.params?.key });
    case 'sessions.send': {
      const nonce = /R-CW-4 proof nonce (\S+)\./u.exec(frame.params?.message || '')?.[1];
      // The behaviour the refire journal shows: three hops, then CW4-DONE.
      return [
        ...ok({ runId: frame.params?.idempotencyKey, traceId: null }),
        ...['CW4-HOP1-SCHEDULED', 'CW4-HOP2-SCHEDULED', 'CW4-HOP3-SCHEDULED', 'CW4-DONE'].map((marker) => ({
          type: 'event',
          event: 'agent',
          payload: { runId: frame.params?.idempotencyKey, stream: 'assistant', data: { text: `${marker} ${nonce}` } },
        })),
      ];
    }
    default:
      return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
  }
}

/** Fire the real scenario once: its private evidence and the three hop reasons it dispatched. */
async function fireRcw4() {
  const { log, frames } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios/r-cw-4-chain-depth.js'),
    gateway,
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests/r-cw-4.json'),
      OPENCLAW_GATEWAY_TOKEN: 'docs-600-r-cw-4-chain-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: '293c977f629f872a643fb94892603310b887293b',
      OPENCLAW_SEAT_NAME: 'emeric-isolated-composite',
      OPENCLAW_SESSION_KEY: 'agent:main:subagent:continuation-r-cw-4-docs-600',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `expected one R-CW-4 evidence record:\n${log}`);
  const [evidence] = records;
  assert.equal(evidence.final_done, true, 'the scripted gateway reproduces the refire behaviour');
  const dispatch = frames.find((frame) => frame.method === 'sessions.send').params.message;
  const reasons = [...dispatch.matchAll(/reason="([^"]+)"/gu)].map((match) => match[1].trim().slice(0, 1024));
  assert.equal(reasons.length, 3, 'the instruction names one reason per hop');
  assert.equal(evidence.reason_hash, sha16(reasons[0]), 'the row fingerprint is hop 1');
  assert.equal(evidence.reason_length, reasons[0].length);
  return { evidence, reasons };
}

const fired = await fireRcw4();

async function collect({ trace, manifest = 'r-cw-4.json', evidence = fired.evidence }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'docs-600-r-cw-4-chain-'));
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(url.pathname === '/api/search' ? { traces: [{ traceID: traceId }] } : trace));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const evidencePath = path.join(dir, 'private-evidence.jsonl');
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);
  const env = { ...process.env };
  delete env.OPENCLAW_PROOFS_SERVICE_NAME;
  try {
    const { stdout } = await run(process.execPath, [
      collector,
      '--run-dir', dir,
      '--manifest', path.join(root, 'manifests', manifest),
      '--seat', 'emeric-isolated-composite',
      '--evidence', evidencePath,
      '--tempo-url', `http://127.0.0.1:${server.address().port}`,
      '--timeout-ms', '0',
      '--poll-ms', '10',
    ], { encoding: 'utf8', env });
    const result = JSON.parse(stdout);
    return {
      ok: true,
      result,
      receipt: JSON.parse(await readFile(path.join(dir, result.receiptFile), 'utf8')),
      publicTrace: JSON.parse(await readFile(path.join(dir, result.traceFile), 'utf8')),
    };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { ok: false, stderr: error.stderr, files: await readdir(dir) };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

/** Fail closed: no receipt, no public trace, and the topology refusal names the cause. */
function assertRefused(collected, cause) {
  assert.equal(collected.ok, false, 'the collector must refuse this trace');
  assert.deepEqual(collected.files.filter((file) => file !== 'private-evidence.jsonl'), []);
  assert.match(collected.stderr, /valid continuation topology/u);
  assert.match(collected.stderr, cause);
}

test('R-CW-4 refire 030423Z: a joined three-hop chain is attributed to its hop-1 continue_work span', async () => {
  const { trace, hops } = chainTrace(fired.reasons);
  const collected = await collect({ trace });
  assert.equal(collected.ok, true, collected.stderr);
  const { receipt, publicTrace } = collected;
  assert.equal(receipt.traceId, traceId);
  assert.equal(receipt.chainId, chainId);
  assert.equal(receipt.reason.hash, sha16(fired.reasons[0]));
  // The attribution span is hop 1's tool span: the parent of the
  // fingerprint-matched continuation.work.
  assert.equal(receipt.workSpanId, hops[0].work);
  assert.equal(receipt.workParentSpanId, hops[0].tool);
  assert.deepEqual(receipt.toolSpanIds, [hops[0].tool]);
  assert.deepEqual(receipt.toolParentSpanIds, [DISPATCH_RUN]);
  assert.deepEqual(receipt.fireSpanIds, [hops[0].fire]);
  // Hops 2 and 3 are recorded as later hops of the same chain, in order.
  assert.equal(receipt.chainDepthTarget, 3);
  assert.equal(receipt.chainDepth, 3);
  assert.deepEqual(receipt.chainHops, [
    { hop: 2, toolSpanId: hops[1].tool, toolParentSpanId: hops[0].wakeRun, workSpanId: hops[1].work },
    { hop: 3, toolSpanId: hops[2].tool, toolParentSpanId: hops[1].wakeRun, workSpanId: hops[2].work },
  ]);
  // The public projection holds every span the chain proof rests on, and it
  // replays: the collector accepts its own projection.
  const projected = new Set(publicTrace.spans.map((entry) => entry.spanId));
  for (const hop of hops) {
    for (const spanId of [hop.tool, hop.work]) assert.ok(projected.has(spanId), `projection keeps ${spanId}`);
  }
  for (const spanId of [hops[0].harness, hops[0].wakeRun, hops[1].harness, hops[1].wakeRun]) {
    assert.ok(projected.has(spanId), `projection keeps the wake-turn path span ${spanId}`);
  }
  assert.equal(JSON.stringify(publicTrace).includes(fired.evidence.nonce), false, 'no nonce in the public trace');
  const replayed = await collect({ trace: publicTrace });
  assert.equal(replayed.ok, true, replayed.stderr);
  assert.deepEqual(replayed.receipt.chainHops, receipt.chainHops);
});

test('fail closed: two unrelated fires sharing the hop-1 fingerprint stay ambiguous', async () => {
  const { trace } = chainTrace(fired.reasons, {
    mutate: {
      extraSpans: ({ hopSpans: spansFor }) => spansFor({
        index: 9,
        reason: fired.reasons[0],
        parentSpanId: DISPATCH_RUN,
        startNs: T0 + 1n * MS,
        chain: otherChainId,
      }).spans,
    },
  });
  assertRefused(await collect({ trace }), /2 continuation\.work spans/u);
});

test('fail closed: a continue_work span that scheduled work on another chain is not a later hop', async () => {
  const { trace } = chainTrace(fired.reasons, {
    mutate: { hopOptions: (index) => (index === 1 ? { chain: otherChainId } : {}) },
  });
  assertRefused(await collect({ trace }), /continue_work tool span/u);
});

test('fail closed: a sibling continue_work span in the dispatch turn is not a later hop', async () => {
  const { trace } = chainTrace(fired.reasons.slice(0, 1), {
    mutate: {
      extraSpans: ({ hopSpans: spansFor }) => spansFor({
        index: 2,
        reason: fired.reasons[1],
        parentSpanId: DISPATCH_RUN,
        startNs: T0 + 400n * MS,
      }).spans,
    },
  });
  assertRefused(await collect({ trace }), /continue_work tool span/u);
});

test('fail closed: a later continue_work span that scheduled no continuation.work is not a hop', async () => {
  const { trace } = chainTrace(fired.reasons, {
    mutate: { hopOptions: (index) => (index === 2 ? { includeWork: false } : {}) },
  });
  assertRefused(await collect({ trace }), /continue_work tool span/u);
});

test('fail closed: hops beyond the declared chainDepthTarget are refused', async () => {
  const fourth = `R-CW-4 hop4 ${fired.evidence.nonce}; unexpected`;
  const { trace } = chainTrace([...fired.reasons, fourth]);
  assertRefused(await collect({ trace }), /4 continue_work tool spans/u);
});

test('fail closed: later hops that branch inside one wake turn are not sequential', async () => {
  const { trace } = chainTrace(fired.reasons.slice(0, 2), {
    mutate: {
      extraSpans: ({ hops, hopSpans: spansFor }) => spansFor({
        index: 3,
        reason: fired.reasons[2],
        parentSpanId: hops[0].wakeRun,
        startNs: T0 + BigInt(HOP_TIMES_MS[1] + 50) * MS,
      }).spans,
    },
  });
  assertRefused(await collect({ trace }), /continue_work tool span/u);
});

test('fail closed: hop 1 is the tool span that elected the fingerprint-matched work', async () => {
  const { trace } = chainTrace(fired.reasons, {
    mutate: { hopOptions: (index) => (index === 0 ? { workParent: DISPATCH_RUN } : {}) },
  });
  assertRefused(await collect({ trace }), /continue_work tool span/u);
});

test('a row without a declared chain depth keeps the exactly-one tool span rule', async () => {
  // R-CW-1 declares no chainDepthTarget: the same joined two-hop shape is
  // still refused there, with the existing message.
  const manifest = JSON.parse(await readFile(path.join(root, 'manifests/r-cw-1.json'), 'utf8'));
  assert.equal(manifest.invocation.chainDepthTarget, undefined);
  const reason = manifest.invocation.reason.replaceAll('{{nonce}}', fired.evidence.nonce);
  const evidence = { ...fired.evidence, row: 'R-CW-1', reason_hash: sha16(reason), reason_length: reason.length };
  const { trace } = chainTrace([reason, `R-CW-1 later hop ${fired.evidence.nonce}`]);
  assertRefused(await collect({ trace, manifest: 'r-cw-1.json', evidence }), /matched trace contains 2 continue_work tool spans/u);
});

test('retried exports: an identical later-hop copy is one hop, a differing copy is refused', async () => {
  const identical = chainTrace(fired.reasons);
  const spans = identical.trace.batches[0].scopeSpans[0].spans;
  const hop2Tool = spans.find((entry) => entry.spanId === b64(identical.hops[1].tool));
  spans.push({ ...hop2Tool });
  const deduplicated = await collect({ trace: identical.trace });
  assert.equal(deduplicated.ok, true, deduplicated.stderr);
  assert.equal(deduplicated.receipt.chainDepth, 3);

  const differing = chainTrace(fired.reasons);
  const differingSpans = differing.trace.batches[0].scopeSpans[0].spans;
  const copy = differingSpans.find((entry) => entry.spanId === b64(differing.hops[1].tool));
  differingSpans.push({ ...copy, endTimeUnixNano: String(BigInt(copy.endTimeUnixNano) + 5n * MS) });
  assertRefused(await collect({ trace: differing.trace }), /exported more than once with different content/u);
});
