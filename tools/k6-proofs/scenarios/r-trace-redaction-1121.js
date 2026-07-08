/**
 * Scenario: R-TRACE-REDACTION-1121 — offline/static redaction-contract evidence validator.
 *
 * Validates the committed proof evidence for #1121 trace redaction. This is a
 * static artifact check, not a live continuation fire and not a source checkout
 * test runner.
 */
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_trace_redaction_1121_static: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '10s' } },
  thresholds: { proof_failures: ['count==0'], r_trace_redaction_1121_duration: ['p(95)<10000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_trace_redaction_1121_duration');
const manifest = loadManifestFromEnv();
const index = JSON.parse(open('../../../PROOFS/INDEX.json'));
const currentSha = index.current_sha;
const rowRoot = `../../../PROOFS/${currentSha}/R-TRACE-REDACTION-1121`;
const evidenceMd = open(`${rowRoot}/EVIDENCE.md`);

export default function () {
  const started = Date.now();
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }
  const evidence = {
    row: 'R-TRACE-REDACTION-1121',
    manifest_loaded: !!manifest,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    currentProofSha: currentSha,
    started: new Date().toISOString(),
    pass_heading_present: evidenceMd.includes('# R-TRACE-REDACTION-1121') && evidenceMd.includes('PASS'),
    safe_attrs_present: ['reason.present', 'reason.length', 'reason.hash', 'reason.redacted'].every((needle) => evidenceMd.includes(needle)),
    no_preview_contract_present: evidenceMd.includes('No `reason.preview` field exists') || evidenceMd.includes('asserts no `reason.preview`'),
    raw_reason_guard_present: evidenceMd.includes('asserts no attribute value contains the raw reason'),
    test_pass_present: evidenceMd.includes('src/infra/continuation-tracer.test.ts (88 tests) passed'),
    source_surface_present: evidenceMd.includes('src/infra/continuation-tracer.ts') && evidenceMd.includes('src/infra/continuation-tracer.test.ts'),
    source_files: { evidence: `${rowRoot}/EVIDENCE.md` },
  };
  const ok = evidence.pass_heading_present && evidence.safe_attrs_present && evidence.no_preview_contract_present && evidence.raw_reason_guard_present && evidence.test_pass_present && evidence.source_surface_present;
  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.verdict = ok ? 'PASS-candidate' : 'FAIL-candidate';
  duration.add(evidence.duration_ms);
  check(null, {
    'pass heading present': () => evidence.pass_heading_present,
    'safe attrs present': () => evidence.safe_attrs_present,
    'no preview contract present': () => evidence.no_preview_contract_present,
    'raw reason guard present': () => evidence.raw_reason_guard_present,
    'test pass present': () => evidence.test_pass_present,
    'source/test surfaces present': () => evidence.source_surface_present,
  });
  if (!ok) failures.add(1);
  console.log(`R_TRACE_REDACTION_1121_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  return { 'r-trace-redaction-1121-summary.json': JSON.stringify({ row: 'R-TRACE-REDACTION-1121', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', verdict: failuresCount === 0 ? 'PASS-candidate' : 'FAIL-candidate', metrics: { failures: failuresCount, duration_ms: data.metrics.r_trace_redaction_1121_duration?.values || null } }, null, 2) };
}
