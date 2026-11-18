// One Tempo re-poll before a searched row is routed as uncorrelated.
//
// After each Tempo compaction, retention deletes the compaction's input blocks
// (compacted_block_retention=1h). The blocklist poll can race that delete and
// fail, so queriers miss the merged block until the next poll
// (blocklist_poll=5m): for up to about five minutes a trace that exists returns
// nothing from search or /api/traces/<id>, then heals. On 2026-11-18 that made
// run 44245772142's traces look lost (06:50-06:55Z) when they were not
// (🍃 diagnosis, Discord 1572505980258750566, confirmed by 🌫 1572506664685277258).
//
// So the collector searches once more, a configurable wait after a search that
// came back empty, before it gives up; it records both attempts; and the
// review-debt route names whether a re-poll was tried. These tests run the real
// collector against a local Tempo whose answers change between the attempts,
// hand its stdout to the run directory exactly as run-proofs.sh does
// (`> continuation-trace-collector.json`), and run the real
// summarize-review-debt.mjs over that directory. The wait is injected through
// OPENCLAW_PROOFS_TEMPO_REPOLL_SECONDS, so no test sleeps 330 s. No seat,
// gateway or live Tempo is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { traceReceiptFindings } from '../../lib/continuation-trace-requirement.mjs';
import { traceCorrelationWindow } from '../../lib/trace-correlation-window.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const collector = path.resolve(here, '../collect-continuation-trace.mjs');
const summarizer = path.resolve(here, '../summarize-review-debt.mjs');
const fixture = JSON.parse(await readFile(path.join(here, 'fixtures/run-44245772142-trace-debt.json'), 'utf8'));
const REPOLL_ENV = 'OPENCLAW_PROOFS_TEMPO_REPOLL_SECONDS';
const TRACE_RECEIPTS = ['tempo-trace-json', 'continuation-trace-correlation'];
// A regression that re-polls with the real default (330 s), or never stops,
// fails here instead of hanging the suite.
const BOUNDED = { timeout: 60000 };

function fixtureRow(rowId) {
  const row = fixture.rows.find((entry) => entry.rowId === rowId);
  assert.ok(row, `fixture row ${rowId}`);
  return row;
}

// R-CD-MODEL-DEFAULT dispatched, recorded reason fingerprint
// 17d1c4cdcab47769/306, and its collector found no trace.
const model = fixtureRow('R-CD-MODEL-DEFAULT');
const modelWindow = traceCorrelationWindow(model.runResult.evidence);
const TRACE_ID = '0c1d2e3f405162738495a6b7c8d9eaf1';

const toB64 = (hex) => Buffer.from(hex, 'hex').toString('base64');
const attr = (key, value) => ({
  key,
  value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value },
});

function span(name, spanId, parentSpanId, attributes, startNs, endNs) {
  return {
    name,
    traceId: toB64(TRACE_ID),
    spanId: toB64(spanId),
    parentSpanId: toB64(parentSpanId),
    attributes,
    status: { code: 'STATUS_CODE_OK' },
    startTimeUnixNano: String(startNs),
    endTimeUnixNano: String(endNs),
  };
}

// The raw Tempo trace of the dispatch R-CD-MODEL-DEFAULT fingerprinted: its
// continue_delegate tool call, then fire and dispatch 5 s later on one chain.
function modelTrace() {
  const evidence = model.runResult.evidence;
  const toolNs = BigInt(Date.parse(evidence.started) + 5000) * 1000000n;
  const fireNs = toolNs + 5000000000n;
  const continuation = [
    attr('chain.id', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'),
    attr('reason.hash', evidence.reason_hash),
    attr('reason.length', evidence.reason_length),
    attr('delegate.mode', evidence.delegate_mode),
    attr('delay.ms', 5000),
  ];
  return {
    batches: [{
      scopeSpans: [{
        spans: [
          span('openclaw.tool.execution', 'a1a1a1a1a1a1a1a1', 'd4d4d4d4d4d4d4d4',
            [attr('gen_ai.tool.name', 'continue_delegate')], toolNs, toolNs + 1000000n),
          span('continuation.delegate.fire', 'b2b2b2b2b2b2b2b2', 'd4d4d4d4d4d4d4d4',
            [...continuation, attr('fire.deferred_ms', 5000)], fireNs, fireNs + 1000n),
          span('continuation.delegate.dispatch', 'c3c3c3c3c3c3c3c3', 'd4d4d4d4d4d4d4d4',
            continuation, fireNs, fireNs + 1000000n),
        ],
      }],
    }],
  };
}

const RC_TRACE_ID = '5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e';
const rcRow = {
  manifest: {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-RC-1',
    transport: 'websocket',
    toolSurface: 'typed-tool',
    invocation: { tool: 'request_compaction' },
    liveRunSafety: { requiredReceipts: ['tempo-trace-json', 'tool-trace-correlation'] },
  },
  evidence: { row: 'R-RC-1', started: '2026-11-18T06:25:21.000Z', ended: '2026-11-18T06:26:02.000Z' },
};

function rcTrace() {
  const ns = BigInt(Date.parse(rcRow.evidence.started) + 3000) * 1000000n;
  return {
    batches: [{
      scopeSpans: [{
        spans: [{
          name: 'openclaw.tool.execution',
          traceId: toB64(RC_TRACE_ID),
          spanId: toB64('e5e5e5e5e5e5e5e5'),
          parentSpanId: toB64('f6f6f6f6f6f6f6f6'),
          attributes: [attr('gen_ai.tool.name', 'request_compaction')],
          status: { code: 'STATUS_CODE_OK' },
          startTimeUnixNano: String(ns),
          endTimeUnixNano: String(ns + 1000000n),
        }],
      }],
    }],
  };
}

/**
 * Fire the real collector over one row against a local Tempo. `found(n)` says
 * whether the n-th search (1-based) returns the trace. With --timeout-ms 0 the
 * first attempt is exactly one search, so the n-th search is attributable.
 */
async function collect({
  manifest = model.manifest,
  evidence = model.runResult.evidence,
  trace = modelTrace(),
  traceId = TRACE_ID,
  found = () => false,
  repollSeconds = '0.3',
  seat = fixture.seat,
} = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'tempo-repoll-'));
  const searches = [];
  const fetches = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      searches.push({ atMs: Date.now(), start: Number(url.searchParams.get('start')), end: Number(url.searchParams.get('end')) });
      response.end(JSON.stringify({ traces: found(searches.length) ? [{ traceID: traceId }] : [] }));
      return;
    }
    fetches.push(url.pathname);
    response.end(JSON.stringify(trace));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const evidencePath = path.join(dir, 'private-evidence.jsonl');
  const manifestPath = path.join(dir, 'row-manifest.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  const env = { ...process.env };
  delete env.OPENCLAW_PROOFS_SERVICE_NAME;
  if (repollSeconds === undefined) delete env[REPOLL_ENV];
  else env[REPOLL_ENV] = repollSeconds;
  const startedMs = Date.now();
  let outcome;
  try {
    const { stdout, stderr } = await run(process.execPath, [
      collector,
      '--run-dir', dir,
      '--manifest', manifestPath,
      '--seat', seat,
      '--evidence', evidencePath,
      '--tempo-url', `http://127.0.0.1:${server.address().port}`,
      '--timeout-ms', '0',
      '--poll-ms', '10',
    ], { encoding: 'utf8', env });
    outcome = { ok: true, code: 0, stdout, stderr };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    outcome = { ok: false, code: error.code, stdout: error.stdout, stderr: error.stderr };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  // What run-proofs.sh does with the collector's stdout, success or not.
  await writeFile(path.join(dir, 'continuation-trace-collector.json'), outcome.stdout);
  return { ...outcome, dir, searches, fetches, elapsedMs: Date.now() - startedMs, files: await readdir(dir) };
}

async function readJson(dir, name) {
  return JSON.parse(await readFile(path.join(dir, name), 'utf8'));
}

// The review-debt summary of one run directory laid out as the runner leaves
// it: run-result.json, row-manifest.json and the collector's stdout.
async function summarizeRun(collectedDir, row = model) {
  const root = await mkdtemp(path.join(tmpdir(), 'tempo-repoll-debt-'));
  try {
    const dir = path.join(root, fixture.candidateSha, row.rowId, fixture.seat, row.runId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'run-result.json'), `${JSON.stringify(row.runResult, null, 2)}\n`);
    await writeFile(path.join(dir, 'row-manifest.json'), `${JSON.stringify(row.manifest, null, 2)}\n`);
    if (collectedDir) {
      await writeFile(
        path.join(dir, 'continuation-trace-collector.json'),
        await readFile(path.join(collectedDir, 'continuation-trace-collector.json')),
      );
    }
    const [json, text] = await Promise.all([
      run(process.execPath, [summarizer, '--run-root', root, '--json'], { encoding: 'utf8' }),
      run(process.execPath, [summarizer, '--run-root', root], { encoding: 'utf8' }),
    ]);
    const summary = JSON.parse(json.stdout);
    const pending = summary.pending.find((entry) => entry.rowId === row.rowId);
    assert.ok(pending, `${row.rowId} is review-pending`);
    const items = pending.pending.filter((item) => TRACE_RECEIPTS.includes(item.receipt));
    assert.deepEqual(items.map((item) => item.receipt).sort(), [...TRACE_RECEIPTS].sort());
    return { items, text: text.stdout };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const expectedWindow = { startUnixSeconds: modelWindow.start, endUnixSeconds: modelWindow.end };

function assertAttempt(entry, { attempt, result, repollWaitSeconds }) {
  const keys = ['attempt', 'startedAt', 'endedAt', 'window', 'queryCount', 'result'];
  if (repollWaitSeconds !== undefined) keys.push('repollWaitSeconds');
  assert.deepEqual(Object.keys(entry).sort(), keys.sort());
  assert.equal(entry.attempt, attempt);
  assert.equal(entry.result, result);
  assert.equal(entry.queryCount, 1);
  assert.deepEqual(entry.window, expectedWindow);
  assert.equal(entry.repollWaitSeconds, repollWaitSeconds);
  for (const field of ['startedAt', 'endedAt']) {
    assert.match(entry[field], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, field);
  }
  assert.ok(Date.parse(entry.endedAt) >= Date.parse(entry.startedAt));
}

test('(a) a trace Tempo misses on the first search is found by one re-poll after the wait and routes as found', BOUNDED, async () => {
  const collected = await collect({ found: (n) => n >= 2, repollSeconds: '0.4' });
  try {
    assert.equal(collected.ok, true, collected.stderr);
    // The runner credits a trace only from these three stdout fields and the
    // two files they name (run-proofs.sh, TRACE_COLLECTED).
    const out = JSON.parse(collected.stdout);
    assert.equal(out.traceId, TRACE_ID);
    assert.equal(out.receiptFile, 'continuation-trace-correlation.json');
    assert.ok(collected.files.includes(out.traceFile));
    // The re-poll waited the configured time after the empty search.
    assert.ok(collected.searches.length >= 3, 'empty search, re-poll, then stabilization and finality');
    assert.ok(collected.searches[1].atMs - collected.searches[0].atMs >= 400, 'the re-poll waited the configured 0.4 s');
    for (const search of collected.searches) {
      assert.deepEqual({ start: search.start, end: search.end }, { start: modelWindow.start, end: modelWindow.end });
    }

    const receipt = await readJson(collected.dir, out.receiptFile);
    assert.equal(receipt.searchAttempts.length, 2);
    assertAttempt(receipt.searchAttempts[0], { attempt: 1, result: 'no-match' });
    assertAttempt(receipt.searchAttempts[1], { attempt: 2, result: 'matched', repollWaitSeconds: 0.4 });
    assert.ok(Date.parse(receipt.searchAttempts[1].startedAt) - Date.parse(receipt.searchAttempts[0].endedAt) >= 400);
    assert.equal(
      receipt.stabilization.searchQueryCount,
      2 + receipt.stabilization.stabilizationQueryCount + receipt.stabilization.finalQueryCount,
    );

    // Routed as found: the row holds both trace receipts it owes, so review
    // debt routes nothing for them.
    const observability = { traceId: out.traceId, tempoTraceJson: out.traceFile, correlationReceipt: out.receiptFile };
    assert.deepEqual(
      traceReceiptFindings(model.manifest, observability, { runDir: collected.dir }),
      TRACE_RECEIPTS.map((receipt) => ({ receipt, held: true, reason: null })),
    );
  } finally {
    await rm(collected.dir, { recursive: true, force: true });
  }
});

test('(b) both searches empty: uncorrelated, both attempts recorded, and review debt names the re-poll', BOUNDED, async () => {
  const collected = await collect({ repollSeconds: '0.3' });
  try {
    assert.equal(collected.ok, false);
    assert.equal(collected.code, 1);
    // The run's own log line stays a prefix, so existing readers still match it.
    assert.match(collected.stderr, /^no Tempo trace matched reason hash 17d1c4cdcab47769 before timeout, nor on a re-poll 0\.3 s later \(/u);
    assert.match(collected.stderr, /2026-11-18T05:45:14Z\.\.2026-11-18T05:50:15Z/u);
    assert.equal(collected.searches.length, 2, 'one search, one re-poll, nothing more');
    assert.ok(collected.searches[1].atMs - collected.searches[0].atMs >= 300, 'the re-poll waited the configured 0.3 s');
    assert.deepEqual(collected.fetches, []);
    assert.ok(!collected.files.includes('continuation-trace-correlation.json'), 'no correlation receipt for an uncorrelated row');

    // The collector's search record: what the runner keeps as continuation-trace-collector.json.
    const record = JSON.parse(collected.stdout);
    assert.equal(record.schema, 'openclaw.k6.trace-search-record.v1');
    assert.equal(record.row, 'R-CD-MODEL-DEFAULT');
    assert.equal(record.seat, fixture.seat);
    assert.deepEqual(record.reason, { hash: '17d1c4cdcab47769', length: 306 });
    assert.match(record.query, /name="continuation\.delegate\.dispatch" && \.reason\.hash="17d1c4cdcab47769" && \.reason\.length=306/u);
    assert.equal(record.searchAttempts.length, 2);
    assertAttempt(record.searchAttempts[0], { attempt: 1, result: 'no-match' });
    assertAttempt(record.searchAttempts[1], { attempt: 2, result: 'no-match', repollWaitSeconds: 0.3 });
    assert.ok(Date.parse(record.searchAttempts[1].startedAt) - Date.parse(record.searchAttempts[0].endedAt) >= 300);

    const { items, text } = await summarizeRun(collected.dir);
    for (const item of items) {
      assert.equal(item.class, 'tempo-trace-uncorrelated', item.receipt);
      assert.deepEqual(item.repoll, {
        waitSeconds: 0.3,
        attempts: record.searchAttempts.map(({ attempt, startedAt, endedAt, result }) => ({ attempt, startedAt, endedAt, result })),
      });
      assert.match(item.action, /no trace was correlated, on the collector's first search or on its re-poll 0\.3 s later/u);
      // 0.3 s is no blocklist-poll period: the route must not discount the gap.
      assert.match(item.action, /that re-poll came sooner than one blocklist-poll period plus margin \(330 s\)/u);
      assert.match(item.action, /search again at least that long after the collector did/u);
      assert.doesNotMatch(item.action, /is unlikely to explain it/u);
      // The fingerprint comparison stays the next step.
      assert.match(item.action, /If it reads "no Tempo trace matched"/u);
      assert.match(item.action, /relayed different task bytes/u);
    }
    assert.match(text, /tempo-trace-uncorrelated: [^\n]*re-poll 0\.3 s later/u);

    // The same record with the re-poll moved later. Only one blocklist-poll
    // period plus margin (the 330 s default) makes a single gap unlikely; a
    // bare poll period (300 s) leaves no margin for the poll itself.
    const [first, repoll] = record.searchAttempts;
    for (const [waitSeconds, discounted] of [[300, false], [330, true]]) {
      const shifted = (iso) => new Date(Date.parse(iso) + waitSeconds * 1000).toISOString();
      const later = {
        ...record,
        searchAttempts: [first, { ...repoll, repollWaitSeconds: waitSeconds, startedAt: shifted(repoll.startedAt), endedAt: shifted(repoll.endedAt) }],
      };
      await writeFile(path.join(collected.dir, 'continuation-trace-collector.json'), `${JSON.stringify(later)}\n`);
      for (const item of (await summarizeRun(collected.dir)).items) {
        assert.equal(item.repoll.waitSeconds, waitSeconds);
        if (discounted) {
          assert.match(item.action, /on its re-poll 330 s later, so a single Tempo blocklist-poll gap, which heals within one poll period, is unlikely to explain it/u);
        } else {
          assert.match(item.action, /on its re-poll 300 s later; that re-poll came sooner than one blocklist-poll period plus margin/u);
        }
      }
    }
  } finally {
    await rm(collected.dir, { recursive: true, force: true });
  }
});

test('a collection that fails after its re-poll still records both attempts, and review debt says how the re-poll ended', BOUNDED, async () => {
  // The re-poll finds the trace, then the stabilization or finality search
  // comes back empty: the record keeps the re-poll's match.
  const lost = await collect({ found: (n) => n === 2, repollSeconds: '0.2' });
  try {
    assert.equal(lost.ok, false);
    assert.match(lost.stderr, /candidate set changed during stabilization: no traces matched|final trace correlation query found no matching Tempo trace/u);
    assert.ok(!lost.files.includes('continuation-trace-correlation.json'));
    const record = JSON.parse(lost.stdout);
    assert.deepEqual(record.searchAttempts.map((entry) => entry.result), ['no-match', 'matched']);
    assertAttempt(record.searchAttempts[1], { attempt: 2, result: 'matched', repollWaitSeconds: 0.2 });
    for (const item of (await summarizeRun(lost.dir)).items) {
      assert.equal(item.class, 'tempo-trace-uncorrelated');
      assert.deepEqual(item.repoll.attempts.map((entry) => entry.result), ['no-match', 'matched']);
      assert.match(item.action, /re-poll 0\.2 s after its first search found none did find a trace, but the collection failed after it/u);
    }
  } finally {
    await rm(lost.dir, { recursive: true, force: true });
  }

  // The re-poll itself fails: the attempt it cut short is recorded as an error.
  const dir = await mkdtemp(path.join(tmpdir(), 'tempo-repoll-error-'));
  let searches = 0;
  const server = createServer((request, response) => {
    searches += 1;
    if (searches === 1) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ traces: [] }));
      return;
    }
    response.writeHead(503, { 'content-type': 'application/json' }).end('{"error":"tempo unavailable"}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const evidencePath = path.join(dir, 'private-evidence.jsonl');
    const manifestPath = path.join(dir, 'row-manifest.json');
    await writeFile(evidencePath, `${JSON.stringify(model.runResult.evidence)}\n`);
    await writeFile(manifestPath, `${JSON.stringify(model.manifest)}\n`);
    const env = { ...process.env, [REPOLL_ENV]: '0.1' };
    delete env.OPENCLAW_PROOFS_SERVICE_NAME;
    const failed = await run(process.execPath, [
      collector, '--run-dir', dir, '--manifest', manifestPath, '--seat', fixture.seat, '--evidence', evidencePath,
      '--tempo-url', `http://127.0.0.1:${server.address().port}`, '--timeout-ms', '0', '--poll-ms', '10',
    ], { encoding: 'utf8', env }).then(() => null, (error) => error);
    assert.equal(failed?.code, 1);
    assert.match(failed.stderr, /^Tempo search failed: HTTP 503/u);
    assert.equal(searches, 2);
    const record = JSON.parse(failed.stdout);
    assertAttempt(record.searchAttempts[0], { attempt: 1, result: 'no-match' });
    assertAttempt(record.searchAttempts[1], { attempt: 2, result: 'error', repollWaitSeconds: 0.1 });
    await writeFile(path.join(dir, 'continuation-trace-collector.json'), failed.stdout);
    for (const item of (await summarizeRun(dir)).items) {
      assert.match(item.action, /re-poll 0\.1 s after its first search found none failed with an error \(its log names why\), and Tempo can miss/u);
    }
    // A re-poll whose trace never validated says so.
    const invalid = { ...record, searchAttempts: [record.searchAttempts[0], { ...record.searchAttempts[1], result: 'invalid-topology' }] };
    await writeFile(path.join(dir, 'continuation-trace-collector.json'), `${JSON.stringify(invalid)}\n`);
    for (const item of (await summarizeRun(dir)).items) {
      assert.match(item.action, /re-poll 0\.1 s after its first search found none found a trace that never validated/u);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test('(b) a run without a re-poll record (run 44245772142) is told Tempo may have missed the trace', async () => {
  const { items } = await summarizeRun(null);
  for (const item of items) {
    assert.equal(item.class, 'tempo-trace-uncorrelated', item.receipt);
    assert.equal(item.repoll, null);
    assert.match(item.action, /no re-poll is recorded/u);
    assert.match(item.action, /one blocklist-poll period \(about 5 minutes\)/u);
    assert.match(item.action, /If it reads "no Tempo trace matched"/u);
  }
});

test('(b) a search record that is not this run\'s fingerprint and window is not credited', async () => {
  const collected = await collect({ repollSeconds: '0' });
  try {
    const record = JSON.parse(collected.stdout);
    const foreign = [
      { ...record, reason: { ...record.reason, hash: 'ffffffffffffffff' } },
      { ...record, searchAttempts: record.searchAttempts.map((entry) => ({ ...entry, window: { ...entry.window, endUnixSeconds: entry.window.endUnixSeconds + 1 } })) },
      { ...record, searchAttempts: record.searchAttempts.slice(0, 1) },
      { ...record, schema: 'openclaw.k6.trace-search-record.v0' },
    ];
    for (const hostile of foreign) {
      await writeFile(path.join(collected.dir, 'continuation-trace-collector.json'), `${JSON.stringify(hostile)}\n`);
      const { items } = await summarizeRun(collected.dir);
      for (const item of items) {
        assert.equal(item.class, 'tempo-trace-uncorrelated');
        assert.equal(item.repoll, null, JSON.stringify(hostile).slice(0, 120));
      }
    }
  } finally {
    await rm(collected.dir, { recursive: true, force: true });
  }
});

test('(c) an empty fingerprint is refused before any query and never re-polled', BOUNDED, async () => {
  for (const rowId of ['R-CD-3', 'R-CD-MODEL-CHAINED-ALT', 'R-CD-MODEL-TOKEN', 'R-CD-MODEL-TOOL', 'R-CD-COLLECTION-ON-COLLAPSE']) {
    const row = fixtureRow(rowId);
    assert.equal(row.collectorError, 'invalid evidence reason hash: (empty)', rowId);
    // A 5 s wait: a refusal that re-polled could not return inside it.
    const collected = await collect({ manifest: row.manifest, evidence: row.runResult.evidence, repollSeconds: '5' });
    try {
      assert.equal(collected.ok, false, rowId);
      assert.equal(collected.code, 1, rowId);
      assert.match(collected.stderr, /^invalid evidence reason hash: \(empty\)/u, rowId);
      assert.doesNotMatch(collected.stderr, /re-poll/u, rowId);
      assert.deepEqual(collected.searches, [], `${rowId} queried Tempo`);
      assert.equal(collected.stdout, '', `${rowId} wrote a search record`);
      assert.ok(collected.elapsedMs < 5000, `${rowId} waited ${collected.elapsedMs} ms`);
    } finally {
      await rm(collected.dir, { recursive: true, force: true });
    }
  }
});

test('a trace found by the first search writes the deterministic receipt it always did: no attempts, no wait', BOUNDED, async () => {
  const collected = await collect({ found: () => true, repollSeconds: '5' });
  try {
    assert.equal(collected.ok, true, collected.stderr);
    const out = JSON.parse(collected.stdout);
    const receipt = await readJson(collected.dir, out.receiptFile);
    assert.equal(Object.hasOwn(receipt, 'searchAttempts'), false);
    assert.equal(JSON.stringify(receipt).includes('startedAt'), false);
    assert.ok(collected.elapsedMs < 5000, `waited ${collected.elapsedMs} ms`);
  } finally {
    await rm(collected.dir, { recursive: true, force: true });
  }
});

test('a tool-window row (R-RC-1) re-polls too and records both attempts in its tool receipt', BOUNDED, async () => {
  const collected = await collect({
    manifest: rcRow.manifest,
    evidence: rcRow.evidence,
    trace: rcTrace(),
    traceId: RC_TRACE_ID,
    found: (n) => n >= 2,
    repollSeconds: '0.2',
    seat: 'ronan',
  });
  try {
    assert.equal(collected.ok, true, collected.stderr);
    const out = JSON.parse(collected.stdout);
    assert.equal(out.receiptFile, 'tool-trace-correlation.json');
    const receipt = await readJson(collected.dir, out.receiptFile);
    assert.deepEqual(receipt.searchAttempts.map((entry) => [entry.attempt, entry.result, entry.repollWaitSeconds]), [
      [1, 'no-match', undefined],
      [2, 'matched', 0.2],
    ]);
    assert.ok(collected.searches[1].atMs - collected.searches[0].atMs >= 200);
  } finally {
    await rm(collected.dir, { recursive: true, force: true });
  }

  const missing = await collect({ manifest: rcRow.manifest, evidence: rcRow.evidence, repollSeconds: '0', seat: 'ronan' });
  try {
    assert.equal(missing.ok, false);
    assert.match(missing.stderr, /^no Tempo trace matched tool request_compaction in the evidence window before timeout, nor on a re-poll 0 s later/u);
    const record = JSON.parse(missing.stdout);
    assert.deepEqual(record.tool, { name: 'request_compaction' });
    assert.equal(Object.hasOwn(record, 'reason'), false);
    assert.deepEqual(record.searchAttempts.map((entry) => entry.result), ['no-match', 'no-match']);
  } finally {
    await rm(missing.dir, { recursive: true, force: true });
  }
});

test('the re-poll wait is validated before any query: seconds, at most 3600, millisecond precision', BOUNDED, async () => {
  for (const value of ['-1', 'abc', '330s', '3601', '330000', '0.0005', '1e3']) {
    const collected = await collect({ repollSeconds: value });
    try {
      assert.equal(collected.ok, false, value);
      assert.match(collected.stderr, new RegExp(`^invalid ${REPOLL_ENV}: `, 'u'), value);
      assert.deepEqual(collected.searches, [], `${value} queried Tempo`);
    } finally {
      await rm(collected.dir, { recursive: true, force: true });
    }
  }
});

test('the default re-poll wait is one Tempo blocklist-poll period (5 min) plus margin: 330 s', async () => {
  const { DEFAULT_TEMPO_REPOLL_SECONDS, tempoRepollMs } = await import('../../lib/tempo-repoll.mjs');
  assert.equal(DEFAULT_TEMPO_REPOLL_SECONDS, 330);
  assert.equal(tempoRepollMs({}), 330000);
  assert.equal(tempoRepollMs({ [REPOLL_ENV]: '' }), 330000);
  assert.equal(tempoRepollMs({ [REPOLL_ENV]: '0' }), 0);
  assert.equal(tempoRepollMs({ [REPOLL_ENV]: '12.345' }), 12345);
  assert.equal(tempoRepollMs({ [REPOLL_ENV]: '3600' }), 3600000);
});
