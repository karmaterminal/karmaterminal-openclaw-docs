/**
 * Scenario: R-OBS-2 — offline/static trace-tree observability validator.
 *
 * Validates the committed current PROOFS corpus has normalized trace-tree,
 * span-tree, and span-count receipts for R-OBS-2. This is intentionally offline:
 * it validates the existing observability artifact shape, not fresh live gateway
 * behavior.
 */
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_obs_2_static: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '15s' } },
  thresholds: { proof_failures: ['count==0'], r_obs_2_duration: ['p(95)<10000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_obs_2_duration');
const manifest = loadManifestFromEnv();
const index = JSON.parse(open('../../../PROOFS/INDEX.json'));
const currentSha = index.current_sha;
const sourceEvidenceSha = index.static_evidence_sha || currentSha;
const rowRoot = `../../../PROOFS/${sourceEvidenceSha}/R-OBS-2/cael-dgx`;
const traceTree = JSON.parse(open(`${rowRoot}/trace-tree.json`));
const spanCounts = JSON.parse(open(`${rowRoot}/span-counts.json`));
const spanTreeText = open(`${rowRoot}/span-tree.txt`);

export default function () {
  const started = Date.now();
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }
  const requiredSpanNames = ['continuation.delegate.dispatch', 'openclaw.harness.run', 'openclaw.run', 'openclaw.tool.execution', 'continuation.queue.fanout', 'continuation.queue.drain'];
  const evidence = {
    row: 'R-OBS-2', manifest_loaded: !!manifest, candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', currentProofSha: currentSha, sourceEvidenceSha, started: new Date().toISOString(),
    trace_ids_hex: spanCounts.traceIdsHex || traceTree.traceIdsHex || [], span_count: spanCounts.spanCount ?? traceTree.spanCount ?? null, root_count: spanCounts.rootCount ?? traceTree.rootCount ?? null, orphan_count: spanCounts.orphanCount ?? traceTree.orphanCount ?? null,
    required_span_names_present: {}, source_files: { traceTree: `${rowRoot}/trace-tree.json`, spanTree: `${rowRoot}/span-tree.txt`, spanCounts: `${rowRoot}/span-counts.json` },
  };
  for (const name of requiredSpanNames) evidence.required_span_names_present[name] = spanTreeText.includes(name) || Boolean((spanCounts.spanNameCounts || {})[name]);
  const ok = evidence.trace_ids_hex.length > 0 && evidence.span_count > 0 && evidence.root_count >= 1 && evidence.orphan_count === 0 && Object.values(evidence.required_span_names_present).every(Boolean);
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; evidence.verdict = ok ? 'PASS-candidate' : 'FAIL-candidate'; duration.add(evidence.duration_ms);
  check(null, { 'trace id present': () => evidence.trace_ids_hex.length > 0, 'span count positive': () => evidence.span_count > 0, 'root exists': () => evidence.root_count >= 1, 'zero orphan spans': () => evidence.orphan_count === 0, 'required lineage present': () => Object.values(evidence.required_span_names_present).every(Boolean) });
  if (!ok) failures.add(1);
  console.log(`R_OBS_2_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  return { 'r-obs-2-summary.json': JSON.stringify({ row: 'R-OBS-2', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', verdict: failuresCount === 0 ? 'PASS-candidate' : 'FAIL-candidate', metrics: { failures: failuresCount, duration_ms: data.metrics.r_obs_2_duration?.values || null } }, null, 2) };
}
