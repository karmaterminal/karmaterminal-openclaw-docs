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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const scenariosDir = path.join(repoRoot, 'tools/k6-proofs/scenarios');
const run = promisify(execFile);

const candidateSha = 'a'.repeat(40);
const traceId = '1'.repeat(32);
const dispatchSpanId = '2'.repeat(16);
const fireSpanId = '3'.repeat(16);
const toolSpanId = '4'.repeat(16);
const sharedParentSpanId = '5'.repeat(16);
const chainId = '12345678-1234-4123-8123-123456789abc';

function attr(key, value) {
  return { key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: String(value) } };
}

function rcd2Trace({ reasonHash, reasonLength }) {
  const toolOriginNs = 1785580554339000000n;
  const fireNs = toolOriginNs + 5000000000n;
  const continuationAttrs = [
    attr('reason.hash', reasonHash),
    attr('reason.length', reasonLength),
    attr('delegate.mode', 'silent-wake'),
    attr('chain.id', chainId),
  ];
  return {
    batches: [{ scopeSpans: [{ spans: [
      { name: 'continuation.delegate.dispatch', traceId, spanId: dispatchSpanId, parentSpanId: sharedParentSpanId, status: { code: 1 }, attributes: continuationAttrs, startTimeUnixNano: String(fireNs), endTimeUnixNano: String(fireNs + 1000000n) },
      { name: 'continuation.delegate.fire', traceId, spanId: fireSpanId, parentSpanId: sharedParentSpanId, status: { code: 1 }, attributes: [...continuationAttrs, attr('fire.deferred_ms', 5000)], startTimeUnixNano: String(fireNs), endTimeUnixNano: String(fireNs + 1000n) },
      { name: 'openclaw.tool.execution', traceId, spanId: toolSpanId, parentSpanId: sharedParentSpanId, status: { code: 1 }, attributes: [attr('gen_ai.tool.name', 'continue_delegate')], startTimeUnixNano: String(toolOriginNs), endTimeUnixNano: String(toolOriginNs + 1000000n) },
    ] }] }],
  };
}

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function writeExecutable(file, source) {
  await writeFile(file, source, { mode: 0o755 });
  await chmod(file, 0o755);
}

/**
 * Build a throwaway git checkout that contains exactly the harness bytes under
 * test, commit them, and return the immutable ref the runner must be bound to.
 */
async function runRcd2RunnerFixture({ tamper = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-2-runner-contract-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  await Promise.all([mkdir(bin, { recursive: true }), mkdir(out, { recursive: true })]);
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));

  const manifest = JSON.parse(await readFile(path.join(manifestsDir, 'r-cd-2.json'), 'utf8'));
  const nonce = 'RCD2-RUNNER-CONTRACT-NONCE';
  const reason = manifest.invocation.promptTemplate.replaceAll('{{nonce}}', nonce);
  const reasonHash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
  const now = new Date().toISOString();
  const dispatchAt = Date.now();
  const evidence = {
    row: 'R-CD-2', nonce, started: now, ended: now, dispatch_accepted_at_ms: dispatchAt,
    dispatch_terminal_sentinel_at_ms: dispatchAt + 1,
    dispatch_lifecycle_end_at_ms: dispatchAt + 2,
    wake_lifecycle_at_ms: dispatchAt + 3,
    post_wake_quiet_at_ms: dispatchAt + 4,
    delegate_mode: 'silent-wake', reason_hash: reasonHash, reason_length: reason.length,
    session_created: true, session_unbound_confirmed: true, send_accepted: true,
    send_run_captured: true, terminal_success_same_run: true, typed_delegate_success_same_run: true,
    dispatch_terminal_sentinel_observed: true,
    dispatch_terminal_sentinel_same_run_window: true,
    wake_lifecycle_observed: true, post_wake_quiet: true, channel_message_observed: false,
    dispatch_failure_observed: false, send_run_fingerprint: 'a'.repeat(16),
    terminal_run_fingerprint: 'a'.repeat(16), wake_run_fingerprint: 'a'.repeat(16),
    row_nonce_fingerprint: 'b'.repeat(16), accepted_send_trace_id: traceId,
  };
  const trace = rcd2Trace({ reasonHash, reasonLength: reason.length });
  const tempo = await listen((req, res) => {
    if (req.url.startsWith('/health') || req.url.startsWith('/status')) {
      res.writeHead(200).end('{}');
    } else if (req.url.startsWith('/api/search')) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ traces: [{ traceID: traceId }] }));
    } else if (req.url.startsWith(`/api/traces/${traceId}`)) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(trace));
    } else {
      res.writeHead(404).end();
    }
  });

  try {
    await writeExecutable(path.join(bin, 'openclaw'), '#!/bin/sh\nprintf \'%s\\n\' \'{"enabled":true,"maxChainLength":3,"maxDelegatesPerTurn":3,"costCapTokens":3}\'\n');
    await writeExecutable(path.join(bin, 'hostname'), '#!/bin/sh\nprintf \'%s\\n\' cael-dgx\n');
    await writeExecutable(path.join(bin, 'journalctl'), '#!/bin/sh\ncase " $* " in *" --show-cursor "*) printf \'%s\\n\' \'-- cursor: runner-contract\' ;; esac\n');
    await writeExecutable(path.join(bin, 'k6'), `#!/bin/sh\nif [ "${'${1:-}'}" = version ]; then printf '%s\\n' 'k6 v2.0.0'; exit 0; fi\nprintf '%s %s\\n' '=== K6-PROOF-EVIDENCE ===' '${JSON.stringify(evidence)}'\n`);
    if (tamper) {
      await writeExecutable(path.join(bin, 'node'), `#!/bin/sh\ncase "$*" in *validate-candidate-run-result.mjs*) receipt=$(find "${out}" -name r-cd-2-authoritative-receipt.json -print -quit); [ -n "$receipt" ] && printf ' ' >> "$receipt" ;; esac\nexec "${process.execPath}" "$@"\n`);
    }
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ...(tamper ? { REAL_NODE: process.execPath } : {}),
      K6_BIN: path.join(bin, 'k6'),
      OPENCLAW_GATEWAY_TOKEN: 'runner-contract-token',
      OPENCLAW_GATEWAY_WS: tempo.baseUrl.replace(/^http/, 'ws'),
      OPENCLAW_PROOFS_TEMPO_BASE_URL: tempo.baseUrl,
      OPENCLAW_CANDIDATE_SHA: candidateSha,
      OPENCLAW_RUNTIME_BUILD_SHA: candidateSha,
      OPENCLAW_SESSION_KEY: 'main',
      OPENCLAW_SEAT_NAME: 'cael-dgx',
    };
    const result = await run('bash', ['scripts/run-proofs.sh', '--live', '--docs-ref', harness.docsRef, '--out-dir', out, 'R-CD-2', candidateSha], {
      cwd: path.join(harness.checkout, 'tools/k6-proofs'), env, timeout: 60_000,
    });
    const runBase = path.join(out, candidateSha, 'R-CD-2', 'cael-dgx');
    const [runId] = await readdir(runBase);
    const runDir = path.join(runBase, runId);
    return { root, out, runDir, result, docsRef: harness.docsRef, checkout: harness.checkout };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  } finally {
    await new Promise((resolve) => tempo.server.close(resolve));
  }
}

test('every trace-required continue_delegate row persists the safe fingerprint contract', async () => {
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json'));
  const rows = [];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
    const required = (manifest.liveRunSafety?.requiredReceipts || []).map((value) => String(value).toLowerCase());
    if (manifest.invocation?.tool !== 'continue_delegate' ||
        !required.some((value) => value === 'trace-id' || value === 'tempo-trace-json')) {
      continue;
    }
    rows.push(manifest.rowId);
    const scenario = await readFile(path.join(scenariosDir, manifest.scenario.file), 'utf8');
    assert.match(scenario, /crypto\.sha256\([^,]+,\s*'hex'\)\.slice\(0,\s*16\)/);
    if (manifest.rowId === 'R-CD-TOKEN') {
      assert.match(scenario, /reason_hash:\s*hash\(delegateTask\)/);
      assert.match(scenario, /reason_length:\s*delegateTask\.length/);
      assert.match(scenario, /delegate_mode:\s*'normal'/);
      assert.match(scenario, /replace\(\/\\\{\\\{marker\\\}\\\}\/g,/);
      assert.match(scenario, /replace\(\/\\\{\\\{tag\\\}\\\}\/g,/);
    } else {
      assert.match(scenario, /reason_hash:\s*null/);
      assert.match(scenario, /reason_length:\s*null/);
      assert.match(scenario, /delegate_mode:\s*null/);
      if (manifest.rowId === 'R-CD-4') {
        assert.match(manifest.invocation.promptTemplate, /^RCD4:\{\{nonceSuffix16\}\}/);
        assert.match(scenario, /rCd4TaskPrompt\(inv\.promptTemplate,\s*rowNonce\)/);
      } else if (manifest.rowId === 'R-RC-2') {
        assert.match(manifest.invocation.promptTemplate, /^RRC2:\{\{nonceSuffix16\}\}/);
        assert.match(scenario, /renderRowTaskTemplate\(inv\.promptTemplate,\s*rowNonce\)/);
      } else {
        assert.match(scenario, /promptTemplate\.replace\(\/\\\{\\\{nonce\\\}\\\}\/g,/);
      }
    }
  }

  assert.deepEqual(rows.sort(), [
    'R-CD-1',
    'R-CD-2',
    'R-CD-4',
    'R-CD-CHAINED-DEPTH-2',
    'R-CD-TOKEN',
    'R-RC-2',
  ]);
});

test('R-CD-2 scenario and resolver use the same no-channel-delivery evidence field', async () => {
  const scenario = await readFile(path.join(scenariosDir, 'r-cd-2-silent-wake.js'), 'utf8');
  const resolver = await readFile(
    path.join(repoRoot, 'tools/k6-proofs/lib/r-cd-2-authoritative-receipt.mjs'),
    'utf8',
  );
  assert.match(scenario, /channel_message_observed:\s*false/);
  assert.match(resolver, /evidence\?\.channel_message_observed === false/);
  assert.match(resolver, /evidence\?\.dispatch_terminal_sentinel_observed === true/);
  assert.match(resolver, /evidence\?\.dispatch_terminal_sentinel_same_run_window === true/);
  assert.doesNotMatch(resolver, /channel_delivery_observed/);
});

test('R-CD-2 dispatch turn requires an exact post-tool terminal sentinel', async () => {
  const scenario = await readFile(path.join(scenariosDir, 'r-cd-2-silent-wake.js'), 'utf8');
  assert.match(
    scenario,
    /After the continue_delegate tool result reports scheduled, reply exactly RCD2-DELEGATE-SCHEDULED \$\{rowNonce\}/,
  );
  assert.match(scenario, /observesRcd2DispatchTerminalSentinel\(/);
  assert.match(scenario, /dispatchLifecycleActive/);
  assert.match(scenario, /wakeLifecycleObserved:\s*evidence\.wake_lifecycle_observed/);
  assert.doesNotMatch(scenario, /execute the tool call immediately, no other action needed/);
});

test('every trace-required continue_work row persists the safe fingerprint contract', async () => {
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json'));
  const rows = [];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
    const required = (manifest.liveRunSafety?.requiredReceipts || [])
      .map((value) => String(value).toLowerCase());
    if (manifest.invocation?.tool !== 'continue_work' ||
        !required.some((value) => value === 'trace-id' || value === 'tempo-trace-json')) {
      continue;
    }
    rows.push(manifest.rowId);
    const scenario = await readFile(path.join(scenariosDir, manifest.scenario.file), 'utf8');
    assert.match(scenario, /reason_hash:\s*crypto\.sha256\([^,]+,\s*'hex'\)\.slice\(0,\s*16\)/);
    assert.match(scenario, /reason_length:\s*(?:wakeReason|rawReason)\.length/);
    assert.match(scenario, /inv\.reason\.replace\(\/\\\{\\\{nonce\\\}\\\}\/g,/);
    assert.match(manifest.invocation.reason, /\{\{nonce\}\}/);
    if (manifest.rowId === 'R-CW-3') {
      assert.match(scenario, /rawReasonSentinel = `RAW-RCW3-\$\{rowNonce\}`/);
      assert.doesNotMatch(scenario, /rawReasonSentinel.*Math\.random/);
    }
  }

  assert.deepEqual(rows.sort(), ['R-CW-1', 'R-CW-3']);
});

test('depth-2 chain dispatch uses the exact committed manifest task', async () => {
  const source = await readFile(path.join(scenariosDir, 'r-cd-chained-depth-2.js'), 'utf8');
  assert.match(source, /const task = inv\.promptTemplate\.replace\(\/\\\{\\\{nonce\\\}\\\}\/g, chainNonce\)/);
  assert.match(source, /task=\$\{JSON\.stringify\(task\)\}/);
});

test('row runner keeps private acquisition transient and publishes sanitized evidence', async () => {
  const runner = await readFile(path.join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');
  assert.match(runner, /PRIVATE_K6_LOG="\$\(mktemp/);
  assert.match(runner, /PRIVATE_EVIDENCE_FILE="\$\(mktemp/);
  assert.match(runner, /PRIVATE_GATEWAY_LOG="\$\(mktemp/);
  assert.match(runner, /journalctl[\s\S]+--after-cursor/);
  assert.match(runner, /ARTIFACT_SANITIZER/);
  assert.match(runner, /--log-out "\$RUN_DIR\/k6\.log"/);
  assert.match(runner, /--service-log-out "\$RUN_DIR\/gateway-journal\.log"/);
  assert.match(runner, /gateway-journal-capture\.json/);
  assert.match(runner, /gateway-journal-redaction\.json/);
  assert.match(runner, /VU_LOG_VERDICT/);
  assert.match(runner, /verdict-reconciliation\.json/);
  assert.match(runner, /selectedSource: \$selectedSource/);
  assert.doesNotMatch(runner, /tee "\$RUN_DIR\/k6\.log"/);
  assert.doesNotMatch(runner, /gateway-journal\.private/);
  assert.doesNotMatch(runner, /sessionKey:\$session/);
});

test('R-CD-2 row-list runner declares the signed receipt that candidate routing validates', async () => {
  const runner = await readFile(path.join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');
  assert.match(runner, /R_CD_2_RECEIPT_SHA256/);
  assert.match(runner, /createHash\("sha256"\)/);
  assert.match(runner, /AUTHORITATIVE_RECEIPT="\$R_CD_2_RECEIPT"/);
  assert.match(runner, /AUTHORITATIVE_RECEIPT_SOURCE="r-cd-2-row-scoped-resolver"/);
  assert.match(runner, /authoritativeReceipt:\(if \$authoritativeReceiptSha256 == "" then null else \{file:\$authoritativeReceipt, sha256:\$authoritativeReceiptSha256, validated:true, source:\$authoritativeReceiptSource\}/);
});

test('R-CD-2 live runner emits an envelope only for an untampered authoritative receipt', async (t) => {
  await t.test('valid signed receipt produces a candidate envelope through run-proofs.sh', async () => {
    const fixture = await runRcd2RunnerFixture();
    try {
      const envelope = JSON.parse(await readFile(path.join(fixture.runDir, 'candidate-run-result.json'), 'utf8'));
      const result = JSON.parse(await readFile(path.join(fixture.runDir, 'run-result.json'), 'utf8'));
      assert.equal(result.authoritativeReceipt.file, 'r-cd-2-authoritative-receipt.json');
      assert.match(result.authoritativeReceipt.sha256, /^[a-f0-9]{64}$/);
      assert.equal(envelope.result.outcome, 'PASS-candidate');
      assert.equal(envelope.authoritativeReceipt.sha256, result.authoritativeReceipt.sha256);
      assert.match(fixture.result.stdout, /CANDIDATE REVIEW ENVELOPE/);

      // The live receipt carries the immutable harness identity it was fired
      // from, recomputable from the copied source bytes (#496).
      const metadata = JSON.parse(await readFile(path.join(fixture.runDir, 'runner-metadata.json'), 'utf8'));
      const sha256 = async (file) => createHash('sha256').update(await readFile(path.join(fixture.runDir, file))).digest('hex');
      assert.equal(metadata.docsRef, fixture.docsRef);
      assert.equal(metadata.repository, 'karmaterminal/karmaterminal-openclaw-docs');
      assert.equal(metadata.manifestPath, 'tools/k6-proofs/manifests/r-cd-2.json');
      assert.equal(metadata.scenarioPath, 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js');
      assert.equal(metadata.manifestSha256, await sha256('row-manifest.json'));
      assert.equal(metadata.scenarioSha256, await sha256('row-scenario.js'));
      assert.equal(envelope.candidate.docsRef, fixture.docsRef);
      assert.equal(envelope.harness.docsRef, fixture.docsRef);
      assert.equal(envelope.harness.manifestSha256, metadata.manifestSha256);
      assert.equal(envelope.harness.scenarioSha256, metadata.scenarioSha256);

      const provenance = JSON.parse(await readFile(path.join(fixture.out, 'harness-provenance.json'), 'utf8'));
      assert.equal(provenance.schema, 'openclaw.k6.harness-provenance.v1');
      assert.equal(provenance.docsRef, fixture.docsRef);
      assert.equal(provenance.harnessIdentityVerified, true);
      assert.equal(provenance.candidateSha, candidateSha);
      assert.match(provenance.runnerScriptSha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(provenance.rowSelection, ['R-CD-2']);
      assert.deepEqual(provenance.rows, [{
        rowId: 'R-CD-2',
        manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
        manifestSha256: metadata.manifestSha256,
        scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
        scenarioSha256: metadata.scenarioSha256,
      }]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  await t.test('tampered receipt is withheld by the live runner before it can emit an envelope', async () => {
    const fixture = await runRcd2RunnerFixture({ tamper: true });
    try {
      await assert.rejects(readFile(path.join(fixture.runDir, 'candidate-run-result.json'), 'utf8'), /ENOENT/);
      const validationError = await readFile(path.join(fixture.runDir, 'candidate-run-result-validation.error.log'), 'utf8');
      assert.match(validationError, /authoritative receipt digest mismatch/);
      assert.match(fixture.result.stderr, /Candidate routing envelope withheld/);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
