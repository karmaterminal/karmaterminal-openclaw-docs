// Continuation reason attribution (karmaterminal-openclaw-docs#600).
//
// Live trap (emeric isolated gateway, runtime and candidate
// 293c977f629f872a643fb94892603310b887293b, docs dcc6330c40, matrix 012658Z):
// the rows' behaviour passed but collect-continuation-trace.mjs could not
// attribute their traces. R-CD-SILENT and R-CD-MODEL-TOKEN refused with
// `continue_delegate manifest promptTemplate is required`; R-CD-MODEL-CHAINED-ALT
// and R-CD-3 searched Tempo for the hash of a manifest template their scenarios
// never dispatched and timed out with `no Tempo trace matched reason hash ...`.
//
// Each test fires the real scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs), passes its log through the real extractor as
// run-proofs.sh does, and runs the real collector on the private evidence
// against a local Tempo that holds the spans the product emits. Tempo answers
// a search only when a span carries the queried name, reason hash, length and
// delegate mode, as TraceQL does. The expected reason is re-derived from the
// frame the scenario sent by the product rules below, never from the
// scenario's own fingerprint. No live gateway, seat or Tempo is used.
//
// Product reason contract at karmaterminal/openclaw 293c977f62:
// - continuation.delegate.dispatch and .fire carry
//   reason.hash = sha256(redactToolPayloadText(delegate.task)).slice(0, 16) and
//   reason.length = delegate.task.length (src/infra/continuation-tracer.ts
//   continuationReasonAttributes; src/auto-reply/continuation/delegate-dispatch.ts
//   passes reason: delegate.task to both spans). Redaction leaves every proof
//   task here unchanged (probed against that SHA).
// - typed continue_delegate: delegate.task = params.task.trim()
//   (src/agents/tools/continue-delegate-tool.ts; readToolStringParam trims).
// - [[CONTINUE_DELEGATE: ...]]: delegate.task is the bracket body without its
//   trailing `| directive` segments and ` +Ns` delay
//   (src/auto-reply/continuation/signal.ts parseContinuationSignal).
// - continue_work: continuation.work and .work.fire hash
//   params.reason.trim().slice(0, 1024) (src/agents/tools/continue-work-tool.ts).
// - mode=post-compaction stages the delegate; release spawns it from
//   src/auto-reply/reply/post-compaction-delegate-delivery.ts, which emits no
//   continuation.delegate.dispatch or .fire span (only
//   continuation.compaction.released, which carries no reason).
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
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { sanitizeEvidenceRecords } from '../scripts/sanitize-k6-artifacts.mjs';
import { traceContract } from '../scripts/collect-continuation-trace.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collector = path.join(root, 'scripts/collect-continuation-trace.mjs');
const traceId = '7'.repeat(32);
const chainId = '12345678-1234-4123-8123-123456789abc';
const ALT_MODEL = 'openai-codex/gpt-5.5';

function sha16(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function manifestPath(file) {
  return path.join(root, 'manifests', file);
}

async function readManifest(file) {
  return JSON.parse(await readFile(manifestPath(file), 'utf8'));
}

// R-CD-3 fills its disposable session with measured prior turns before the
// proof turn (#1727): each fill turn ends (lifecycle end) and raises the fresh
// total that sessions.describe reports, until usage passes the threshold.
const FILL_TURN = / context fill \d+ for nonce /u;

function gatewayFor(row) {
  const fill = { turns: 0, total: 0 };
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect':
        return ok({ type: 'hello-ok', features: { methods: [...(ROW_METHODS[row] || [])] } });
      case 'sessions.create':
        return ok({ key: `agent:main:${String(frame.params?.key || 'disposable')}` });
      case 'sessions.messages.subscribe':
        return ok({ subscribed: true, key: frame.params?.key });
      case 'sessions.send':
        if (FILL_TURN.test(String(frame.params?.message || ''))) {
          fill.turns += 1;
          fill.total += 80000;
          const runId = `run-${row.toLowerCase()}-fill-${fill.turns}`;
          return [
            ...ok({ runId, traceId: null }),
            { type: 'event', event: 'agent', payload: { runId, stream: 'lifecycle', data: { phase: 'end', aborted: false } } },
          ];
        }
        return ok({ runId: `run-${row.toLowerCase()}`, traceId: null });
      case 'sessions.list':
        return ok({ sessions: [] });
      case 'chat.history':
        return ok({ messages: [] });
      case 'sessions.describe':
        return ok({ session: fill.turns > 0 ? { totalTokens: fill.total, totalTokensFresh: true, contextTokens: 200000 } : null });
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

/** Fire the real scenario once; return its private and public evidence and the dispatch it sent. */
async function fireScenario({ row, scenario, manifest, env = {} }) {
  const { log, frames } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', scenario),
    gateway: gatewayFor(row),
    env: {
      OPENCLAW_ROW_MANIFEST: manifestPath(manifest),
      OPENCLAW_GATEWAY_TOKEN: 'docs-600-reason-attribution-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'a'.repeat(40),
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: `agent:main:docs-600-${row.toLowerCase()}`,
      OPENCLAW_ALT_MODEL: ALT_MODEL,
      ...env,
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `expected one evidence record in the ${row} scenario log:\n${log}`);
  const [privateEvidence] = records;
  const { sanitized: [publicEvidence] } = sanitizeEvidenceRecords(records);
  const dispatches = frames.filter((frame) => frame.method === 'sessions.send' && !FILL_TURN.test(String(frame.params?.message || '')));
  assert.ok(dispatches.length >= 1, `${row} dispatched its proof instruction`);
  return { privateEvidence, publicEvidence, dispatch: dispatches[0].params.message };
}

/** The JSON string literal after `key=` in a dispatched instruction (first occurrence). */
function quotedValueAfter(text, key) {
  const start = text.indexOf(`${key}=`);
  assert.ok(start >= 0, `dispatched text names ${key}=`);
  const open = start + key.length + 1;
  assert.equal(text[open], '"', `${key}= is followed by a quoted string`);
  let close = open + 1;
  while (close < text.length && text[close] !== '"') close += text[close] === '\\' ? 2 : 1;
  return JSON.parse(text.slice(open, close + 1));
}

/** Product: typed continue_delegate task / continue_work reason, as the tool reads it. */
function typedReason(dispatch, key = 'task', maxLength = Infinity) {
  return quotedValueAfter(dispatch, key).trim().slice(0, maxLength);
}

const DELEGATE_DIRECTIVE_WORDS = new Set([
  'normal', 'silent', 'silent-wake', 'silent wake', 'post-compaction', 'postcompaction', 'post compaction',
]);
const DELEGATE_DIRECTIVE_KEYS = new Set([
  'target', 'targetsessionkey', 'target_session_key', 'targets', 'targetsessionkeys', 'target_session_keys',
  'fanout', 'fanoutmode', 'fanout_mode', 'traceparent', 'trace_parent', 'model',
]);

/**
 * Product: the delegate task parseContinuationSignal takes from a final reply
 * that ends with the bracket the origin child was told to emit verbatim.
 */
function bracketReason(dispatch) {
  const childTask = quotedValueAfter(dispatch, 'task');
  const start = childTask.indexOf('[[CONTINUE_DELEGATE:');
  assert.ok(start >= 0, 'the origin child task carries a terminal CONTINUE_DELEGATE bracket');
  const finalReply = childTask.slice(start, childTask.indexOf(']]', start) + 2);
  const body = finalReply.trim().match(/\[\[\s*CONTINUE_DELEGATE:\s*((?:(?!\]\])[\s\S])+?)\s*\]\]\s*$/u)?.[1];
  assert.ok(body, 'the bracket parses');
  const segments = body.trim().split('|').map((segment) => segment.trim());
  while (segments.length > 1) {
    const segment = segments.at(-1);
    const separator = segment.indexOf('=');
    const key = separator < 0 ? null : segment.slice(0, separator).trim().toLowerCase();
    if (!DELEGATE_DIRECTIVE_WORDS.has(segment.toLowerCase()) && !DELEGATE_DIRECTIVE_KEYS.has(key)) break;
    segments.pop();
  }
  let task = segments.join(' | ').trim();
  const delay = task.match(/\s+\+(\d+)s\s*$/u);
  if (delay) task = task.slice(0, -delay[0].length).trimEnd();
  return task.slice(0, 4096);
}

function attr(key, value) {
  return { key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: String(value) } };
}

function spanOf(name, spanId, startNs, attributes) {
  return {
    name,
    traceId,
    spanId,
    parentSpanId: '5'.repeat(16),
    status: { code: 1 },
    attributes,
    startTimeUnixNano: String(startNs),
    endTimeUnixNano: String(startNs + 1000000n),
  };
}

function reasonAttrs(reason) {
  return [attr('reason.hash', sha16(reason)), attr('reason.length', reason.length)];
}

/**
 * The spans one timer-delivered delegate hop emits: its originating tool span
 * (typed origins only), then dispatch and fire on one chain.
 */
function delegateHop({ reason, mode, delayMs, originNs, typedOrigin, ids }) {
  const fireNs = originNs + BigInt(delayMs) * 1000000n;
  const continuation = [...reasonAttrs(reason), attr('delegate.mode', mode), attr('chain.id', ids.chain), attr('delay.ms', delayMs)];
  return [
    ...(typedOrigin ? [spanOf('openclaw.tool.execution', ids.tool, originNs, [attr('gen_ai.tool.name', 'continue_delegate')])] : []),
    spanOf('continuation.delegate.dispatch', ids.dispatch, fireNs, continuation),
    spanOf('continuation.delegate.fire', ids.fire, fireNs, [...continuation, attr('fire.deferred_ms', delayMs)]),
  ];
}

function traceOf(spans) {
  return { batches: [{ scopeSpans: [{ spans }] }] };
}

const ORIGIN_NS = 1793182600000000000n;
const ROOT_HOP_IDS = { chain: chainId, tool: '4'.repeat(16), dispatch: '2'.repeat(16), fire: '3'.repeat(16) };

/** A local Tempo that answers a TraceQL search only when a span matches it. */
function attributeOf(span, key) {
  const value = span.attributes.find((entry) => entry.key === key)?.value;
  return value?.stringValue ?? value?.intValue;
}

function searchMatches(spans, query) {
  // The span name, not resource.service.name.
  const name = query.match(/(?<![.\w])name="([^"]+)"/u)?.[1];
  const hash = query.match(/\.reason\.hash="([^"]+)"/u)?.[1];
  const length = query.match(/\.reason\.length=(\d+)/u)?.[1];
  const mode = query.match(/\.delegate\.mode="([^"]+)"/u)?.[1];
  return spans.some((span) => span.name === name &&
    attributeOf(span, 'reason.hash') === hash &&
    attributeOf(span, 'reason.length') === length &&
    (mode === undefined || attributeOf(span, 'delegate.mode') === mode));
}

async function collect({ manifest, evidence, trace }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'docs-600-reason-attribution-'));
  const spans = trace.batches.flatMap((batch) => batch.scopeSpans.flatMap((scope) => scope.spans));
  const queries = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q') || '';
      queries.push(query);
      response.end(JSON.stringify({ traces: searchMatches(spans, query) ? [{ traceID: traceId }] : [] }));
    } else {
      response.end(JSON.stringify(trace));
    }
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
      '--manifest', manifestPath(manifest),
      '--seat', 'emeric-proof',
      '--evidence', evidencePath,
      '--tempo-url', `http://127.0.0.1:${server.address().port}`,
      '--timeout-ms', '60',
      '--poll-ms', '10',
    ], { encoding: 'utf8', env });
    const result = JSON.parse(stdout);
    return {
      ok: true,
      result,
      receipt: JSON.parse(await readFile(path.join(dir, result.receiptFile), 'utf8')),
      publicTrace: await readFile(path.join(dir, result.traceFile), 'utf8'),
      queries,
    };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { ok: false, stderr: error.stderr, queries, files: await readdir(dir) };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

function assertAttributed(collected, { reason, mode, originSurface, privateEvidence }) {
  assert.equal(collected.ok, true, collected.stderr);
  assert.equal(collected.result.traceId, traceId);
  assert.equal(collected.result.receiptFile, 'continuation-trace-correlation.json');
  assert.equal(collected.receipt.reason.hash, sha16(reason));
  assert.equal(collected.receipt.reason.length, reason.length);
  assert.equal(collected.receipt.reason.rawPersisted, false);
  if (mode !== undefined) assert.equal(collected.receipt.delegate.mode, mode);
  assert.equal(collected.receipt.continuation.originSurface, originSurface);
  assert.match(collected.queries[0], new RegExp(`\\.reason\\.hash="${sha16(reason)}" && \\.reason\\.length=${reason.length}`));
  for (const artifact of [JSON.stringify(collected.receipt), collected.publicTrace]) {
    assert.doesNotMatch(artifact, new RegExp(privateEvidence.nonce));
    assert.equal(artifact.includes(reason), false, 'the raw reason never reaches a public artifact');
  }
}

test('R-CD-SILENT: a typed silent delegate is attributed by the task it dispatched', async () => {
  const row = 'R-CD-SILENT';
  const manifest = 'r-cd-silent.json';
  const { privateEvidence, publicEvidence, dispatch } = await fireScenario({ row, scenario: 'r-cd-silent.js', manifest });
  // The task is scenario-owned: no manifest field renders it, so only the
  // scenario knows the dispatched fingerprint.
  const reason = typedReason(dispatch);
  // The child mints its own token; no harness-written token rides the task (#1727).
  assert.match(reason, /return exactly SILENTCHILD R-CD-SILENT-\d+-[a-z0-9]+ TOKEN <your token>\./u);
  const trace = traceOf(delegateHop({ reason, mode: 'silent', delayMs: 1000, originNs: ORIGIN_NS, typedOrigin: true, ids: ROOT_HOP_IDS }));
  const collected = await collect({ manifest, evidence: privateEvidence, trace });
  assertAttributed(collected, { reason, mode: 'silent', originSurface: 'typed-tool', privateEvidence });
  assert.equal(collected.receipt.reason.source, 'scenario-evidence');
  assert.equal(publicEvidence.nonce, undefined);
  assert.equal(JSON.stringify(publicEvidence).includes(reason), false);
});

test('R-CD-MODEL-TOKEN: a bracket delegate from a raw-final-text child is attributed by its parsed task', async () => {
  const row = 'R-CD-MODEL-TOKEN';
  const manifest = 'r-cd-model-token.json';
  const { privateEvidence, dispatch } = await fireScenario({ row, scenario: 'r-cd-model-token.js', manifest });
  const reason = bracketReason(dispatch);
  assert.match(reason, /^MTOKD:/u);
  // The origin is the child's final text; the parent fired sessions_spawn, so
  // the trace has no typed continue_delegate span.
  const trace = traceOf([
    spanOf('openclaw.tool.execution', '6'.repeat(16), ORIGIN_NS - 4000000000n, [attr('gen_ai.tool.name', 'sessions_spawn')]),
    ...delegateHop({ reason, mode: 'normal', delayMs: 1000, originNs: ORIGIN_NS, typedOrigin: false, ids: ROOT_HOP_IDS }),
  ]);
  const collected = await collect({ manifest, evidence: privateEvidence, trace });
  assertAttributed(collected, { reason, mode: 'normal', originSurface: 'raw-final-text', privateEvidence });
  assert.equal(collected.receipt.attribution, 'bracket-token-reason-hash-length-mode');
  assert.deepEqual(collected.receipt.toolSpanIds, []);
});

test('R-CD-MODEL-CHAINED-ALT: the root hop is attributed by the depth-1 task it dispatched, not the depth-2 hop', async () => {
  const row = 'R-CD-MODEL-CHAINED-ALT';
  const manifest = 'r-cd-model-chained-alt.json';
  const { privateEvidence, dispatch } = await fireScenario({ row, scenario: 'r-cd-model-chained-alt.js', manifest });
  const reason = typedReason(dispatch);
  const depth2Reason = typedReason(reason);
  assert.match(reason, /^MCH1:/u);
  assert.match(depth2Reason, /^MCH2:/u);
  // One trace carries both hops: the depth-1 child runs under the root fire and
  // calls continue_delegate itself.
  const depth1ToolNs = ORIGIN_NS + 9000000000n;
  const trace = traceOf([
    ...delegateHop({ reason, mode: 'normal', delayMs: 1000, originNs: ORIGIN_NS, typedOrigin: true, ids: ROOT_HOP_IDS }),
    ...delegateHop({
      reason: depth2Reason,
      mode: 'normal',
      delayMs: 1000,
      originNs: depth1ToolNs,
      typedOrigin: true,
      ids: { chain: chainId, tool: '8'.repeat(16), dispatch: '9'.repeat(16), fire: 'a'.repeat(16) },
    }),
  ]);
  const collected = await collect({ manifest, evidence: privateEvidence, trace });
  assertAttributed(collected, { reason, mode: 'normal', originSurface: 'typed-tool', privateEvidence });
  assert.equal(collected.receipt.dispatchSpanId, ROOT_HOP_IDS.dispatch);
  assert.deepEqual(collected.receipt.toolSpanIds, [ROOT_HOP_IDS.tool]);
});

test('R-CD-TOKEN: the scenario fingerprint is the product bracket reason (the 012658Z miss is not a derivation defect)', async () => {
  const row = 'R-CD-TOKEN';
  const manifest = 'r-cd-token.json';
  const rowNonce = 'R-CD-TOKEN-0f6a1d2e-3b4c-4d5e-8f60-718293a4b5c6';
  const { privateEvidence, dispatch } = await fireScenario({
    row,
    scenario: 'r-cd-token-bracket-delegate.js',
    manifest,
    env: { OPENCLAW_ROW_NONCE: rowNonce, OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true', OPENCLAW_SEAT_CLASS: 'raw-final-text' },
  });
  const reason = bracketReason(dispatch);
  const tag = sha16(rowNonce);
  assert.equal(reason, `D-${tag.slice(0, 12)} reply exactly RCDT-RETURN-${tag}`);
  // The runner owns the nonce and the scenario records only hashes, so on the
  // live fire the collector already searched for this exact fingerprint.
  assert.equal(privateEvidence.nonce, undefined);
  assert.equal(privateEvidence.reason_hash, sha16(reason));
  const trace = traceOf(delegateHop({ reason, mode: 'normal', delayMs: 10000, originNs: ORIGIN_NS, typedOrigin: false, ids: ROOT_HOP_IDS }));
  const collected = await collect({ manifest, evidence: privateEvidence, trace });
  assertAttributed(collected, { reason, mode: 'normal', originSurface: 'raw-final-text', privateEvidence: { nonce: rowNonce } });
  assert.equal(collected.receipt.reason.source, 'public-evidence');
});

test('R-CD-TOKEN: a nonce-bearing record never hashes the {{marker}}/{{tag}} template literally', async () => {
  const row = 'R-CD-TOKEN';
  const manifest = 'r-cd-token.json';
  const rowNonce = 'R-CD-TOKEN-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const { privateEvidence, dispatch } = await fireScenario({
    row,
    scenario: 'r-cd-token-bracket-delegate.js',
    manifest,
    env: { OPENCLAW_ROW_NONCE: rowNonce, OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true', OPENCLAW_SEAT_CLASS: 'raw-final-text' },
  });
  const reason = bracketReason(dispatch);
  // Post-run recovery may hand the collector a record that carries the
  // runner-owned nonce. The template's {{marker}} and {{tag}} are scenario
  // placeholders the nonce alone cannot fill.
  const evidence = { ...privateEvidence, nonce: rowNonce };
  const trace = traceOf(delegateHop({ reason, mode: 'normal', delayMs: 10000, originNs: ORIGIN_NS, typedOrigin: false, ids: ROOT_HOP_IDS }));
  const collected = await collect({ manifest, evidence, trace });
  assertAttributed(collected, { reason, mode: 'normal', originSurface: 'raw-final-text', privateEvidence: evidence });
  assert.equal(collected.receipt.reason.source, 'scenario-evidence');
});

test('R-CD-3: the lifeboat fingerprint is the task it staged, and collection stays fail-closed without a dispatch span', async () => {
  const row = 'R-CD-3';
  const manifest = 'r-cd-3.json';
  const { privateEvidence, dispatch } = await fireScenario({ row, scenario: 'r-cd-3-post-compaction.js', manifest });
  const reason = typedReason(dispatch);
  assert.match(reason, /post-compaction lifeboat nonce/u);
  const contract = traceContract(await readManifest(manifest), privateEvidence);
  assert.equal(contract.hash, sha16(reason));
  assert.equal(contract.length, reason.length);
  assert.equal(contract.mode, 'post-compaction');
  // What the product emits for a staged lifeboat: the two tool calls and, on
  // release, continuation.compaction.released. No span carries the reason.
  const trace = traceOf([
    spanOf('openclaw.tool.execution', '4'.repeat(16), ORIGIN_NS, [attr('gen_ai.tool.name', 'continue_delegate')]),
    spanOf('openclaw.tool.execution', 'b'.repeat(16), ORIGIN_NS + 1000000000n, [attr('gen_ai.tool.name', 'request_compaction')]),
    spanOf('continuation.compaction.released', 'c'.repeat(16), ORIGIN_NS + 9000000000n, [attr('released.count', 1)]),
  ]);
  const collected = await collect({ manifest, evidence: privateEvidence, trace });
  assert.equal(collected.ok, false);
  assert.match(collected.stderr, new RegExp(`no Tempo trace matched reason hash ${sha16(reason)} before timeout`));
  assert.ok(!collected.files.includes('continuation-trace-correlation.json'));
});

test('R-CW-2: an immediate continue_work wake is attributed by the reason it dispatched', async () => {
  const row = 'R-CW-2';
  const manifest = 'r-cw-2.json';
  const { privateEvidence, dispatch } = await fireScenario({ row, scenario: 'r-cw-2-immediate-wake.js', manifest });
  const reason = typedReason(dispatch, 'reason', 1024);
  // The reason carries the nonce, not the wake sentinel: the wake input quotes it (#1727).
  assert.match(reason, /^k6-proof-R-CW-2-immediate-R-CW-2-\d+-[a-z0-9]+$/u);
  assert.doesNotMatch(reason, /CW2-WOKE/u);
  // delaySeconds=0: the work span is emitted at election, the fire span when
  // the parked work runs after the electing turn ends.
  const continuation = [...reasonAttrs(reason), attr('chain.id', chainId), attr('delay.ms', 0)];
  const trace = traceOf([
    spanOf('openclaw.tool.execution', '4'.repeat(16), ORIGIN_NS, [attr('gen_ai.tool.name', 'continue_work')]),
    spanOf('continuation.work', '2'.repeat(16), ORIGIN_NS + 1000000n, continuation),
    spanOf('continuation.work.fire', '3'.repeat(16), ORIGIN_NS + 3000000000n, [...continuation, attr('fire.deferred_ms', 3000)]),
  ]);
  const collected = await collect({ manifest, evidence: privateEvidence, trace });
  assertAttributed(collected, { reason, originSurface: 'typed-tool', privateEvidence });
  assert.equal(collected.receipt.reason.source, 'manifest-nonce');
});

test('R-CW-4: the hop-1 continue_work reason is the row fingerprint', async () => {
  const row = 'R-CW-4';
  const manifest = 'r-cw-4.json';
  const { privateEvidence, dispatch } = await fireScenario({ row, scenario: 'r-cw-4-chain-depth.js', manifest });
  const reason = typedReason(dispatch, 'reason', 1024);
  assert.match(reason, /^R-CW-4 hop1 /u);
  const contract = traceContract(await readManifest(manifest), privateEvidence);
  assert.equal(contract.hash, sha16(reason));
  assert.equal(contract.length, reason.length);
  // The manifest reason is hop 1's, so the collector reproduces it from the nonce.
  assert.equal(contract.fingerprintSource, 'manifest-nonce');
});

for (const { row, scenario, manifest } of [
  { row: 'R-CD-MODEL-DEFAULT', scenario: 'r-cd-model-default.js', manifest: 'r-cd-model-default.json' },
  { row: 'R-CD-MODEL-TOOL', scenario: 'r-cd-model-tool.js', manifest: 'r-cd-model-tool.json' },
]) {
  test(`${row}: the scenario records the fingerprint the manifest template reproduces`, async () => {
    const { privateEvidence, dispatch } = await fireScenario({ row, scenario, manifest });
    const reason = typedReason(dispatch);
    assert.equal(privateEvidence.reason_hash, sha16(reason));
    assert.equal(privateEvidence.reason_length, reason.length);
    const trace = traceOf(delegateHop({ reason, mode: 'normal', delayMs: 1000, originNs: ORIGIN_NS, typedOrigin: true, ids: ROOT_HOP_IDS }));
    const collected = await collect({ manifest, evidence: privateEvidence, trace });
    assertAttributed(collected, { reason, mode: 'normal', originSurface: 'typed-tool', privateEvidence });
    assert.equal(collected.receipt.reason.source, 'manifest-nonce');
  });
}
