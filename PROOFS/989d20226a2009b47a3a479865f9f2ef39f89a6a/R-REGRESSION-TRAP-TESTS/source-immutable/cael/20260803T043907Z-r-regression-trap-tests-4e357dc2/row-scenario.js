/**
 * Scenario: R-REGRESSION-TRAP-TESTS — offline/static regression-trap evidence validator.
 *
 * Validates the committed current PROOFS corpus contains the source/test receipts
 * for the continuation sibling-surface regression traps. It does not run Vitest
 * and does not connect to a gateway; it verifies the packaged proof artifacts
 * are present and internally consistent enough for candidate review.
 */
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_regression_trap_tests_static: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '15s' } },
  thresholds: { proof_failures: ['count==0'], r_regression_trap_tests_duration: ['p(95)<10000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_regression_trap_tests_duration');
const manifest = loadManifestFromEnv();
const index = JSON.parse(open('../../../PROOFS/INDEX.json'));
const currentSha = index.current_sha;
const sourceEvidenceSha = index.static_evidence_sha || currentSha;
const rowRoot = `../../../PROOFS/${sourceEvidenceSha}/R-REGRESSION-TRAP-TESTS/cael-dgx`;
const evidenceMd = open(`${rowRoot}/EVIDENCE.md`);
const regressionLog = open(`${rowRoot}/regression-trap.log`);
const sourceStatus = open(`${rowRoot}/source-git-status.txt`);
const testInventory = open(`${rowRoot}/test-inventory.txt`);
const sourceCheckoutSha = sourceStatus.match(/^[0-9a-f]{40}$/m)?.[0] || null;

export default function () {
  const started = Date.now();
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const requiredTests = [
    'src/agents/tools/continuation-inventory-opts.test.ts',
    'src/agents/openclaw-tools.continuation-registration.test.ts',
    'src/agents/tools/continuation-tools-registration.test.ts',
    'src/agents/openclaw-tools.continuation-misconfig-warn.test.ts',
  ];
  const evidence = {
    row: 'R-REGRESSION-TRAP-TESTS',
    manifest_loaded: !!manifest,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    currentProofSha: currentSha,
    sourceEvidenceSha,
    sourceCheckoutSha,
    started: new Date().toISOString(),
    verdict_text_present: evidenceMd.includes('Verdict: ✅ PASS') || evidenceMd.includes('Verdict: PASS'),
    shard_pass_text_present: regressionLog.includes('[test] passed 2 Vitest shards'),
    test_count_text_present: evidenceMd.includes('31/31 PASS') || (regressionLog.includes('5 passed') && regressionLog.includes('26 passed')),
    source_sha_present: Boolean(sourceCheckoutSha && evidenceMd.includes(sourceCheckoutSha)),
    required_tests_present: Object.fromEntries(requiredTests.map((name) => [name, evidenceMd.includes(name) || regressionLog.includes(name) || testInventory.includes(name)])),
    source_files: {
      evidence: `${rowRoot}/EVIDENCE.md`,
      log: `${rowRoot}/regression-trap.log`,
      sourceStatus: `${rowRoot}/source-git-status.txt`,
      testInventory: `${rowRoot}/test-inventory.txt`,
    },
  };
  const ok = evidence.verdict_text_present && evidence.shard_pass_text_present && evidence.test_count_text_present && evidence.source_sha_present && Object.values(evidence.required_tests_present).every(Boolean);
  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.verdict = ok ? 'PASS-candidate' : 'FAIL-candidate';
  duration.add(evidence.duration_ms);
  check(null, {
    'verdict pass text present': () => evidence.verdict_text_present,
    'two vitest shards passed': () => evidence.shard_pass_text_present,
    '31 tests passed text present': () => evidence.test_count_text_present,
    'source sha present': () => evidence.source_sha_present,
    'required tests named': () => Object.values(evidence.required_tests_present).every(Boolean),
  });
  if (!ok) failures.add(1);
  console.log(`R_REGRESSION_TRAP_TESTS_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  return { 'r-regression-trap-tests-summary.json': JSON.stringify({ row: 'R-REGRESSION-TRAP-TESTS', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', verdict: failuresCount === 0 ? 'PASS-candidate' : 'FAIL-candidate', metrics: { failures: failuresCount, duration_ms: data.metrics.r_regression_trap_tests_duration?.values || null } }, null, 2) };
}
