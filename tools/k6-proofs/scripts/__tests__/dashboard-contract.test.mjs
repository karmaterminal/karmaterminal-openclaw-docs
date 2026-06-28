import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const dashboardPath = join(repoRoot, 'tools/k6-proofs/dashboards/k6-proofs.json');

const allowedMetricNames = new Set([
  'openclaw_proofs_k6_run_total',
  'openclaw_proofs_k6_proof_failures_total',
  'openclaw_proofs_k6_duration_ms',
  'openclaw_proofs_k6_checks_rate',
  'openclaw_proofs_k6_receipt_status',
  'openclaw_proofs_k6_candidate_pending_review',
]);

const forbiddenMetricNames = [
  'k6_checks_rate',
  'k6_http_reqs_total',
  'k6_iterations_total',
  'k6_preflight_pass_total',
  'k6_http_req_duration_p99',
  'k6_iteration_duration_p99',
  'k6_data_received_total',
  'k6_data_sent_total',
  'k6_http_req_failed_rate',
];

function collectTargets(dashboard) {
  return dashboard.panels.flatMap((panel) => panel.targets || []);
}

test('committed Grafana dashboard uses the Project 81 public-safe metric contract', async () => {
  const dashboard = JSON.parse(await readFile(dashboardPath, 'utf8'));
  assert.equal(dashboard.uid, 'k6-proofs-candidate-row-health');

  const targets = collectTargets(dashboard);
  assert.ok(targets.length >= 8, 'dashboard should expose the v1 proof-health panels');

  const expressions = targets.map((target) => target.expr || '').join('\n');
  for (const metricName of allowedMetricNames) {
    assert.match(expressions, new RegExp(`\\b${metricName}\\b`), `${metricName} missing from dashboard`);
  }
  for (const metricName of forbiddenMetricNames) {
    assert.doesNotMatch(expressions, new RegExp(`\\b${metricName}\\b`), `${metricName} should not appear in proof dashboard`);
  }
});

test('dashboard variables stay on public-safe proof labels', async () => {
  const dashboard = JSON.parse(await readFile(dashboardPath, 'utf8'));
  const variableNames = new Set((dashboard.templating?.list || []).map((item) => item.name));

  assert.deepEqual(variableNames, new Set(['candidate_sha', 'row_id', 'seat']));

  const variableQueries = (dashboard.templating?.list || []).map((item) => item.query || '').join('\n');
  assert.doesNotMatch(variableQueries, /session|token|prompt|nonce|authorization/i);
  assert.match(variableQueries, /label_values\(openclaw_proofs_k6_run_total, candidate_sha\)/);
});
