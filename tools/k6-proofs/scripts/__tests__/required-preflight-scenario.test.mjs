import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// A required preflight (R-CW-5A/6A) runs at the exact candidate: it reads the
// candidate's own committed source/harness material, PROOFS/<candidate>/…, never
// the INDEX's carried static_evidence_sha, and writes a receipt bound to that
// candidate. At F′ the static validator reported candidateSha f15237ec92 while it
// read PROOFS/1cc8f4e3…; this fixes the binding. Other static rows keep reading
// the pinned static baseline.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const driver = join(repoRoot, 'tools/k6-proofs/scripts/__tests__/helpers/k6-static-scenario-driver.mjs');
const CANDIDATE = 'c'.repeat(40);
const STATIC_BASELINE = '1cc8f4e3d617ef6f173283ef83d7b739a4995734';
const CURRENT = 'e'.repeat(40);

/** Committed static material each validator accepts, keyed by the row whose files it reads. */
function material(row, sha, { passing = true } = {}) {
  const ok = (text) => (passing ? text : 'nothing relevant');
  if (row === 'R-CW-5') {
    return {
      'EVIDENCE.md': ok('## Verdict\nPASS: static/source + unit-test evidence; does not mutate live config.\n'),
      'scheduler-source.txt': ok('if (accumulated > config.costCapTokens) return "cost-capped"; // costCapTokens\n'),
      'delegate-dispatch-cost-cap-source.txt': ok('throw new Error("cost cap exceeded")\n'),
      'subagent-announce-bracket-cost-cap-source.txt': ok('costCapTokens\n'),
      'subagent-announce-tool-cost-cap-source.txt': ok('costCapTokens\n'),
      'vitest-delegate-dispatch-cost-cap-exhaustion.log': ok('✓ rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1\n✓ exact boundary\n5 passed\n'),
      'vitest-chain-guard-cost-cap.log': ok('2 passed\n'),
      'source-sha.txt': `${sha}\n`,
    };
  }
  if (row === 'R-CW-6') {
    return {
      'EVIDENCE.md': ok('## Verdict\nPASS. It does **not** mutate live `openclaw.json` and does **not** restart the gateway.\n'),
      'source/scheduler-source-snippet.txt': ok('if (allocatedChainHop >= config.maxChainLength) return chainCapped;\n'),
      'source/work-dispatch-source-snippet.txt': ok('return { scheduled: false, capped: true };\n'),
      'source/scheduler-test-snippet.txt': ok('expect(result.reason).toBe("chain-capped")\n'),
      'harness/scheduler-boundary-harness.log': ok('{ "scheduled": false, "capped": true, "reason": "chain-capped" }\n'),
      'source-sha.txt': `${sha}\n`,
    };
  }
  if (row === 'R-CW-7') {
    return {
      'EVIDENCE.md': ok('PASS for runtime traceparent propagation; internal protocol field.\n'),
      'test/focused-traceparent-tests.log': ok('passed 3 Vitest shards\n'),
      'source/source-snippets.md': ok('x-openclaw-internal; auto-picks the active runtime trace context; threads persisted traceparent; forwards inherited traceparent\n'),
      'source/source-sha.txt': ok(`${sha}\n`),
    };
  }
  throw new Error(`no material for ${row}`);
}

async function withHarness({ manifest, material: corpora = [] }, fn) {
  const root = await mkdtemp(join(tmpdir(), 'k6-required-preflight-scenario-'));
  try {
    const proofs = join(root, 'tools/k6-proofs');
    await mkdir(join(proofs, 'scenarios'), { recursive: true });
    await mkdir(join(proofs, 'manifests'), { recursive: true });
    await cp(join(repoRoot, 'tools/k6-proofs/scenarios/static-corpus-row-validator.js'), join(proofs, 'scenarios/static-corpus-row-validator.js'));
    await cp(join(repoRoot, 'tools/k6-proofs/lib'), join(proofs, 'lib'), { recursive: true });
    await cp(join(repoRoot, 'tools/k6-proofs/manifests', manifest), join(proofs, 'manifests', manifest));
    await mkdir(join(root, 'PROOFS'), { recursive: true });
    await writeFile(join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({
      schema: 'openclaw.proofs.index.v1', current_sha: CURRENT, static_evidence_sha: STATIC_BASELINE,
    })}\n`);
    for (const { row, sha, passing, names = sha } of corpora) {
      for (const [file, content] of Object.entries(material(row, names, { passing }))) {
        const path = join(root, 'PROOFS', sha, row, 'cael-dgx', file);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
      }
    }
    return await fn({ root, scenarios: join(proofs, 'scenarios'), manifestPath: join(proofs, 'manifests', manifest) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function runScenario({ scenarios, manifestPath }, env) {
  const result = spawnSync(process.execPath, [driver, join(scenarios, 'static-corpus-row-validator.js')], {
    cwd: scenarios,
    encoding: 'utf8',
    env: { ...process.env, K6_DRIVER_ENV: JSON.stringify({ OPENCLAW_ROW_MANIFEST: manifestPath, ...env }) },
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const line = output.lines.find((entry) => entry.message.startsWith('STATIC_CORPUS_ROW_EVIDENCE '));
  assert.ok(line, JSON.stringify(output.lines));
  const evidence = JSON.parse(line.message.slice('STATIC_CORPUS_ROW_EVIDENCE '.length));
  const summary = JSON.parse(output.files['static-corpus-row-summary.json']);
  const receiptRaw = output.files['required-preflight-receipt.json'];
  return { evidence, summary, receipt: receiptRaw === undefined ? undefined : JSON.parse(receiptRaw), output };
}

const PREFLIGHT_ROWS = [
  { preflight: 'R-CW-5A', live: 'R-CW-5', manifest: 'r-cw-5a-static.json' },
  { preflight: 'R-CW-6A', live: 'R-CW-6', manifest: 'r-cw-6a-static.json' },
];

test('a preflight run never reads the INDEX static_evidence_sha: baseline-only material fails at the candidate', async () => {
  for (const { preflight, live, manifest } of PREFLIGHT_ROWS) {
    await withHarness({ manifest, material: [{ row: live, sha: STATIC_BASELINE }] }, async (harness) => {
      const { evidence, summary, receipt } = runScenario(harness, { OPENCLAW_CANDIDATE_SHA: CANDIDATE });
      assert.equal(evidence.row, preflight);
      assert.equal(evidence.sourceEvidenceSha, CANDIDATE, `${preflight} read ${evidence.sourceEvidenceSha}`);
      assert.equal(evidence.evidenceBinding, 'exact-candidate-sha');
      assert.equal(evidence.verdict, 'FAIL-candidate');
      for (const path of Object.values(evidence.source_files)) assert.match(path, new RegExp(`PROOFS/${CANDIDATE}/${live}/`));
      assert.equal(summary.verdict, 'FAIL-candidate');
      assert.equal(receipt.preflightStatus, 'failed');
      assert.equal(receipt.verdict, 'FAIL-candidate');
      assert.equal(receipt.candidateSha, CANDIDATE);
      assert.equal(receipt.sourceEvidenceSha, CANDIDATE);
    });
  }
});

test('a preflight run at the candidate passes on the candidate\'s own material and writes a bound receipt', async () => {
  for (const { preflight, live, manifest } of PREFLIGHT_ROWS) {
    // Failing material at the INDEX baseline proves the pass comes from the candidate.
    const corpora = [{ row: live, sha: CANDIDATE }, { row: live, sha: STATIC_BASELINE, passing: false }];
    await withHarness({ manifest, material: corpora }, async (harness) => {
      const { evidence, summary, receipt, output } = runScenario(harness, { OPENCLAW_CANDIDATE_SHA: CANDIDATE });
      assert.equal(output.failures, 0);
      assert.equal(evidence.verdict, 'construct-only');
      assert.equal(evidence.checks.exactCandidateBinding, true);
      assert.equal(evidence.checks.materialNamesCandidate, true);
      assert.equal(evidence.checks.nonLiveBoundary, true);
      assert.equal(summary.verdict, 'construct-only');
      assert.equal(summary.sha, CANDIDATE);
      assert.deepEqual(Object.keys(receipt).sort(), [
        'attachedTo', 'candidateSha', 'checks', 'evidenceBinding', 'preflightRow', 'preflightStatus', 'schema',
        'sourceEvidenceSha', 'verdict',
      ]);
      assert.equal(receipt.schema, 'openclaw.k6.required-preflight-receipt.v1');
      assert.equal(receipt.preflightRow, preflight);
      assert.equal(receipt.attachedTo, live);
      assert.equal(receipt.candidateSha, CANDIDATE);
      assert.equal(receipt.sourceEvidenceSha, CANDIDATE);
      assert.equal(receipt.evidenceBinding, 'exact-candidate-sha');
      assert.equal(receipt.verdict, 'construct-only');
      assert.equal(receipt.preflightStatus, 'passed');
      assert.deepEqual(receipt.checks, evidence.checks);
      assert.ok(Object.values(receipt.checks).every((value) => value === true));
    });
  }
});

test('the static baseline\'s material copied under the candidate does not pass: the material must name the candidate', async () => {
  for (const { live, manifest } of PREFLIGHT_ROWS) {
    // Every content check holds, but the material is the INDEX baseline's, naming its SHA.
    await withHarness({ manifest, material: [{ row: live, sha: CANDIDATE, names: STATIC_BASELINE }] }, async (harness) => {
      const { evidence, receipt } = runScenario(harness, { OPENCLAW_CANDIDATE_SHA: CANDIDATE });
      assert.equal(evidence.sourceEvidenceSha, CANDIDATE);
      assert.equal(evidence.checks.materialNamesCandidate, false, manifest);
      assert.equal(evidence.checks.exactCandidateBinding, true);
      assert.equal(evidence.verdict, 'FAIL-candidate');
      assert.equal(receipt.preflightStatus, 'failed');
      assert.deepEqual(Object.entries(receipt.checks).filter(([, value]) => value !== true).map(([name]) => name), ['materialNamesCandidate']);
    });
  }
});

test('a preflight run without a 40-character candidate SHA fails closed', async () => {
  for (const { manifest, live } of PREFLIGHT_ROWS) {
    for (const candidate of [undefined, 'c0ffee']) {
      const corpora = [{ row: live, sha: STATIC_BASELINE }, { row: live, sha: CANDIDATE }];
      await withHarness({ manifest, material: corpora }, async (harness) => {
        const env = candidate === undefined ? {} : { OPENCLAW_CANDIDATE_SHA: candidate };
        const { evidence, receipt } = runScenario(harness, env);
        assert.equal(evidence.verdict, 'FAIL-candidate', `${manifest} ${candidate}`);
        assert.equal(evidence.checks.exactCandidateBinding, false);
        assert.notEqual(evidence.sourceEvidenceSha, STATIC_BASELINE);
        assert.equal(receipt.preflightStatus, 'failed');
        assert.equal(receipt.candidateSha, null);
      });
    }
  }
});

test('a non-preflight static row keeps reading the pinned static baseline and writes no preflight receipt', async () => {
  await withHarness({ manifest: 'r-cw-7.json', material: [{ row: 'R-CW-7', sha: STATIC_BASELINE }] }, async (harness) => {
    const { evidence, summary, receipt } = runScenario(harness, { OPENCLAW_CANDIDATE_SHA: CANDIDATE });
    assert.equal(evidence.row, 'R-CW-7');
    assert.equal(evidence.sourceEvidenceSha, STATIC_BASELINE);
    assert.equal(evidence.verdict, 'PASS-candidate');
    assert.equal(summary.verdict, 'PASS-candidate');
    assert.equal(receipt, undefined);
  });
});
