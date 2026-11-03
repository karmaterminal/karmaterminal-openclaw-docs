/**
 * r-cw-3-review-join.test.mjs — #1727.
 *
 * `run-proofs.sh` owned two unrelated notions of "review": the generic pending
 * list, which only ever tracked artifact acquisition, and R-CW-3's manifest
 * receipt `reason-telemetry-redaction-review`, which is a manual gate.  A
 * successful Tempo collection emptied the generic list, so the row's
 * run-result.json announced `ready-for-human-review` with no pending receipts
 * while nobody had reviewed the reason telemetry, and the candidate routing
 * envelope was emitted on that basis.
 *
 * These tests drive the real runner end to end (stub k6 + stub Tempo + stub
 * readiness gateway) and pin the repaired ownership boundary:
 *   - the manual review receipt is seeded from the manifest and is never
 *     discharged by the helper, by a successful trace fetch, or by the runner;
 *   - a successful join records a digest-bound receipt that claims no
 *     acceptance, beside — never over — the original VU evidence;
 *   - a failed or impossible join stays explicit as its own pending receipt;
 *   - the nearest sibling row's trace-only debt behaviour is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildHarnessCheckout } from './helpers/harness-checkout.mjs';
import { attachReadinessGateway } from './helpers/readiness-gateway.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const run = promisify(execFile);

const CANDIDATE_SHA = 'a'.repeat(40);
const SEAT = 'cael-dgx';
const TRACE_ID = '9'.repeat(32);
const TOOL_SPAN = '1a2b3c4d5e6f7081';
const TOOL_PARENT_SPAN = '00ff00ff00ff00ff';
const WORK_SPAN = '2b3c4d5e6f708192';
const FIRE_SPAN = '3c4d5e6f708192a3';
const CHAIN_ID = 'caecf55b-1945-4423-a6c4-67694094d597';
const MANUAL_RECEIPT = 'reason-telemetry-redaction-review';
const JOIN_RECEIPT = 'reason-telemetry-redaction-review-join';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function attr(key, value) {
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (typeof value === 'number') return { key, value: { intValue: String(value) } };
  return { key, value: { stringValue: String(value) } };
}

function continuationTrace({ reasonHash, reasonLength }) {
  const originNs = 1793061873000000000n;
  const reasonAttrs = [
    attr('chain.id', CHAIN_ID),
    attr('reason.present', true),
    attr('reason.length', reasonLength),
    attr('reason.hash', reasonHash),
  ];
  const span = (name, spanId, parentSpanId, attributes, offsetNs) => ({
    name,
    traceId: TRACE_ID,
    spanId,
    parentSpanId,
    status: { code: 1 },
    attributes,
    startTimeUnixNano: String(originNs + offsetNs),
    endTimeUnixNano: String(originNs + offsetNs + 1_000_000n),
  });
  return {
    batches: [{
      scopeSpans: [{
        spans: [
          span('openclaw.tool.execution', TOOL_SPAN, TOOL_PARENT_SPAN, [
            attr('openclaw.toolName', 'continue_work'),
            attr('gen_ai.tool.name', 'continue_work'),
          ], 0n),
          span('continuation.work', WORK_SPAN, TOOL_SPAN, reasonAttrs, 1_000_000_000n),
          span('continuation.work.fire', FIRE_SPAN, TOOL_SPAN, reasonAttrs, 5_000_000_000n),
        ],
      }],
    }],
  };
}

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function writeExecutable(file, source) {
  await writeFile(file, source, { mode: 0o755 });
  await chmod(file, 0o755);
}

/**
 * Fire one row through the real `run-proofs.sh` against stub k6/Tempo/gateway
 * and return its run directory. `tempo: 'unavailable'` makes trace correlation
 * fail the way a degraded backend does.
 */
async function runRowFixture({ rowId, summaryFile, tempo = 'available', mutate = null }) {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cw-3-review-join-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  await Promise.all([mkdir(bin, { recursive: true }), mkdir(out, { recursive: true })]);
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));

  const manifest = JSON.parse(await readFile(path.join(manifestsDir, `${rowId.toLowerCase()}.json`), 'utf8'));
  const nonce = `${rowId}-REVIEW-JOIN-NONCE`;
  const reason = String(manifest.invocation.reason).replaceAll('{{nonce}}', nonce);
  const reasonHash = sha256(reason).slice(0, 16);
  const reasonLength = reason.length;
  const dispatchAt = Date.now();
  const evidence = {
    row: rowId,
    manifest_loaded: true,
    seat: SEAT,
    session_created: true,
    candidateSha: CANDIDATE_SHA,
    nonce,
    started: new Date(dispatchAt - 1000).toISOString(),
    dispatch_accepted: true,
    tool_invoke_accepted: true,
    scheduled_sentinel: true,
    wake_observed: true,
    public_artifact_raw_reason_absent: true,
    tempo_assertion: 'pending-review',
    reason_hash: reasonHash,
    reason_length: reasonLength,
    trace_id: null,
    trace_id_source: null,
    dispatch_accepted_at_ms: dispatchAt,
    ended: new Date(dispatchAt + 10_000).toISOString(),
    duration_ms: 11_000,
  };
  const summary = {
    row: rowId,
    sha: CANDIDATE_SHA,
    seat: SEAT,
    verdict: 'PARTIAL-candidate',
    candidateOnly: true,
    foldRequiresReview: true,
    evidenceJsonl: 'evidence.jsonl',
    observability: { traceId: null, traceIdSource: null, traceJson: 'missing' },
    review: { status: 'review-pending', pendingReceipts: [MANUAL_RECEIPT] },
    metrics: { duration_ms: { max: 11000 }, failures: 0 },
  };
  const trace = continuationTrace({ reasonHash, reasonLength });

  const tempoServer = await listen((req, res) => {
    if (req.url.startsWith('/health') || req.url.startsWith('/status')) {
      res.writeHead(200).end('{}');
    } else if (req.url.startsWith('/api/search')) {
      if (tempo === 'unavailable') {
        res.writeHead(503).end('tempo unavailable');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ traces: [{ traceID: TRACE_ID }] }));
    } else if (req.url.startsWith(`/api/traces/${TRACE_ID}`)) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(trace));
    } else {
      res.writeHead(404).end();
    }
  });
  attachReadinessGateway(tempoServer.server, { token: 'review-join-token', runtimeSha: CANDIDATE_SHA });

  try {
    await writeExecutable(path.join(bin, 'openclaw'), '#!/bin/sh\nprintf \'%s\\n\' \'{"enabled":true,"maxChainLength":3,"maxDelegatesPerTurn":3,"costCapTokens":3}\'\n');
    await writeExecutable(path.join(bin, 'hostname'), `#!/bin/sh\nprintf '%s\\n' ${SEAT}\n`);
    await writeExecutable(path.join(bin, 'journalctl'), '#!/bin/sh\ncase " $* " in *" --show-cursor "*) printf \'%s\\n\' \'-- cursor: review-join\' ;; esac\n');
    await writeExecutable(path.join(bin, 'k6'), [
      '#!/bin/sh',
      'if [ "${1:-}" = version ]; then printf \'%s\\n\' \'k6 v2.0.0\'; exit 0; fi',
      `printf '%s %s\\n' '=== K6-PROOF-EVIDENCE ===' '${JSON.stringify(evidence)}'`,
      `printf '[%s] VERDICT: PARTIAL-candidate\\n' '${rowId}'`,
      `printf '%s\\n' '${JSON.stringify(summary)}' > '${summaryFile}'`,
      '',
    ].join('\n'));

    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      K6_BIN: path.join(bin, 'k6'),
      OPENCLAW_GATEWAY_TOKEN: 'review-join-token',
      OPENCLAW_GATEWAY_WS: tempoServer.baseUrl.replace(/^http/, 'ws'),
      OPENCLAW_PROOFS_TEMPO_BASE_URL: tempoServer.baseUrl,
      OPENCLAW_CANDIDATE_SHA: CANDIDATE_SHA,
      OPENCLAW_RUNTIME_BUILD_SHA: CANDIDATE_SHA,
      OPENCLAW_RUNTIME_SHA: CANDIDATE_SHA,
      OPENCLAW_GATEWAY_UNIT: 'openclaw-review-join.service',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      OPENCLAW_SESSION_KEY: 'agent:main:review-join',
      OPENCLAW_SEAT_NAME: SEAT,
    };
    const result = await run(
      'bash',
      ['scripts/run-proofs.sh', '--live', '--docs-ref', harness.docsRef, '--out-dir', out, rowId, CANDIDATE_SHA],
      { cwd: path.join(harness.checkout, 'tools/k6-proofs'), env, timeout: 120_000 },
    ).catch((error) => ({ stdout: error.stdout || '', stderr: error.stderr || '', code: error.code }));

    const runBase = path.join(out, CANDIDATE_SHA, rowId, SEAT);
    const [runId] = await readdir(runBase);
    const runDir = path.join(runBase, runId);
    if (mutate) await mutate({ runDir });
    return { root, out, runDir, runId, result, reasonHash, reasonLength, docsRef: harness.docsRef };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  } finally {
    await new Promise((resolve) => tempoServer.server.close(resolve));
  }
}

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const missing = async (file) => {
  await assert.rejects(readFile(file, 'utf8'), /ENOENT/);
};

test('the runner seeds and keeps R-CW-3 manual review debt the manifest declares', async () => {
  const manifest = await readJson(path.join(manifestsDir, 'r-cw-3.json'));
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes(MANUAL_RECEIPT));
  const runner = await readFile(path.join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');

  // The seed is row-scoped and manifest-driven, and the join runs after public
  // redaction so the reviewed bytes are the published bytes.
  const reset = runner.indexOf("REVIEW_PENDING_RECEIPTS='[]'");
  const seed = runner.indexOf('R_CW_3_REVIEW_REQUIRED=true');
  const sanitizer = runner.indexOf('node "$ARTIFACT_SANITIZER"');
  const join = runner.indexOf('R_CW_3_REVIEW_HELPER" "${R_CW_3_REVIEW_ARGS[@]}"');
  const runResult = runner.indexOf('--argjson reviewPendingReceipts "$REVIEW_PENDING_RECEIPTS"');
  assert.ok(reset > 0 && seed > reset, 'the manual receipt must be seeded after the generic pending list is reset');
  assert.ok(sanitizer > seed, 'the seed must precede public redaction');
  assert.ok(join > sanitizer, 'the review join must read the redacted public artifacts');
  assert.ok(runResult > join, 'run-result.json must be written after the join');
  assert.match(runner, /ROW_ID" == "R-CW-3"/);
  // The manual receipt may only ever be added to the pending list.
  assert.match(runner, /\$current \+ \["reason-telemetry-redaction-review"\] \| unique/);
  assert.doesNotMatch(runner, /- \["reason-telemetry-redaction-review"\]/);
  assert.doesNotMatch(runner, /map\(select\(\. != "reason-telemetry-redaction-review"\)\)/);
});

test('R-CW-3 keeps its manual review debt after a successful trace collection and join', async () => {
  const fixture = await runRowFixture({ rowId: 'R-CW-3', summaryFile: 'r-cw-3-reason-telemetry-summary.json' });
  try {
    const result = await readJson(path.join(fixture.runDir, 'run-result.json'));

    // The trace was collected: this is exactly the state that used to empty
    // the pending list and declare the row ready for human review.
    assert.equal(result.observability.traceStatus, 'present');
    assert.equal(result.observability.traceId, TRACE_ID);
    assert.equal(result.observability.correlationReceipt, 'continuation-trace-correlation.json');

    // The manual receipt survives collection and helper success.
    assert.equal(result.review.status, 'review-pending');
    assert.ok(result.review.pendingReceipts.includes(MANUAL_RECEIPT));
    assert.ok(!result.review.pendingReceipts.includes(JOIN_RECEIPT));

    // The joined receipt is recorded, digest-bound, and explicitly unaccepted.
    const review = result.review.rowReview;
    assert.equal(review.status, 'review-join-passed');
    assert.equal(review.receipt, 'r-cw-3-reason-telemetry-review.json');
    assert.equal(review.verdict, 'reason-telemetry-redaction-review-passed');
    assert.equal(review.source, 'r-cw-3-row-scoped-review-join');
    assert.equal(review.manualAcceptanceRequired, true);
    assert.equal(review.coordinatorAccepted, false);
    assert.match(review.sha256, /^[a-f0-9]{64}$/);
    assert.equal(review.sha256, sha256(await readFile(path.join(fixture.runDir, review.receipt))));

    // The receipt is joined to this candidate, matrix, run, trace and chain.
    const receipt = await readJson(path.join(fixture.runDir, review.receipt));
    const metadata = await readJson(path.join(fixture.runDir, 'runner-metadata.json'));
    assert.equal(receipt.binding.candidateSha, CANDIDATE_SHA);
    assert.equal(receipt.binding.runId, fixture.runId);
    assert.equal(receipt.binding.matrixId, metadata.matrixId);
    assert.equal(receipt.binding.traceId, TRACE_ID);
    assert.equal(receipt.binding.chainId, CHAIN_ID);
    assert.equal(receipt.binding.expectations.runId, fixture.runId);
    assert.equal(receipt.binding.sources['row-scenario.js'], metadata.scenarioSha256);
    assert.equal(receipt.binding.sources['row-manifest.json'], metadata.manifestSha256);
    assert.equal(receipt.checks.reasonTelemetryMatchesEvidence.ok, true);
    assert.equal(receipt.checks.traceTopologyBound.ok, true);
    assert.equal(receipt.checks.identityBound.ok, true);
    assert.equal(receipt.checks.sourceDigestsBound.ok, true);
    assert.equal(receipt.acceptance.coordinatorAccepted, false);
    assert.equal(receipt.acceptance.canonicalFoldForbidden, true);

    // No canonical lift: the VU verdict and the original summary are intact,
    // and the review-pending row is not given a routing envelope.
    assert.equal(result.verdict, 'PARTIAL-candidate');
    assert.equal(result.verdictSource, 'vu-log');
    assert.equal(result.candidateOnly, true);
    assert.equal(result.foldRequiresReview, true);
    const summary = await readJson(path.join(fixture.runDir, 'r-cw-3-reason-telemetry-summary.json'));
    assert.equal(summary.verdict, 'PARTIAL-candidate');
    assert.deepEqual(summary.review.pendingReceipts, [MANUAL_RECEIPT]);
    assert.equal(receipt.reconciliation.historicalVerdict, 'PARTIAL-candidate');
    assert.equal(receipt.reconciliation.overwritesOriginalEvidence, false);
    await missing(path.join(fixture.runDir, 'candidate-run-result.json'));
    assert.match(fixture.result.stderr, /Candidate routing envelope withheld/);

    // Review debt routing sees the manual receipt, not an empty list.
    const debt = JSON.parse((await run(
      process.execPath,
      [path.join(repoRoot, 'tools/k6-proofs/scripts/summarize-review-debt.mjs'), '--run-root', fixture.out, '--json'],
      { encoding: 'utf8' },
    )).stdout);
    const row = debt.pending.find((entry) => entry.rowId === 'R-CW-3');
    assert.ok(row, 'R-CW-3 must appear as review-pending');
    assert.ok(row.pendingReceipts.includes(MANUAL_RECEIPT));
    assert.ok(row.pending.some((item) => item.class === 'manual-review'));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('R-CW-3 keeps the review explicit when the trace cannot be collected', async () => {
  const fixture = await runRowFixture({
    rowId: 'R-CW-3',
    summaryFile: 'r-cw-3-reason-telemetry-summary.json',
    tempo: 'unavailable',
  });
  try {
    const result = await readJson(path.join(fixture.runDir, 'run-result.json'));
    assert.equal(result.observability.traceStatus, 'missing');
    assert.equal(result.review.status, 'review-pending');
    for (const receipt of ['tempo-trace-json', 'continuation-trace-correlation', MANUAL_RECEIPT, JOIN_RECEIPT]) {
      assert.ok(result.review.pendingReceipts.includes(receipt), `${receipt} must stay pending`);
    }
    assert.equal(result.review.rowReview.status, 'review-join-invalid');
    assert.equal(result.review.rowReview.verdict, 'review-pending');
    assert.equal(result.review.rowReview.coordinatorAccepted, false);

    // A failed join still leaves a named artifact rather than silence.
    const receipt = await readJson(path.join(fixture.runDir, 'r-cw-3-reason-telemetry-review.json'));
    assert.equal(receipt.verdict, 'review-pending');
    assert.ok(receipt.error, 'the unreviewable input must be named');
    assert.equal(receipt.acceptance.manualAcceptanceRequired, true);
    await missing(path.join(fixture.runDir, 'candidate-run-result.json'));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('the nearest sibling continue_work row keeps its trace-only debt behaviour', async () => {
  const manifest = await readJson(path.join(manifestsDir, 'r-cw-1.json'));
  assert.equal(manifest.invocation.tool, 'continue_work');
  assert.ok(!manifest.liveRunSafety.requiredReceipts.includes(MANUAL_RECEIPT));

  const fixture = await runRowFixture({ rowId: 'R-CW-1', summaryFile: 'r-cw-1-tool-schedule-wake-summary.json' });
  try {
    const result = await readJson(path.join(fixture.runDir, 'run-result.json'));
    assert.equal(result.observability.traceStatus, 'present');
    assert.equal(result.observability.traceId, TRACE_ID);
    assert.deepEqual(result.review.pendingReceipts, []);
    assert.equal(result.review.status, 'ready-for-human-review');
    // Asserted as "absent", not as a specific encoding, so this control holds
    // identically before and after the R-CW-3 correction.
    assert.equal(result.review.rowReview ?? null, null);
    await missing(path.join(fixture.runDir, 'r-cw-3-reason-telemetry-review.json'));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
