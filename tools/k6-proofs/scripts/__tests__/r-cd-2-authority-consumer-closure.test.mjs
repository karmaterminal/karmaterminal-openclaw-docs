import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import {
  rCd2AuthorityIdentity,
  validateRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';
import {
  R_CD_2_SELECTION_RECEIPT_FILE,
  consumeRcd2Authority,
  validateRcd2SelectedContextReceipt,
} from '../../lib/r-cd-2-authority-context.mjs';
import { candidateEnvelopeMatchesSiblings } from '../candidate-run-result-contract.mjs';
import {
  BASE,
  FOREIGN,
  SIGNING_KEY,
  testWorkspace,
  writeRcd2Bundle,
} from './helpers/r-cd-2-authority-fixture.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const scripts = path.join(repoRoot, 'tools/k6-proofs/scripts');
const exporter = path.join(scripts, 'export-row-metrics.mjs');
const bulkExporter = path.join(scripts, 'export-prometheus-metrics.mjs');
const reportRenderer = path.join(scripts, 'render-run-report.mjs');
const candidateEmitter = path.join(scripts, 'validate-candidate-run-result.mjs');
const debtSummarizer = path.join(scripts, 'summarize-review-debt.mjs');
const traceCollector = path.join(scripts, 'collect-continuation-trace.mjs');
const resolver = path.join(scripts, 'resolve-r-cd-2-authoritative-receipt.mjs');
const writer = path.join(scripts, 'evidence-writer.mjs');
const postprocessor = path.join(scripts, 'postprocess-k6-summary.mjs');

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: SIGNING_KEY, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function siblingMatch(fixture) {
  return candidateEnvelopeMatchesSiblings({
    envelope: fixture.envelope,
    manifest: fixture.manifest,
    metadata: fixture.metadata,
    runResult: fixture.runResult,
    runDir: fixture.runDir,
    signingKey: SIGNING_KEY,
  });
}

async function render(fixture) {
  const out = path.join(fixture.root, 'report.html');
  const result = await run(process.execPath, [reportRenderer, '--root', fixture.root, '--out', out]);
  return {
    ...result,
    html: await readFile(out, 'utf8').catch(() => ''),
  };
}

async function exportRun(fixture, extra = []) {
  const prom = path.join(fixture.root, 'metrics.prom');
  const otlp = path.join(fixture.root, 'metrics.otlp.json');
  const result = await run(process.execPath, [
    exporter,
    '--run-dir', fixture.runDir,
    '--prometheus-out', prom,
    '--otlp-out', otlp,
    ...extra,
  ]);
  return { ...result, prom, otlp };
}

async function installCanonicalPassClaim(fixture) {
  const canonicalRow = path.join(
    fixture.root,
    'PROOFS',
    BASE.candidateSha,
    'R-CD-2',
  );
  const reviewedRun = path.join(
    canonicalRow,
    BASE.seat,
    BASE.runId,
  );
  await mkdir(canonicalRow, { recursive: true });
  await cp(fixture.runDir, reviewedRun, { recursive: true });
  await writeFile(path.join(canonicalRow, 'EVIDENCE.md'), '# Selected candidate\n');
  const rollup = {
    total_rows: 1,
    pass: 1,
    partial: 0,
    thin: 0,
    fail: 0,
    honest_limit: 0,
    missing: 0,
  };
  await writeFile(
    path.join(fixture.root, 'PROOFS', BASE.candidateSha, 'proofs-manifest.json'),
    `${JSON.stringify({
      schema: 'openclaw.proofs.manifest.v1',
      capture_sha: BASE.candidateSha,
      rows: [{
        row: 'R-CD-2',
        state: 'pass',
        dir: `PROOFS/${BASE.candidateSha}/R-CD-2`,
        evidence_doc: `PROOFS/${BASE.candidateSha}/R-CD-2/EVIDENCE.md`,
        reviewed_run: path.relative(fixture.root, reviewedRun).replaceAll(path.sep, '/'),
      }],
      rollup,
    }, null, 2)}\n`,
  );
  await writeFile(
    path.join(fixture.root, 'PROOFS', 'INDEX.json'),
    `${JSON.stringify({
      schema: 'openclaw.proofs.index.v1',
      current_sha: BASE.candidateSha,
      corpus_path: `PROOFS/${BASE.candidateSha}`,
      manifest_path: `PROOFS/${BASE.candidateSha}/proofs-manifest.json`,
      rollup,
    }, null, 2)}\n`,
  );
  return reviewedRun;
}

async function rejectedAuthorityConsumers(fixture) {
  const failures = [];
  try {
    consumeRcd2Authority({
      root: fixture.root,
      runDir: fixture.runDir,
      manifest: fixture.manifest,
      metadata: fixture.metadata,
      runResult: fixture.runResult,
      summary: fixture.summary,
      envelope: fixture.envelope,
      signingKey: SIGNING_KEY,
    });
    failures.push('shared consumer');
  } catch {
    // Expected.
  }

  const emitted = await run(process.execPath, [
    candidateEmitter,
    '--manifest', fixture.manifestPath,
    '--candidate-dir', fixture.runDir,
    '--docs-ref', BASE.docsRef,
  ]);
  if (emitted.status === 0) failures.push('candidate sidecar');
  if (siblingMatch(fixture)) failures.push('candidate sibling contract');

  const single = await exportRun(fixture);
  if (single.status === 0 || await exists(single.prom) || await exists(single.otlp)) {
    failures.push('single-row metrics');
  }

  const bulkOut = path.join(fixture.root, 'bulk.prom');
  const bulk = await run(process.execPath, [
    bulkExporter,
    '--root', fixture.root,
    '--out', bulkOut,
  ]);
  if (
    bulk.status === 0 ||
    await exists(bulkOut) ||
    /openclaw_proofs_k6_run_total/u.test(bulk.stdout)
  ) {
    failures.push('bulk metrics');
  }

  const report = await render(fixture);
  if (report.status === 0 || report.html !== '') {
    failures.push('report');
  }

  const debt = await run(process.execPath, [
    debtSummarizer,
    '--run-root', fixture.root,
    '--json',
  ]);
  if (debt.status === 0 || debt.stdout !== '') {
    failures.push('review debt');
  }

  await installCanonicalPassClaim(fixture);
  const corpus = await run(process.execPath, [
    path.join(scripts, 'validate-corpus.mjs'),
    '--root', fixture.root,
    '--index',
    '--json',
  ]);
  if (corpus.status === 0) failures.push('corpus');

  return failures;
}

test('disk-loaded correlation requires the selected complete authority identity everywhere', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    const hostileCorrelation = structuredClone(fixture.correlation);
    hostileCorrelation.authorityIdentity = rCd2AuthorityIdentity({
      ...fixture.metadata,
      candidateSha: FOREIGN.candidateSha,
      runtimeBuildSha: FOREIGN.candidateSha,
      docsRef: FOREIGN.docsRef,
      repository: FOREIGN.repository,
      seat: FOREIGN.seat,
      matrixId: FOREIGN.matrixId,
      runId: FOREIGN.runId,
      manifestPath: FOREIGN.manifestPath,
      manifestSha256: '6'.repeat(64),
      scenarioPath: FOREIGN.scenarioPath,
      scenarioSha256: '7'.repeat(64),
    }, FOREIGN.runId);
    await writeFile(
      path.join(fixture.runDir, 'continuation-trace-correlation.json'),
      `${JSON.stringify(hostileCorrelation, null, 2)}\n`,
    );

    assert.deepEqual(
      await rejectedAuthorityConsumers(fixture),
      [],
      'a foreign disk-loaded correlation identity reached an authority consumer',
    );
  } finally {
    await fixture.cleanup();
  }
});

test('explicit selected summary never hides contradictory on-disk summary claims', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    await writeFile(
      path.join(fixture.runDir, 'z-summary.json'),
      `${JSON.stringify({
        ...fixture.summary,
        row: 'R-CW-1',
        scenario: 'r-cw-1.js',
      }, null, 2)}\n`,
    );
    await rm(path.join(fixture.runDir, 'candidate-run-result.json'));

    assert.deepEqual(
      await rejectedAuthorityConsumers(fixture),
      [],
      'a contradictory on-disk summary reached an authority consumer',
    );
  } finally {
    await fixture.cleanup();
  }
});

test('signed R-CD-2 PASS, PARTIAL, and FAIL remain valid positive authorities', async (t) => {
  for (const verdict of ['PASS-candidate', 'PARTIAL-candidate', 'FAIL-candidate']) {
    await t.test(verdict, async () => {
      const fixture = await writeRcd2Bundle(repoRoot, { verdict });
      try {
        const expected = rCd2AuthorityIdentity(fixture.metadata, BASE.runId);
        assert.deepEqual(
          validateRcd2AuthoritativeReceipt(fixture.receipt, SIGNING_KEY, expected),
          { valid: true, verdict },
        );
        assert.equal(fixture.summary.verdict, 'PARTIAL-candidate');
        if (verdict === 'PASS-candidate') {
          assert.equal(fixture.receipt.diagnostics.lifecycle.dispatchTerminalSentinel, true);
          assert.equal(fixture.receipt.diagnostics.lifecycle.dispatchTerminalSentinelSameRun, true);
          assert.equal(fixture.receipt.diagnostics.lifecycle.lifecycleEndBeforeWake, true);
          assert.equal(fixture.receipt.diagnostics.lifecycle.wakeBeforeQuietWindow, true);
          assert.equal(fixture.receipt.diagnostics.joins.acceptedTrace, true);
          assert.equal(fixture.receipt.lifecycle.acceptedSendTraceSource, 'unique-reason-bound-trace');
        }
      } finally {
        await fixture.cleanup();
      }
    });

  }
});

test('selected disk evidence and topology must reproduce the signed authority receipt', async (t) => {
  for (const [name, file, mutate] of [
    ['private evidence', 'private-evidence.json', (value) => {
      value.post_wake_quiet = false;
    }],
    ['correlation topology', 'continuation-trace-correlation.json', (value) => {
      value.chainId = 'different-selected-chain';
    }],
  ]) {
    await t.test(name, async () => {
      const fixture = await writeRcd2Bundle(repoRoot);
      try {
        const target = path.join(fixture.runDir, file);
        const value = JSON.parse(await readFile(target, 'utf8'));
        mutate(value);
        await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
        assert.throws(
          () => consumeRcd2Authority({
            runDir: fixture.runDir,
            signingKey: SIGNING_KEY,
          }),
          /does not match selected disk evidence|immutable acquisition receipt invalid/,
        );
      } finally {
        await fixture.cleanup();
      }
    });
  }
});

test('signed PARTIAL authority preserves explicit pending review receipts', async () => {
  const fixture = await writeRcd2Bundle(repoRoot, { verdict: 'PARTIAL-candidate' });
  try {
    fixture.runResult.review = {
      status: 'review-pending',
      pendingReceipts: ['tempo-trace-json'],
    };
    await writeFile(
      path.join(fixture.runDir, 'run-result.json'),
      `${JSON.stringify(fixture.runResult, null, 2)}\n`,
    );
    const authority = consumeRcd2Authority({
      runDir: fixture.runDir,
      signingKey: SIGNING_KEY,
    });
    assert.equal(authority.outcome, 'PARTIAL-candidate');
    assert.equal(authority.review.status, 'review-pending');
    assert.deepEqual(authority.review.pendingReceipts, ['tempo-trace-json']);
    assert.equal(authority.review.complete, false);
  } finally {
    await fixture.cleanup();
  }
});

test('selected-context receipt rejects unknown keys, wrong types, and tampering', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    assert.equal(
      validateRcd2SelectedContextReceipt(
        fixture.selectionReceipt,
        SIGNING_KEY,
        rCd2AuthorityIdentity(fixture.metadata, BASE.runId),
      ).valid,
      true,
    );
    for (const mutation of [
      (receipt) => { receipt.unexpected = true; },
      (receipt) => { receipt.candidateOnly = 'true'; },
      (receipt) => { receipt.identity.harness.manifestSha256 = 1; },
      (receipt) => { receipt.identity.seat = FOREIGN.seat; },
      (receipt) => { receipt.integrity.signature = false; },
    ]) {
      const receipt = structuredClone(fixture.selectionReceipt);
      mutation(receipt);
      assert.equal(
        validateRcd2SelectedContextReceipt(receipt, SIGNING_KEY).valid,
        false,
      );
    }

    const tampered = structuredClone(fixture.selectionReceipt);
    tampered.identity.seat = FOREIGN.seat;
    await writeFile(
      path.join(fixture.runDir, R_CD_2_SELECTION_RECEIPT_FILE),
      `${JSON.stringify(tampered, null, 2)}\n`,
    );
    const metrics = await exportRun(fixture);
    assert.notEqual(metrics.status, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('resolver rejects every required acquisition omission before receipt issuance', async (t) => {
  const requiredPaths = [
    ['collector'],
    ['authorityIdentity'],
    ['nonce'],
    ['reason'],
    ['continuation'],
    ['delegate'],
    ['query'],
    ['querySha256'],
    ['searchWindow'],
    ['stabilization'],
    ['finality'],
    ['tempoSnapshot'],
    ['uniqueness'],
    ['traceId'],
    ['chainId'],
    ['dispatchSpanId'],
    ['fireSpanId'],
    ['toolSpanIds'],
    ['sameTrace'],
    ['distinctSpans'],
    ['rowBinding'],
    ['integrity'],
  ];
  for (const [field] of requiredPaths) {
    await t.test(field, async () => {
      const fixture = await writeRcd2Bundle(repoRoot);
      try {
        const hostile = structuredClone(fixture.correlation);
        delete hostile[field];
        await writeFile(
          path.join(fixture.runDir, 'continuation-trace-correlation.json'),
          `${JSON.stringify(hostile, null, 2)}\n`,
        );
        await rm(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'));
        const result = await run(process.execPath, [
          resolver,
          '--run-dir', fixture.runDir,
          '--evidence', path.join(fixture.runDir, 'private-evidence.json'),
          '--correlation', path.join(fixture.runDir, 'continuation-trace-correlation.json'),
        ]);
        assert.notEqual(result.status, 0, `${field} omission must reject`);
        assert.equal(
          await exists(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json')),
          false,
          `${field} omission must not issue a resolver receipt`,
        );
      } finally {
        await fixture.cleanup();
      }
    });
  }
});

test('copied acquisition cannot be rebound by rewriting execution context', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    const hostile = structuredClone(fixture.correlation);
    hostile.authorityIdentity = {
      ...hostile.authorityIdentity,
      runId: FOREIGN.runId,
      matrixId: FOREIGN.matrixId,
    };
    await writeFile(
      path.join(fixture.runDir, 'continuation-trace-correlation.json'),
      `${JSON.stringify(hostile, null, 2)}\n`,
    );
    await rm(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'));
    const result = await run(process.execPath, [
      resolver,
      '--run-dir', fixture.runDir,
      '--evidence', path.join(fixture.runDir, 'private-evidence.json'),
      '--correlation', path.join(fixture.runDir, 'continuation-trace-correlation.json'),
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(
      await exists(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json')),
      false,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('report and review debt reject invalid R-CD-2 authority without output artifacts', async (t) => {
  const mutations = [
    ['signature', async (fixture) => {
      const receipt = structuredClone(fixture.receipt);
      receipt.integrity.signature = '0'.repeat(64);
      await writeFile(
        path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'),
        `${JSON.stringify(receipt, null, 2)}\n`,
      );
    }],
    ['selected context', async (fixture) => {
      const receipt = structuredClone(fixture.selectionReceipt);
      receipt.integrity.signature = '0'.repeat(64);
      await writeFile(
        path.join(fixture.runDir, R_CD_2_SELECTION_RECEIPT_FILE),
        `${JSON.stringify(receipt, null, 2)}\n`,
      );
    }],
    ['receipt digest', async (fixture) => {
      fixture.runResult.authoritativeReceipt.sha256 = '0'.repeat(64);
      await writeFile(
        path.join(fixture.runDir, 'run-result.json'),
        `${JSON.stringify(fixture.runResult, null, 2)}\n`,
      );
    }],
    ['receipt shape', async (fixture) => {
      await writeFile(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'), '{}\n');
    }],
    ['correlation', async (fixture) => {
      const correlation = structuredClone(fixture.correlation);
      correlation.integrity.signature = '0'.repeat(64);
      await writeFile(
        path.join(fixture.runDir, 'continuation-trace-correlation.json'),
        `${JSON.stringify(correlation, null, 2)}\n`,
      );
    }],
    ['identity', async (fixture) => {
      const summary = { ...fixture.summary, identity: { seat: FOREIGN.seat } };
      await writeFile(
        path.join(fixture.runDir, 'r-cd-2-summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`,
      );
    }],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, async () => {
      const fixture = await writeRcd2Bundle(repoRoot);
      const reportPath = path.join(fixture.root, 'rejected-report.html');
      try {
        await mutate(fixture);
        const report = await run(process.execPath, [
          reportRenderer, '--root', fixture.root, '--out', reportPath,
        ]);
        assert.notEqual(report.status, 0);
        assert.equal(await exists(reportPath), false);
        assert.doesNotMatch(report.stdout, /UNVERIFIED-infrastructure/u);

        const debt = await run(process.execPath, [
          debtSummarizer, '--run-root', fixture.root, '--json',
        ]);
        assert.notEqual(debt.status, 0);
        assert.equal(debt.stdout, '');
        assert.doesNotMatch(debt.stdout, /review-pending/u);
      } finally {
        await fixture.cleanup();
      }
    });
  }
});

test('complete selected R-CD-2 context remains usable at every downstream boundary', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    const emitted = await run(process.execPath, [
      candidateEmitter,
      '--manifest', fixture.manifestPath,
      '--candidate-dir', fixture.runDir,
      '--docs-ref', BASE.docsRef,
      '--out', path.join(fixture.runDir, 'candidate-run-result.json'),
    ]);
    assert.equal(emitted.status, 0, emitted.stderr);
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: JSON.parse(emitted.stdout),
      manifest: fixture.manifest,
      metadata: fixture.metadata,
      runResult: fixture.runResult,
      runDir: fixture.runDir,
      signingKey: SIGNING_KEY,
    }), true);

    const metrics = await exportRun(fixture);
    assert.equal(metrics.status, 0, metrics.stderr);
    assert.equal(JSON.parse(metrics.stdout).outcome, 'PASS-candidate');

    const report = await render(fixture);
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.html, /<td>PASS-candidate<\/td>/);

    const debt = await run(process.execPath, [
      debtSummarizer, '--run-root', fixture.root, '--json',
    ]);
    assert.equal(debt.status, 0, debt.stderr);
    assert.equal(JSON.parse(debt.stdout).pendingRows, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('immutable redacted R-CD-2 snapshot remains usable through signed authority', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    await rm(path.join(fixture.runDir, 'private-evidence.json'));
    await rm(path.join(fixture.runDir, 'continuation-trace-correlation.json'));
    await writeFile(
      path.join(fixture.runDir, 'evidence.jsonl'),
      `${JSON.stringify({
        row: 'R-CD-2',
        verdict: 'PASS-candidate',
        authoritativeReceipt: 'r-cd-2-authoritative-receipt.json',
      })}\n`,
    );

    const metrics = await exportRun(fixture);
    assert.equal(metrics.status, 0, metrics.stderr);
    assert.equal(JSON.parse(metrics.stdout).outcome, 'PASS-candidate');

    const report = await render(fixture);
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.html, /<td>PASS-candidate<\/td>/);
  } finally {
    await fixture.cleanup();
  }
});

test('historical R-CD-2 authority uses its digest-bound run-local readiness receipt', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    await writeFile(path.join(fixture.root, 'seat-readiness.json'), `${JSON.stringify({
      schema: 'openclaw.k6.seat-readiness.v2',
      outcome: 'FAIL-candidate',
      candidate: { sha: 'f'.repeat(40), valid40Hex: true },
      seat: { name: FOREIGN.seat, class: 'message-body' },
    }, null, 2)}\n`);

    const metrics = await exportRun(fixture);
    assert.equal(metrics.status, 0, metrics.stderr);
    assert.equal(JSON.parse(metrics.stdout).outcome, 'PASS-candidate');

    const debt = await run(process.execPath, [
      debtSummarizer, '--run-root', fixture.root, '--json',
    ]);
    assert.equal(debt.status, 0, debt.stderr);
    assert.equal(JSON.parse(debt.stdout).pendingRows, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('broad and nested scan roots still detect the canonical R-CD-2 run path', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  const outer = await testWorkspace(repoRoot, 'rcd2-nested-scan');
  try {
    const authorityRoot = path.join(outer.root, 'nested', 'authority-root');
    await cp(fixture.root, authorityRoot, { recursive: true });
    const copiedRunDir = path.join(
      authorityRoot,
      path.relative(fixture.root, fixture.runDir),
    );
    const broadRoot = outer.root;
    const reportPath = path.join(outer.root, 'nested-report.html');
    const report = await run(process.execPath, [
      reportRenderer,
      '--root', broadRoot,
      '--out', reportPath,
    ]);
    assert.equal(report.status, 0, report.stderr);
    assert.match(await readFile(reportPath, 'utf8'), /<td>PASS-candidate<\/td>/);

    assert.equal(await exists(path.join(copiedRunDir, 'run-result.json')), true);
    const prom = path.join(outer.root, 'nested.prom');
    const metrics = await run(process.execPath, [
      bulkExporter,
      '--root', broadRoot,
      '--out', prom,
    ]);
    assert.equal(metrics.status, 0, metrics.stderr);
    assert.match(await readFile(prom, 'utf8'), /row_id="R-CD-2"/);
  } finally {
    await outer.cleanup();
    await fixture.cleanup();
  }
});

test('forged R-CD-2 review flags cannot clear review debt or publish metrics', async () => {
  const mutations = [
    ['run candidateOnly', (fixture) => ({
      file: 'run-result.json',
      value: { ...fixture.runResult, candidateOnly: false },
    })],
    ['run foldRequiresReview', (fixture) => ({
      file: 'run-result.json',
      value: { ...fixture.runResult, foldRequiresReview: false },
    })],
    ['run review status', (fixture) => ({
      file: 'run-result.json',
      value: {
        ...fixture.runResult,
        review: { status: 'review-pending', pendingReceipts: [] },
      },
    })],
    ['envelope canonicalFoldForbidden', (fixture) => ({
      file: 'candidate-run-result.json',
      value: { ...fixture.envelope, canonicalFoldForbidden: false },
    })],
    ['envelope review status', (fixture) => ({
      file: 'candidate-run-result.json',
      value: {
        ...fixture.envelope,
        review: { ...fixture.envelope.review, status: 'approved' },
      },
    })],
  ];
  for (const [label, mutate] of mutations) {
    const fixture = await writeRcd2Bundle(repoRoot);
    try {
      const mutation = mutate(fixture);
      await writeFile(
        path.join(fixture.runDir, mutation.file),
        `${JSON.stringify(mutation.value, null, 2)}\n`,
      );
      const metrics = await exportRun(fixture);
      assert.notEqual(metrics.status, 0, `${label} must block metric publication`);
      const debt = await run(process.execPath, [
        debtSummarizer, '--run-root', fixture.root, '--json',
      ]);
      assert.notEqual(debt.status, 0, `${label} must reject review-debt publication`);
      assert.equal(debt.stdout, '');
    } finally {
      await fixture.cleanup();
    }
  }
});

test('single-row metrics rejects unsigned R-CD-2 PASS before files or OTLP publication', async () => {
  const fixture = await writeRcd2Bundle(repoRoot, {
    includeReceipt: false,
    includeEnvelope: false,
    summaryVerdict: 'PASS-candidate',
  });
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(204);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/v1/metrics`;
    const result = await exportRun(fixture, ['--push-otlp', endpoint]);
    assert.notEqual(result.status, 0, 'unsigned R-CD-2 must not produce a successful export receipt');
    assert.doesNotMatch(result.stdout, /openclaw\.k6\.proof-metrics-export\.v1/);
    assert.equal(await exists(result.prom), false, 'Prometheus output must be atomic');
    assert.equal(await exists(result.otlp), false, 'OTLP output must be atomic');
    assert.equal(requests, 0, 'validation must finish before any OTLP request');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fixture.cleanup();
  }
});

test('invalid R-CD-2 candidate sidecar cannot raw-fallback to PASS in debt or metrics', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  const forged = {
    ...fixture.envelope,
    unknownAuthorityField: 'must-be-rejected',
  };
  await writeFile(
    path.join(fixture.runDir, 'candidate-run-result.json'),
    `${JSON.stringify(forged, null, 2)}\n`,
  );

  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(204);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const debt = await run(process.execPath, [
      debtSummarizer, '--run-root', fixture.root, '--json',
    ]);
    assert.notEqual(debt.status, 0);
    assert.equal(debt.stdout, '');

    const prom = path.join(fixture.root, 'single.prom');
    const otlp = path.join(fixture.root, 'single.otlp.json');
    const endpoint = `http://127.0.0.1:${server.address().port}/v1/metrics`;
    const single = await run(process.execPath, [
      exporter,
      '--run-dir', fixture.runDir,
      '--prometheus-out', prom,
      '--otlp-out', otlp,
      '--push-otlp', endpoint,
    ]);
    assert.notEqual(single.status, 0);
    assert.equal(await exists(prom), false);
    assert.equal(await exists(otlp), false);
    assert.equal(requests, 0);

    const bulk = path.join(fixture.root, 'bulk.prom');
    const exported = await run(process.execPath, [
      bulkExporter,
      '--root', fixture.root,
      '--out', bulk,
    ]);
    assert.notEqual(exported.status, 0);
    assert.equal(await exists(bulk), false);
    assert.doesNotMatch(exported.stdout, /openclaw_proofs_k6_run_total/);
    assert.equal(requests, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fixture.cleanup();
  }
});

test('generic metrics preserve raw fallback when an unrelated sidecar is malformed', async () => {
  const workspace = await testWorkspace(repoRoot, 'generic-invalid-sidecar');
  try {
    const rowResult = path.join(workspace.root, 'row-result.json');
    await writeFile(rowResult, `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-result.v1',
      runId: 'generic-run',
      rowId: 'R-CW-1',
      candidateSha: BASE.candidateSha,
      seat: BASE.seat,
      scenario: 'r-cw-1',
      outcome: 'PASS-candidate',
      metrics: { proofFailures: 0, checksRate: 1 },
      receipts: [],
      candidateOnly: true,
      foldRequiresReview: true,
    })}\n`);
    await writeFile(path.join(workspace.root, 'candidate-run-result.json'), '{invalid\n');
    const result = await run(process.execPath, [exporter, '--row-result', rowResult]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).outcome, 'PASS-candidate');
  } finally {
    await workspace.cleanup();
  }
});

test('normalized R-CD-2 PASS cannot replace contradictory raw authority or omit selected context', async (t) => {
  await t.test('identity-less normalized result', async () => {
    const workspace = await testWorkspace(repoRoot, 'rcd2-normalized');
    try {
      const input = path.join(workspace.root, 'row-result.json');
      const out = path.join(workspace.root, 'metrics.prom');
      await writeFile(input, `${JSON.stringify({
        schema: 'openclaw.k6.proof-row-result.v1',
        runId: BASE.runId,
        rowId: 'R-CD-2',
        candidateSha: BASE.candidateSha,
        seat: BASE.seat,
        scenario: 'r-cd-2-silent-wake',
        outcome: 'PASS-candidate',
        metrics: { proofFailures: 0, checksRate: 1 },
        receipts: [],
        candidateOnly: true,
        foldRequiresReview: true,
      })}\n`);
      const result = await run(process.execPath, [
        exporter, '--row-result', input, '--prometheus-out', out,
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(await exists(out), false);
    } finally {
      await workspace.cleanup();
    }
  });

  await t.test('normalized PASS shadowing a signed raw FAIL', async () => {
    const fixture = await writeRcd2Bundle(repoRoot, { verdict: 'FAIL-candidate' });
    try {
      const normalized = path.join(fixture.runDir, 'row-result.json');
      const out = path.join(fixture.root, 'metrics.prom');
      await writeFile(normalized, `${JSON.stringify({
        schema: 'openclaw.k6.proof-row-result.v1',
        runId: BASE.runId,
        rowId: 'R-CD-2',
        candidateSha: BASE.candidateSha,
        seat: BASE.seat,
        scenario: 'r-cd-2-silent-wake',
        outcome: 'PASS-candidate',
        metrics: { proofFailures: 0, checksRate: 1 },
        candidateOnly: true,
        foldRequiresReview: true,
      })}\n`);
      const result = await run(process.execPath, [
        exporter, '--row-result', normalized, '--prometheus-out', out,
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(await exists(out), false);
    } finally {
      await fixture.cleanup();
    }
  });
});

test('bulk metrics validates every row before publishing any mixed batch', async () => {
  const fixture = await writeRcd2Bundle(repoRoot, {
    includeReceipt: false,
    includeEnvelope: false,
    summaryVerdict: 'PASS-candidate',
  });
  try {
    const genericDir = path.join(
      fixture.root,
      BASE.candidateSha,
      'R-CW-1',
      BASE.seat,
      'run-r-cw-1',
    );
    await mkdir(genericDir, { recursive: true });
    await writeFile(path.join(genericDir, 'row-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-result.v1',
      runId: 'run-r-cw-1',
      rowId: 'R-CW-1',
      candidateSha: BASE.candidateSha,
      seat: BASE.seat,
      scenario: 'r-cw-1',
      outcome: 'PASS-candidate',
      metrics: { proofFailures: 0, checksRate: 1 },
      candidateOnly: true,
      foldRequiresReview: true,
    })}\n`);
    const out = path.join(fixture.root, 'bulk.prom');
    const result = await run(process.execPath, [
      bulkExporter, '--root', fixture.root, '--out', out,
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(await exists(out), false, 'a valid row must not be partially published');
    assert.doesNotMatch(result.stdout, /row_id="R-CW-1"/);
  } finally {
    await fixture.cleanup();
  }
});

test('directory and manifest R-CD-2 cannot be shadowed by R-CW-1 metadata', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    const spoofedMetadata = {
      ...fixture.metadata,
      row: 'R-CW-1',
      scenario: 'r-cw-1.js',
    };
    await writeFile(
      path.join(fixture.runDir, 'runner-metadata.json'),
      `${JSON.stringify(spoofedMetadata, null, 2)}\n`,
    );
    const failures = [];

    const report = await render(fixture);
    if (report.status === 0 && /<td>PASS-candidate<\/td>/.test(report.html)) failures.push('report generic fallback');

    const metrics = await exportRun(fixture);
    if (metrics.status === 0) failures.push('single-row metrics');

    let traceRequests = 0;
    const tempo = createServer((_request, response) => {
      traceRequests += 1;
      response.setHeader('content-type', 'application/json');
      response.end('{"traces":[]}');
    });
    await new Promise((resolve) => tempo.listen(0, '127.0.0.1', resolve));
    const collected = await run(process.execPath, [
      traceCollector,
      '--run-dir', fixture.runDir,
      '--manifest', fixture.manifestPath,
      '--seat', BASE.seat,
      '--evidence', path.join(fixture.runDir, 'private-evidence.json'),
      '--tempo-url', `http://127.0.0.1:${tempo.address().port}`,
      '--timeout-ms', '0',
      '--poll-ms', '1',
      '--settle-ms', '0',
    ]);
    await new Promise((resolve) => tempo.close(resolve));
    if (collected.status === 0 || traceRequests !== 0) failures.push('trace collector');

    if (candidateEnvelopeMatchesSiblings({
      envelope: fixture.envelope,
      manifest: fixture.manifest,
      metadata: spoofedMetadata,
      runResult: fixture.runResult,
      runDir: fixture.runDir,
    })) failures.push('sibling matcher');

    const emitted = await run(process.execPath, [
      candidateEmitter,
      '--manifest', fixture.manifestPath,
      '--candidate-dir', fixture.runDir,
      '--docs-ref', BASE.docsRef,
    ]);
    if (emitted.status === 0) failures.push('candidate emitter');

    const log = path.join(fixture.root, 'generic.log');
    await writeFile(log, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"row":"R-CD-2","redacted_events":[],"tool_accepted":true,"child_spawned":true}\n--- END EVIDENCE ---\n');
    const written = await run(process.execPath, [
      writer,
      '--input', log,
      '--row', 'R-CW-1',
      '--seat', BASE.seat,
      '--sha', BASE.candidateSha,
      '--manifest', fixture.manifestPath,
    ], { cwd: fixture.root });
    if (written.status === 0) failures.push('legacy writer generic fallback');

    const processed = await run(process.execPath, [
      postprocessor,
      '--manifest', fixture.manifestPath,
      '--summary', path.join(fixture.runDir, 'r-cd-2-summary.json'),
      '--out-root', path.join(fixture.root, 'postprocessed'),
      '--run-id', BASE.runId,
    ]);
    if (processed.status === 0) failures.push('postprocessor');

    assert.deepEqual(failures, [], `R-CD-2 authority bypasses: ${failures.join(', ')}`);
  } finally {
    await fixture.cleanup();
  }
});

test('all selected-context identity axes reject coherent foreign authority bundles', async () => {
  const cases = [
    ['candidate', { claimIdentity: { candidateSha: FOREIGN.candidateSha } }],
    ['runtime', { claimIdentity: { runtimeBuildSha: FOREIGN.runtimeBuildSha } }],
    ['docs', { claimIdentity: { docsRef: FOREIGN.docsRef } }],
    ['repository', { claimIdentity: { repository: FOREIGN.repository } }],
    ['seat', { claimIdentity: { seat: FOREIGN.seat } }],
    ['matrix', { claimIdentity: { matrixId: FOREIGN.matrixId } }],
    ['run', {
      claimIdentity: { runId: FOREIGN.runId },
      pathIdentity: { runId: FOREIGN.runId },
    }],
    ['row', {
      pathIdentity: { row: 'R-CW-1' },
    }],
    ['scenario', { claimIdentity: { scenario: FOREIGN.scenario } }],
    ['manifest path', { claimIdentity: { manifestPath: FOREIGN.manifestPath } }],
    ['manifest digest', { manifestMarker: 'foreign' }],
    ['scenario path', { claimIdentity: { scenarioPath: FOREIGN.scenarioPath } }],
    ['scenario digest', { scenarioMarker: 'foreign' }],
  ];
  const bypasses = [];
  for (const [axis, options] of cases) {
    const fixture = await writeRcd2Bundle(repoRoot, options);
    try {
      const resolved = await run(process.execPath, [
        resolver,
        '--run-dir', fixture.runDir,
        '--evidence', path.join(fixture.runDir, 'private-evidence.json'),
        '--correlation', path.join(fixture.runDir, 'continuation-trace-correlation.json'),
      ]);
      if (resolved.status === 0) bypasses.push(`${axis}:resolver`);

      const emitted = await run(process.execPath, [
        candidateEmitter,
        '--manifest', fixture.manifestPath,
        '--candidate-dir', fixture.runDir,
        '--docs-ref', BASE.docsRef,
      ]);
      if (emitted.status === 0) bypasses.push(`${axis}:candidate-emitter`);

      if (siblingMatch(fixture)) bypasses.push(`${axis}:sibling-matcher`);

      const metrics = await exportRun(fixture);
      if (metrics.status === 0) bypasses.push(`${axis}:metrics`);

      const report = await render(fixture);
      if (report.status === 0 && /<td>PASS-candidate<\/td>/.test(report.html)) {
        bypasses.push(`${axis}:report`);
      }

      const debt = await run(process.execPath, [
        debtSummarizer, '--run-root', fixture.root, '--json',
      ]);
      if (debt.status === 0 && JSON.parse(debt.stdout).pendingRows === 0) {
        bypasses.push(`${axis}:review-debt`);
      }
    } finally {
      await fixture.cleanup();
    }
  }
  assert.deepEqual(bypasses, [], `coherent foreign bundle accepted at ${bypasses.join(', ')}`);
});

test('a complete signed foreign bundle cannot be transplanted into another selected run or corpus', async () => {
  const foreignClaims = {
    ...FOREIGN,
    row: 'R-CD-2',
  };
  const fixture = await writeRcd2Bundle(repoRoot, {
    claimIdentity: foreignClaims,
    pathIdentity: { runId: FOREIGN.runId },
  });
  try {
    const accepted = [];
    const emitted = await run(process.execPath, [
      candidateEmitter,
      '--manifest', fixture.manifestPath,
      '--candidate-dir', fixture.runDir,
      '--docs-ref', FOREIGN.docsRef,
    ]);
    if (emitted.status === 0) accepted.push('candidate-emitter');
    if (siblingMatch(fixture)) accepted.push('sibling-matcher');

    const report = await render(fixture);
    if (report.status === 0 && /<td>PASS-candidate<\/td>/.test(report.html)) accepted.push('report');
    const metrics = await exportRun(fixture);
    if (metrics.status === 0) accepted.push('metrics');
    const debt = await run(process.execPath, [
      debtSummarizer, '--run-root', fixture.root, '--json',
    ]);
    if (debt.status === 0 && JSON.parse(debt.stdout).pendingRows === 0) accepted.push('review-debt');

    const canonicalRow = path.join(fixture.root, 'PROOFS', BASE.candidateSha, 'R-CD-2');
    const reviewedRun = path.join(canonicalRow, BASE.seat, FOREIGN.runId);
    await mkdir(canonicalRow, { recursive: true });
    await cp(fixture.runDir, reviewedRun, { recursive: true });
    await writeFile(path.join(canonicalRow, 'EVIDENCE.md'), '# Copied foreign candidate\n');
    const rollup = {
      total_rows: 1, pass: 1, partial: 0, thin: 0, fail: 0, honest_limit: 0, missing: 0,
    };
    await writeFile(
      path.join(fixture.root, 'PROOFS', BASE.candidateSha, 'proofs-manifest.json'),
      `${JSON.stringify({
        schema: 'openclaw.proofs.manifest.v1',
        capture_sha: BASE.candidateSha,
        rows: [{
          row: 'R-CD-2',
          state: 'pass',
          dir: `PROOFS/${BASE.candidateSha}/R-CD-2`,
          evidence_doc: `PROOFS/${BASE.candidateSha}/R-CD-2/EVIDENCE.md`,
          reviewed_run: `PROOFS/${BASE.candidateSha}/R-CD-2/${BASE.seat}/${FOREIGN.runId}`,
        }],
        rollup,
      }, null, 2)}\n`,
    );
    await writeFile(
      path.join(fixture.root, 'PROOFS', 'INDEX.json'),
      `${JSON.stringify({
        schema: 'openclaw.proofs.index.v1',
        current_sha: BASE.candidateSha,
        corpus_path: `PROOFS/${BASE.candidateSha}`,
        manifest_path: `PROOFS/${BASE.candidateSha}/proofs-manifest.json`,
        rollup,
      }, null, 2)}\n`,
    );
    const corpus = await run(process.execPath, [
      path.join(scripts, 'validate-corpus.mjs'),
      '--root', fixture.root,
      '--index',
      '--json',
    ]);
    if (corpus.status === 0) accepted.push('corpus');

    assert.deepEqual(accepted, [], `transplanted foreign authority accepted by: ${accepted.join(', ')}`);
  } finally {
    await fixture.cleanup();
  }
});

test('summary, evidence, correlation, result, envelope, and receipt disagreeing with selection fail closed', async () => {
  const mutations = [
    ['summary', async (fixture) => {
      await writeFile(path.join(fixture.runDir, 'r-cd-2-summary.json'), `${JSON.stringify({
        ...fixture.summary,
        row: 'R-CW-1',
      })}\n`);
    }],
    ['evidence', async (fixture) => {
      await writeFile(path.join(fixture.runDir, 'evidence.jsonl'), '{"row":"R-CW-1","verdict":"PASS-candidate"}\n');
    }],
    ['correlation', async (fixture) => {
      await writeFile(path.join(fixture.runDir, 'continuation-trace-correlation.json'), `${JSON.stringify({
        ...fixture.correlation,
        row: 'R-CW-1',
      })}\n`);
    }],
    ['run result', async (fixture) => {
      await writeFile(path.join(fixture.runDir, 'run-result.json'), `${JSON.stringify({
        ...fixture.runResult,
        verdict: 'FAIL-candidate',
      })}\n`);
    }],
    ['envelope', async (fixture) => {
      await writeFile(path.join(fixture.runDir, 'candidate-run-result.json'), `${JSON.stringify({
        ...fixture.envelope,
        result: { ...fixture.envelope.result, outcome: 'FAIL-candidate' },
      })}\n`);
    }],
    ['receipt', async (fixture) => {
      const receipt = structuredClone(fixture.receipt);
      receipt.identity.seat = FOREIGN.seat;
      await writeFile(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'), `${JSON.stringify(receipt)}\n`);
    }],
  ];
  const bypasses = [];
  for (const [name, mutate] of mutations) {
    const fixture = await writeRcd2Bundle(repoRoot);
    try {
      await mutate(fixture);
      const metrics = await exportRun(fixture);
      if (metrics.status === 0) bypasses.push(`${name}:metrics`);
      const report = await render(fixture);
      if (report.status === 0 && /<td>PASS-candidate<\/td>/.test(report.html)) {
        bypasses.push(`${name}:report`);
      }
      const debt = await run(process.execPath, [
        debtSummarizer, '--run-root', fixture.root, '--json',
      ]);
      if (debt.status === 0 && JSON.parse(debt.stdout).pendingRows === 0) {
        bypasses.push(`${name}:review-debt`);
      }
    } finally {
      await fixture.cleanup();
    }
  }
  assert.deepEqual(bypasses, [], `contradictory sibling accepted at ${bypasses.join(', ')}`);
});

test('every disk artifact rejects foreign claims in recognized nested identity carriers', async (t) => {
  const foreignCarrier = (fixture, carrier = 'authorityIdentity') => ({
    [carrier]: {
      ...fixture.receipt.identity,
      seat: FOREIGN.seat,
    },
  });
  const mutations = [
    ['summary', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'r-cd-2-summary.json'),
        `${JSON.stringify({ ...fixture.summary, nested: foreignCarrier(fixture) })}\n`,
      );
    }],
    ['runner metadata', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'runner-metadata.json'),
        `${JSON.stringify({
          ...fixture.metadata,
          nested: foreignCarrier(fixture, 'harness'),
        })}\n`,
      );
    }],
    ['run result', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'run-result.json'),
        `${JSON.stringify({ ...fixture.runResult, nested: foreignCarrier(fixture, 'identity') })}\n`,
      );
    }],
    ['normalized row result', async (fixture) => {
      fixture.rowResult = {
        row: 'R-CD-2',
        candidateSha: BASE.candidateSha,
        seat: BASE.seat,
        scenario: BASE.scenario,
        candidateOnly: true,
        foldRequiresReview: true,
        nested: foreignCarrier(fixture),
      };
    }],
    ['private evidence', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'private-evidence.json'),
        `${JSON.stringify({ ...fixture.evidence, nested: foreignCarrier(fixture, 'identity') })}\n`,
      );
    }],
    ['public evidence', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'evidence.jsonl'),
        `${JSON.stringify({
          row: 'R-CD-2',
          verdict: 'PASS-candidate',
          nested: foreignCarrier(fixture),
        })}\n`,
      );
    }],
    ['correlation', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'continuation-trace-correlation.json'),
        `${JSON.stringify({ ...fixture.correlation, nested: foreignCarrier(fixture, 'identity') })}\n`,
      );
    }],
    ['envelope', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'candidate-run-result.json'),
        `${JSON.stringify({ ...fixture.envelope, nested: foreignCarrier(fixture) })}\n`,
      );
    }],
    ['authoritative receipt', async (fixture) => {
      await writeFile(
        path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'),
        `${JSON.stringify({ ...fixture.receipt, nested: foreignCarrier(fixture, 'identity') })}\n`,
      );
    }],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, async () => {
      const fixture = await writeRcd2Bundle(repoRoot);
      try {
        await mutate(fixture);
        assert.throws(
          () => consumeRcd2Authority({
            runDir: fixture.runDir,
            rowResult: fixture.rowResult,
            signingKey: SIGNING_KEY,
          }),
          /authority identity mismatch/u,
        );
      } finally {
        await fixture.cleanup();
      }
    });
  }
});

test('missing or invalid authority rejects review-debt publication', async () => {
  const bypasses = [];
  for (const kind of ['missing', 'invalid']) {
    const fixture = await writeRcd2Bundle(repoRoot, {
      includeReceipt: kind !== 'missing',
      includeEnvelope: false,
    });
    try {
      if (kind === 'invalid') {
        await writeFile(path.join(fixture.runDir, 'r-cd-2-authoritative-receipt.json'), '{}\n');
      }
      const debt = await run(process.execPath, [
        debtSummarizer, '--run-root', fixture.root, '--json',
      ]);
      if (debt.status === 0 || debt.stdout !== '') bypasses.push(kind);
    } finally {
      await fixture.cleanup();
    }
  }
  assert.deepEqual(bypasses, [], `authority debt erased for: ${bypasses.join(', ')}`);
});

test('artifact destination cannot relabel an R-CD-2 summary into a generic row', async () => {
  const fixture = await writeRcd2Bundle(repoRoot);
  try {
    const generic = {
      ...fixture.manifest,
      rowId: 'R-CW-1',
      scenario: { name: 'r-cw-1', file: 'r-cw-1.js' },
      artifactDestination: {
        root: path.join(fixture.root, 'post'),
        sha: BASE.candidateSha,
        row: 'R-CD-2',
        seat: BASE.seat,
        runDirPrefix: 'forged',
      },
    };
    const manifestPath = path.join(fixture.root, 'destination-manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(generic, null, 2)}\n`);
    const result = await run(process.execPath, [
      postprocessor,
      '--manifest', manifestPath,
      '--summary', path.join(fixture.runDir, 'r-cd-2-summary.json'),
      '--run-id', BASE.runId,
    ]);
    assert.notEqual(result.status, 0);
  } finally {
    await fixture.cleanup();
  }
});
