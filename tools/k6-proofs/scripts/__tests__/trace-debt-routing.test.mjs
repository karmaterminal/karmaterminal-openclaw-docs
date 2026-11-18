// Trace-debt routing for live run 44245772142 (emeric, openclaw ab5a30ea,
// docs fe8e3c21).
//
// The run's review-debt.txt routed the trace receipts of seven rows to
// `tempo-trace-unfetchable: rerun with trace emission or explicitly accept
// trace-missing as an honest review limit`, and the collector logs of five of
// them read `invalid evidence reason hash: (empty)`. Tempo was not the cause
// for any of them. Four rows refused or stopped before they dispatched, so they
// recorded no reason fingerprint and the collector, correctly, queried nothing.
// R-CD-TOKEN stopped at its pre-dispatch gate. R-CD-COLLECTION-ON-COLLAPSE is a
// static validator that never fires. R-CD-MODEL-DEFAULT dispatched, but its
// parent relayed a rewritten task, so Tempo held its dispatch span under a
// fingerprint other than the one the scenario recorded.
//
// These tests materialize the seven run directories from the run's own
// artifacts (fixtures/run-44245772142-trace-debt.json), run the real
// summarize-review-debt.mjs over them as the workflow does, and hand the same
// public evidence to the real collector against a local Tempo. No seat,
// gateway or live Tempo is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const summarizer = path.resolve(here, '../summarize-review-debt.mjs');
const collector = path.resolve(here, '../collect-continuation-trace.mjs');
const fixture = JSON.parse(await readFile(path.join(here, 'fixtures/run-44245772142-trace-debt.json'), 'utf8'));
const TRACE_RECEIPTS = ['tempo-trace-json', 'continuation-trace-correlation'];

function fixtureRow(rowId) {
  const row = fixture.rows.find((entry) => entry.rowId === rowId);
  assert.ok(row, `fixture row ${rowId}`);
  return row;
}

async function writeRunDir(root, row, { manifest = row.manifest, runResult = row.runResult } = {}) {
  const dir = path.join(root, fixture.candidateSha, row.rowId, fixture.seat, row.runId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'run-result.json'), `${JSON.stringify(runResult, null, 2)}\n`);
  if (manifest) await writeFile(path.join(dir, 'row-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return dir;
}

async function summarize(rows, overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'trace-debt-routing-'));
  try {
    for (const row of rows) await writeRunDir(root, row, overrides[row.rowId]);
    const [json, text] = await Promise.all([
      run(process.execPath, [summarizer, '--run-root', root, '--json'], { encoding: 'utf8' }),
      run(process.execPath, [summarizer, '--run-root', root], { encoding: 'utf8' }),
    ]);
    return { summary: JSON.parse(json.stdout), text: text.stdout };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function pendingFor(summary, rowId) {
  const row = summary.pending.find((entry) => entry.rowId === rowId);
  assert.ok(row, `${rowId} is review-pending`);
  return row;
}

function traceItems(row) {
  const items = row.pending.filter((item) => TRACE_RECEIPTS.includes(item.receipt));
  assert.deepEqual(items.map((item) => item.receipt).sort(), [...TRACE_RECEIPTS].sort());
  return items;
}

test('run 44245772142: the fixture is the run the workflow fired', () => {
  assert.equal(fixture.docsRef, 'fe8e3c2188f4a3cb82a7c04c47dab96d49e13955');
  assert.equal(fixture.candidateSha, 'ab5a30ea79b776f149e24b1fccab9e79b0a5d299');
  assert.equal(fixture.rows.length, 7);
  for (const row of fixture.rows) {
    for (const receipt of TRACE_RECEIPTS) {
      assert.ok(row.runResult.review.pendingReceipts.includes(receipt), `${row.rowId} owes ${receipt}`);
    }
    assert.equal(row.runResult.observability.traceId, null, `${row.rowId} has no trace id`);
  }
  // The collector refused five of them before querying Tempo.
  const empty = fixture.rows.filter((row) => row.collectorError === 'invalid evidence reason hash: (empty)');
  assert.deepEqual(empty.map((row) => row.rowId).sort(), [
    'R-CD-3', 'R-CD-COLLECTION-ON-COLLAPSE', 'R-CD-MODEL-CHAINED-ALT', 'R-CD-MODEL-TOKEN', 'R-CD-MODEL-TOOL',
  ]);
});

test('run 44245772142: no trace receipt of the seven rows is routed to a Tempo rerun', async () => {
  const { summary, text } = await summarize(fixture.rows);
  assert.equal(summary.totalRows, 7);
  assert.equal(summary.pendingRows, 7);
  for (const row of fixture.rows) {
    const pending = pendingFor(summary, row.rowId);
    // Routing never adds, drops or reorders a receipt the run owes.
    assert.deepEqual(pending.pendingReceipts, row.runResult.review.pendingReceipts, row.rowId);
    for (const item of traceItems(pending)) {
      assert.notEqual(item.class, 'tempo-trace-unfetchable', `${row.rowId} ${item.receipt}`);
      assert.doesNotMatch(item.action, /rerun with trace emission/, `${row.rowId} ${item.receipt}`);
      assert.equal(item.fetchable, false);
      assert.equal(item.traceId, null);
    }
  }
  assert.equal(summary.byClass['tempo-trace-unfetchable'], undefined);
  assert.doesNotMatch(text, /tempo-trace-unfetchable|rerun with trace emission/);
});

test('run 44245772142: rows that recorded no reason fingerprint are routed to their own refusal', async () => {
  const { summary, text } = await summarize(fixture.rows);
  const expected = {
    'R-CD-3': {
      rowReason: 'context fill stopped before the proof turn: reaching 75% of a 922000-token window needs about 663127 filler tokens, over the 300000-token fill budget',
      rowDispatched: false,
    },
    'R-CD-MODEL-CHAINED-ALT': {
      rowReason: 'no override model configured (set OPENCLAW_ALT_MODEL or manifest invocation.model to a provider/model)',
      rowDispatched: false,
    },
    'R-CD-MODEL-TOKEN': {
      rowReason: 'no override model configured (set OPENCLAW_ALT_MODEL or manifest invocation.model to a provider/model)',
      rowDispatched: null,
    },
    'R-CD-MODEL-TOOL': {
      rowReason: 'no override model configured (set OPENCLAW_ALT_MODEL or manifest invocation.model to a provider/model)',
      rowDispatched: false,
    },
    'R-CD-TOKEN': { rowReason: null, rowDispatched: false },
  };
  for (const [rowId, { rowReason, rowDispatched }] of Object.entries(expected)) {
    for (const item of traceItems(pendingFor(summary, rowId))) {
      assert.equal(item.class, 'trace-no-reason-fingerprint', `${rowId} ${item.receipt}`);
      assert.equal(item.rowReason, rowReason, rowId);
      assert.equal(item.rowDispatched, rowDispatched, rowId);
      assert.match(item.action, /recorded no reason fingerprint/);
      assert.match(item.action, /refire/);
    }
  }
  // R-CD-TOKEN's behavior receipts stay manual review; only its trace debt is routed.
  const token = pendingFor(summary, 'R-CD-TOKEN');
  for (const item of token.pending.filter((entry) => !TRACE_RECEIPTS.includes(entry.receipt))) {
    assert.equal(item.class, 'manual-review', item.receipt);
  }
  assert.equal(summary.byClass['trace-no-reason-fingerprint'], 10);
  assert.match(text, /R-CD-MODEL-TOOL[\s\S]*trace-no-reason-fingerprint: [^\n]*no override model configured/);
});

test('run 44245772142: the static validator row is routed to fold review, never to a rerun', async () => {
  const { summary } = await summarize(fixture.rows);
  for (const item of traceItems(pendingFor(summary, 'R-CD-COLLECTION-ON-COLLAPSE'))) {
    assert.equal(item.class, 'trace-static-row', item.receipt);
    assert.match(item.action, /fires nothing/);
    assert.match(item.action, /fold review/);
  }
});

test('run 44245772142: a recorded fingerprint no trace matched is routed to a fingerprint comparison', async () => {
  const { summary, text } = await summarize(fixture.rows);
  for (const item of traceItems(pendingFor(summary, 'R-CD-MODEL-DEFAULT'))) {
    assert.equal(item.class, 'tempo-trace-uncorrelated', item.receipt);
    assert.equal(item.reasonHash, '17d1c4cdcab47769');
    assert.equal(item.reasonLength, 306);
    assert.equal(item.delegateMode, 'normal');
    assert.equal(item.acceptSpan, 'continuation.delegate.dispatch');
    assert.deepEqual(item.window, { start: '2026-11-18T05:46:14.977Z', end: '2026-11-18T05:49:15.291Z' });
    assert.match(item.action, /relayed different task bytes/);
  }
  assert.match(text, /tempo-trace-uncorrelated: [^\n]*17d1c4cdcab47769\/306/);
});

test('routing reads only what the run recorded: absent evidence, a malformed fingerprint and legacy results', async () => {
  const model = fixtureRow('R-CD-MODEL-DEFAULT');
  const tool = fixtureRow('R-CD-MODEL-TOOL');
  const rcd3 = fixtureRow('R-CD-3');
  const alt = fixtureRow('R-CD-MODEL-CHAINED-ALT');
  const { evidence: _dropped, ...withoutEvidenceKey } = alt.runResult;
  const { summary } = await summarize([model, tool, rcd3, alt], {
    // The runner always records `evidence`; a result without the key was not
    // written with it (before 891831e4, or by hand) and says nothing.
    'R-CD-MODEL-CHAINED-ALT': { runResult: withoutEvidenceKey },
    // A run that wrote no evidence record: nothing was dispatched to attribute.
    'R-CD-MODEL-DEFAULT': { runResult: { ...model.runResult, evidence: null } },
    // A fingerprint the collector would refuse is no fingerprint to search by.
    'R-CD-MODEL-TOOL': { runResult: { ...tool.runResult, evidence: { ...tool.runResult.evidence, reason_hash: 'zz', reason_length: 9 } } },
    // A result without its row manifest carries no row contract (pre-054ec33f):
    // it keeps the generic route.
    'R-CD-3': { manifest: null },
  });
  for (const item of traceItems(pendingFor(summary, 'R-CD-MODEL-DEFAULT'))) {
    assert.equal(item.class, 'trace-no-row-evidence', item.receipt);
  }
  for (const item of traceItems(pendingFor(summary, 'R-CD-MODEL-TOOL'))) {
    assert.equal(item.class, 'trace-no-reason-fingerprint', item.receipt);
  }
  for (const rowId of ['R-CD-3', 'R-CD-MODEL-CHAINED-ALT']) {
    const legacy = pendingFor(summary, rowId).pending.find((item) => item.receipt === 'tempo-trace-json');
    assert.equal(legacy.class, 'tempo-trace-unfetchable', rowId);
  }
});

test('an authoritative-receipt row keeps the generic route: its public evidence withholds acquisition by design', async () => {
  const model = fixtureRow('R-CD-MODEL-DEFAULT');
  const { summary } = await summarize([model], {
    'R-CD-MODEL-DEFAULT': {
      runResult: {
        ...model.runResult,
        evidence: { row: 'R-CD-MODEL-DEFAULT', verdict: 'PARTIAL-candidate', authoritativeReceipt: 'receipt.json' },
      },
    },
  });
  const item = pendingFor(summary, 'R-CD-MODEL-DEFAULT').pending.find((entry) => entry.receipt === 'tempo-trace-json');
  assert.equal(item.class, 'tempo-trace-unfetchable');
});

async function collect(row, { traces = [] } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'trace-debt-collect-'));
  const queries = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    queries.push(url.pathname);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(url.pathname === '/api/search' ? { traces } : {}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const evidencePath = path.join(dir, 'evidence.jsonl');
  const manifestPath = path.join(dir, 'row-manifest.json');
  await writeFile(evidencePath, `${JSON.stringify(row.runResult.evidence)}\n`);
  await writeFile(manifestPath, `${JSON.stringify(row.manifest)}\n`);
  const env = { ...process.env };
  delete env.OPENCLAW_PROOFS_SERVICE_NAME;
  try {
    await run(process.execPath, [
      collector,
      '--run-dir', dir,
      '--manifest', manifestPath,
      '--seat', fixture.seat,
      '--evidence', evidencePath,
      '--tempo-url', `http://127.0.0.1:${server.address().port}`,
      '--timeout-ms', '50',
      '--poll-ms', '10',
    ], { encoding: 'utf8', env });
    return { ok: true, queries };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { ok: false, code: error.code, stderr: error.stderr, queries };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

test('collector: an evidence record with no reason fingerprint is refused with its cause, before any Tempo query', async () => {
  for (const rowId of ['R-CD-3', 'R-CD-MODEL-CHAINED-ALT', 'R-CD-MODEL-TOKEN', 'R-CD-MODEL-TOOL', 'R-CD-COLLECTION-ON-COLLAPSE']) {
    const collected = await collect(fixtureRow(rowId));
    assert.equal(collected.ok, false, rowId);
    assert.equal(collected.code, 1, rowId);
    // The run's own log line stays a prefix, so existing readers still match it.
    assert.match(collected.stderr, /^invalid evidence reason hash: \(empty\)/, rowId);
    assert.match(collected.stderr, /recorded no reason fingerprint/, rowId);
    assert.match(collected.stderr, /refused or stopped before dispatch/, rowId);
    assert.deepEqual(collected.queries, [], `${rowId} queried Tempo`);
  }
});

test('collector: a recorded fingerprint no trace matched names the fingerprint, span and window it searched', async () => {
  const collected = await collect(fixtureRow('R-CD-MODEL-DEFAULT'));
  assert.equal(collected.ok, false);
  assert.match(collected.stderr, /no Tempo trace matched reason hash 17d1c4cdcab47769 before timeout/);
  assert.match(collected.stderr, /reason length 306/);
  assert.match(collected.stderr, /delegate mode normal/);
  assert.match(collected.stderr, /continuation\.delegate\.dispatch spans of service emeric-prince/);
  assert.match(collected.stderr, /2026-11-18T05:45:14Z\.\.2026-11-18T05:50:15Z/);
  assert.match(collected.stderr, /relayed different task bytes/);
  assert.ok(collected.queries.length > 0, 'the collector searched Tempo');
  assert.ok(collected.queries.every((pathname) => pathname === '/api/search'));
});
