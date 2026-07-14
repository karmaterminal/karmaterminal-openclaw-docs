/**
 * Project a private k6 summary into the only summary shape R-CD-2 may publish.
 * The original k6 export can include provider/RPC text and identifier-bearing
 * tags, so this deliberately copies numeric aggregate metrics only.
 */

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function metricValues(summary, name) {
  return summary?.metrics?.[name]?.values || {};
}

export function projectRcd2PublicSummary(summary, lifecycleReceipt) {
  const failures = metricValues(summary, 'proof_failures');
  const checks = metricValues(summary, 'checks');
  const duration = Object.keys(metricValues(summary, 'proof_row_duration_ms')).length > 0
    ? metricValues(summary, 'proof_row_duration_ms')
    : metricValues(summary, 'r_cd_2_duration');

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

function safeSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : null;
}

const PRIVATE_IDENTIFIER_WORD = /(?:nonce|prompt|reason|session|token|trace|span|chain|delegate|rpc|provider|journal)/i;

function safeSeat(value) {
  return typeof value === 'string' &&
    /^[a-z0-9._-]{1,80}$/i.test(value) &&
    !PRIVATE_IDENTIFIER_WORD.test(value)
    ? value
    : 'unknown';
}

function safeRunId(value) {
  return typeof value === 'string' &&
    /^[a-z0-9._-]{1,100}$/i.test(value) &&
    !/^(?:[a-f0-9]{16}|[a-f0-9]{32})$/i.test(value) &&
    !PRIVATE_IDENTIFIER_WORD.test(value)
    ? value
    : 'k6-run';
}

const REQUIRED_RECEIPTS = [
  'dispatch-accepted',
  'continuation-lifecycle-correlation',
  'parent-wake-event',
  'no-channel-delivery',
  'trace-id',
];

export function projectRcd2PublicManifest({ candidateSha, seat } = {}) {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-CD-2',
    candidateSha: safeSha(candidateSha),
    seat: safeSeat(seat),
    transport: 'websocket',
    toolSurface: 'typed-tool',
    scenario: { name: 'r-cd-2-silent-wake' },
    liveRunSafety: {
      classification: 'k6-runnable',
      requiredReceipts: REQUIRED_RECEIPTS,
      foldRequiresReview: true,
    },
    review: { candidateOnly: true, foldRequiresReview: true },
    publicArtifactProjection: 'r-cd-2-authoritative-lifecycle-v1',
  };
}

export function projectRcd2PublicSeatReadiness(readiness, { candidateSha, seat } = {}) {
  const outcome = ['PASS-candidate', 'HONEST-LIMIT-candidate', 'FAIL-candidate']
    .includes(readiness?.outcome)
    ? readiness.outcome
    : 'HONEST-LIMIT-candidate';
  return {
    schema: 'openclaw.k6.r-cd-2-public-seat-readiness.v1',
    row: 'R-CD-2',
    outcome,
    candidateSha: safeSha(candidateSha || readiness?.candidate?.sha),
    seat: safeSeat(seat || readiness?.seat?.name),
    checks: {
      k6Ready: readiness?.k6?.ok === true && readiness?.k6?.matchesExpected === true,
      gatewayReady: readiness?.gateway?.healthReachable === true &&
        readiness?.gateway?.statusReachable === true,
      continuationReady: readiness?.continuation?.enabled === true &&
        readiness?.continuation?.defaultsPresent === true,
    },
    candidateOnly: true,
    foldRequiresReview: true,
  };
}

export function projectRcd2PublicRowResult({
  lifecycleReceipt,
  publicSummary,
  candidateSha,
  seat,
  runId,
  generatedAt,
}) {
  return {
    schema: 'openclaw.k6.proof-row-result.v1',
    runId: safeRunId(runId),
    generatedAt,
    rowId: 'R-CD-2',
    candidateSha: safeSha(candidateSha),
    seat: safeSeat(seat),
    scenario: 'r-cd-2-silent-wake',
    toolSurface: 'typed-tool',
    transport: 'websocket',
    outcome: lifecycleReceipt.verdict,
    ...(lifecycleReceipt.failureCategory
      ? { failureCategory: lifecycleReceipt.failureCategory }
      : {}),
    lifecycleReceipt,
    metrics: publicSummary.metrics,
    liveRunSafety: {
      classification: 'k6-runnable',
      requiredReceipts: REQUIRED_RECEIPTS,
      foldRequiresReview: true,
    },
    candidateOnly: true,
    foldRequiresReview: true,
  };
}

export function renderRcd2PublicEvidence({ result }) {
  const authority = result.outcome === 'PASS-candidate'
    ? `- Accepted dispatch turn, matching terminal success, and delayed wake/fire: bound
- Disposable session re-read as unbound: bound
- Bounded post-wake quiet window with no channel delivery: bound
- Typed continue_delegate dispatch/fire topology and silent-wake mode: bound
- Coherent trace, chain, and delegate identities: bound`
    : `- Promotion blocked: \`${result.failureCategory || 'incomplete-authoritative-evidence'}\`
- No lifecycle or topology PASS claim is made from partial evidence.`;
  return `# R-CD-2 — ${result.seat} — ${result.outcome}

> Generated from the authoritative R-CD-2 lifecycle receipt.
> Private gateway, provider, k6, journal, and trace acquisition is withheld.
> This remains candidate output and requires human review before folding.

## Candidate

- Row: \`R-CD-2\`
- Candidate SHA: \`${result.candidateSha || 'unknown'}\`
- Seat: \`${result.seat}\`
- Run ID: \`${result.runId}\`
- Generated: ${result.generatedAt}
- Outcome: **${result.outcome}**
- Failure category: \`${result.failureCategory || 'none'}\`

## Authoritative receipts

${authority}

Only one-way fingerprints are retained in \`row-result.json\`. Raw acquisition
identifiers, prompts, reasons, errors, queries, logs, traces, and summaries are
not public artifacts.
`;
}
