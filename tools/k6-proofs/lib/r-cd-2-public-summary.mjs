/**
 * Project a private k6 summary into the only summary shape R-CD-2 may publish.
 * The original k6 export can include provider/RPC text and identifier-bearing
 * tags, so this deliberately copies numeric aggregate metrics only.
 */

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function metricValues(summary, name) {
  return summary?.metrics?.[name]?.values || {};
}

export function projectRcd2PublicSummary(summary, lifecycleReceipt) {
  const failures = metricValues(summary, 'proof_failures');
  const checks = metricValues(summary, 'checks');
  const duration = metricValues(summary, 'proof_row_duration_ms');

  return {
    schema: 'openclaw.k6.r-cd-2-public-summary.v1',
    row: 'R-CD-2',
    verdict: lifecycleReceipt.verdict,
    ...(lifecycleReceipt.failureCategory
      ? { failureCategory: lifecycleReceipt.failureCategory }
      : {}),
    metrics: {
      proofFailures: finiteNumber(failures.count),
      checksRate: finiteNumber(checks.rate),
      durationMs: finiteNumber(duration.avg ?? duration.med ?? duration.max),
    },
    candidateOnly: true,
    foldRequiresReview: true,
  };
}
