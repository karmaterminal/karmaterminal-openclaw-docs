#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { validateRcd2AuthoritativeReceipt } from '../lib/r-cd-2-authoritative-receipt.mjs';
import {
  validateRcdChainAuthoritativeReceipt,
} from '../lib/r-cd-chained-depth-2-authoritative-receipt.mjs';
import {
  buildTelemetryBackendStatusReceipt,
  validateTelemetryBackendStatusReceipt,
} from '../lib/telemetry-backend-status.js';
import {
  telemetryPassBlockers,
  telemetryReceiptStatuses,
  telemetryRebindFrom,
} from '../lib/telemetry-rebind.js';

function usage() {
  console.error(`Usage: node tools/k6-proofs/scripts/postprocess-k6-summary.mjs \\
  --manifest tools/k6-proofs/manifests/preflight.example.json \\
  --summary /tmp/k6-summary.json \\
  [--out-root PROOFS] [--run-id k6-run-YYYYMMDDTHHMMSSZ]`);
}

function authoritativeReceiptContract(rowId) {
  if (rowId === 'R-CD-2') {
    return {
      file: 'r-cd-2-authoritative-receipt.json',
      source: 'r-cd-2-row-scoped-resolver',
      verdictSource: 'r-cd-2-authoritative-receipt',
      validate: validateRcd2AuthoritativeReceipt,
      bindsCandidate: false,
    };
  }
  if (rowId === 'R-CD-CHAINED-DEPTH-2') {
    return {
      file: 'r-cd-chained-depth-2-authoritative-receipt.json',
      source: 'r-cd-chained-depth-2-row-scoped-resolver',
      verdictSource: 'r-cd-chained-depth-2-authoritative-receipt',
      validate: validateRcdChainAuthoritativeReceipt,
      bindsCandidate: true,
    };
  }
  return null;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    out[key] = value;
    i += 1;
  }
  return out;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function requiredMetric(summary, name) {
  return summary?.metrics?.[name]?.values || null;
}

function scenarioFromManifest(manifest) {
  return manifest?.scenario?.name || manifest?.scenario?.file?.replace(/\.js$/, '') || manifest?.scenario?.expectedFile?.replace(/\.js$/, '') || null;
}

function durationMsFromSummary(summary, rowId) {
  const candidates = [
    'proof_row_duration_ms',
    `${String(rowId || '').toLowerCase().replaceAll('-', '_')}_duration`,
    'r_cd_1_duration',
    'r_cd_token_duration',
  ];
  for (const name of candidates) {
    const values = requiredMetric(summary, name);
    if (values) return Number(values.avg ?? values.med ?? values.max ?? 0);
  }
  return null;
}

function failureClassFrom({
  outcome,
  failureCount,
  checkRate,
  receipts,
  summary,
  telemetryBlockers,
}) {
  const statusText = JSON.stringify(summary?.root_group || {}) + JSON.stringify(summary?.errors || {});
  if (/timeout|timed out/i.test(statusText)) return 'timeout';
  if (/auth|unauthorized|forbidden|token/i.test(statusText)) return 'auth';
  if (/transport|websocket|network|ECONNREFUSED|connection/i.test(statusText)) return 'transport';
  if (/redaction/i.test(statusText)) return 'redaction-gate';
  if (receipts.some((r) => r.required && r.status === 'missing')) return 'missing-receipt';
  if (telemetryBlockers.length > 0) return telemetryBlockers[0].failureClass;
  if (failureCount > 0) return 'threshold';
  if (checkRate !== null && checkRate < 1) return 'checks';
  if (outcome === 'FAIL-candidate') return 'postprocess';
  return 'none';
}

function receiptStatusFromName(name, summary) {
  const summaryText = JSON.stringify(summary);
  const receiptStatuses = summary?.proof_receipts || summary?.receipts || {};
  if (Object.prototype.hasOwnProperty.call(receiptStatuses, name)) {
    const value = receiptStatuses[name];
    if (value === true || value === 'present') return 'present';
    if (value === false || value === 'missing') return 'missing';
    if (value === 'unknown') return 'unknown';
  }
  switch (name) {
    case 'tool-invoke-accepted':
      return summaryText.includes('tool invocation accepted') || summaryText.includes('tools.invoke accepted') ? 'present' : 'unknown';
    case 'task-ledger-entry':
      return summaryText.includes('delegate task created') || summaryText.includes('Task found with nonce correlation') ? 'present' : 'unknown';
    case 'parent-return-event':
      return summaryText.includes('Delegate return/completion event observed') ? 'present' : 'unknown';
    default:
      return 'unknown';
  }
}

function verifiedRrc2ThresholdEvidence(evidence) {
  return evidence?.row === 'R-RC-2' &&
    evidence.parent_dispatch_accepted === true &&
    evidence.delegate_requested === true &&
    evidence.child_session_observed === true &&
    evidence.delegate_child_report_observed === true &&
    evidence.child_reported_context_threshold === true &&
    evidence.request_compaction_tool_result_observed === true &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'rejected' &&
    evidence.request_compaction_invocation_bound === true &&
    evidence.request_compaction_rejected_context_threshold === true &&
    evidence.guard === 'context_threshold';
}

function verifiedRrc2AcceptedEvidence(evidence) {
  return evidence?.row === 'R-RC-2' &&
    evidence.parent_dispatch_accepted === true &&
    evidence.delegate_requested === true &&
    evidence.child_session_observed === true &&
    evidence.delegate_child_report_observed === true &&
    evidence.post_compaction_path_observed === true &&
    evidence.request_compaction_tool_result_observed === true &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'accepted' &&
    evidence.request_compaction_invocation_bound === true &&
    evidence.request_compaction_accepted === true;
}

function outcomeFromSummary(summary, expectedArtifactClass, rowId) {
  // Some rows deliberately validate only a static contract.  A green k6
  // summary must not upgrade that contract into a candidate behavioral PASS.
  if (expectedArtifactClass === 'construct-only') return 'construct-only';
  if (rowId === 'R-RC-2') {
    if (verifiedRrc2AcceptedEvidence(summary?.evidence)) return 'PASS-candidate';
    if (verifiedRrc2ThresholdEvidence(summary?.evidence)) return 'HONEST-LIMIT-candidate';
    return 'PARTIAL-candidate';
  }
  if (summary?.verdict === 'FAIL-candidate') return 'FAIL-candidate';
  if (
    summary?.verdict === 'PARTIAL-candidate' ||
    summary?.verdict === 'HONEST-LIMIT-candidate'
  ) return 'PARTIAL-candidate';

  const failures = requiredMetric(summary, 'proof_failures');
  const failureCount = failures ? Number(failures.count || 0) : 0;
  const checks = requiredMetric(summary, 'checks');
  const checkRate = checks ? Number(checks.rate ?? 0) : null;

  if (failureCount > 0) return 'FAIL-candidate';
  if (checkRate !== null && checkRate < 1) return 'PARTIAL-candidate';
  if (expectedArtifactClass === 'PARTIAL-candidate') return 'PARTIAL-candidate';
  return 'PASS-candidate';
}

function evidenceDraft({ manifest, summary, result }) {
  const receipts = (manifest.expectedReceipts || [])
    .map((r) => `- [${r.required ? 'required' : 'optional'}] ${r.name}${r.pathHint ? ` → \`${r.pathHint}\`` : ''}${r.description ? ` — ${r.description}` : ''}`)
    .join('\n');

  return `# ${manifest.rowId} — ${manifest.seat} — ${result.outcome}

> Generated by \`tools/k6-proofs/scripts/postprocess-k6-summary.mjs\`. This is **candidate output**, not a folded proof verdict. Human review is required before copying anything into canonical \`EVIDENCE.md\` or corpus manifests.

## Row

- Row: \`${manifest.rowId}\`
- Candidate SHA: \`${manifest.candidateSha}\`
- Seat: \`${manifest.seat}\`
- Transport: \`${manifest.transport}\`
- Tool surface: \`${manifest.toolSurface}\`
- Mutates: \`${manifest.mutates}\`
- Run id: \`${result.runId}\`
- Generated: ${result.generatedAt}

## Candidate outcome

${result.outcome}

Reason: ${result.reason}

## Expected receipts

${receipts}

## Raw artifacts in this run directory

- \`row-manifest.json\` — exact manifest used.
- \`k6-summary.json\` — raw k6 summary/export.
- \`row-result.json\` — normalized post-processor result.
- \`artifacts/\` — optional copied receipts (gateway events, tool responses, task ledger, logs, Tempo trace JSON).

## Review checklist

- [ ] Confirm no secrets appear in raw summary/events/logs.
- [ ] Confirm every required receipt is present and byte-readable.
- [ ] Confirm continuation-tool fires include Tempo trace JSON before marking any PASS.
- [ ] Confirm row semantics against the current proof runbook.
- [ ] Only then fold into canonical \`PROOFS/<sha>/<row>/<seat>/EVIDENCE.md\` and manifests.
`;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    usage();
    throw error;
  }

  if (!args.manifest || !args.summary) {
    usage();
    process.exitCode = 2;
    return;
  }

  const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
  const summary = JSON.parse(await readFile(args.summary, 'utf8'));

  if (manifest.schema !== 'openclaw.k6.proof-row-manifest.v1') {
    throw new Error(`unsupported manifest schema: ${manifest.schema}`);
  }
  if (manifest.review?.candidateOnly !== true || manifest.review?.foldRequiresReview !== true) {
    throw new Error('manifest must declare candidateOnly=true and foldRequiresReview=true');
  }
  if (manifest.liveRunSafety && manifest.liveRunSafety.foldRequiresReview !== true) {
    throw new Error('manifest liveRunSafety must declare foldRequiresReview=true');
  }

  const dest = manifest.artifactDestination || {};
  const outRoot = args['out-root'] || dest.root || 'PROOFS';
  const sha = dest.sha || manifest.candidateSha;
  const row = dest.row || manifest.rowId;
  const seat = dest.seat || manifest.seat;
  const runId = args['run-id'] || `${dest.runDirPrefix || 'k6-run'}-${stamp()}`;
  const runDir = path.join(outRoot, sha, row, seat, runId);

  const expectedArtifactClass = manifest.liveRunSafety?.expectedArtifactClass;
  let outcome = outcomeFromSummary(summary, expectedArtifactClass, manifest.rowId);
  let verdictSource = 'k6-summary';
  let authoritativeReceiptDigest = null;
  let authoritativeReceiptRaw = null;
  let authoritativeReceipt = null;
  const receiptContract = authoritativeReceiptContract(manifest.rowId);
  if (receiptContract) {
    if (!args['authoritative-receipt']) {
      throw new Error(`${manifest.rowId} requires --authoritative-receipt`);
    }
    authoritativeReceiptRaw = readFileSync(args['authoritative-receipt']);
    const receipt = JSON.parse(authoritativeReceiptRaw.toString('utf8'));
    const validation = receiptContract.validate(
      receipt,
      process.env.OPENCLAW_GATEWAY_TOKEN,
    );
    if (!validation.valid) {
      throw new Error(
        `${manifest.rowId} authoritative receipt rejected: ${validation.reason}`,
      );
    }
    if (receiptContract.bindsCandidate && (
      receipt.binding?.candidateSha !== manifest.candidateSha ||
      receipt.binding?.runtimeBuildSha !== manifest.candidateSha
    )) {
      throw new Error(
        `${manifest.rowId} authoritative receipt candidate identity mismatch`,
      );
    }
    outcome = receipt.verdict;
    verdictSource = receiptContract.verdictSource;
    authoritativeReceiptDigest = createHash('sha256').update(authoritativeReceiptRaw).digest('hex');
    authoritativeReceipt = {
      schema: receipt.schema,
      validated: true,
      source: receiptContract.source,
    };
  }
  const failures = requiredMetric(summary, 'proof_failures');
  const failureCount = failures ? Number(failures.count || 0) : 0;
  const checks = requiredMetric(summary, 'checks');
  const checkRate = checks ? Number(checks.rate ?? 0) : null;
  let receipts = (manifest.expectedReceipts || []).map((r) => ({
    name: r.name,
    required: Boolean(r.required),
    status: receiptStatusFromName(r.name, summary),
  }));
  let backendStatus = null;
  let telemetryRebind = null;
  if (manifest.telemetryContract) {
    if (args['backend-status']) {
      backendStatus = JSON.parse(readFileSync(args['backend-status'], 'utf8'));
      const expectedBackend = {
        rowId: manifest.rowId,
        requiredCompletenessKeys:
          manifest.telemetryContract.backendUnavailable.requiredCompletenessKeys,
        rebindKeys: manifest.telemetryContract.backendUnavailable.rebindKeys,
        ...(manifest.telemetryContract.verdictAuthority?.passScope ===
          'backend-disposition-contract'
          ? {
              candidateSha: /^[a-f0-9]{40}$/u.test(manifest.candidateSha || '')
                ? manifest.candidateSha
                : null,
              seat: manifest.seat,
              proofRunId: runId,
            }
          : {}),
      };
      const validation = validateTelemetryBackendStatusReceipt(
        backendStatus,
        expectedBackend,
      );
      if (!validation.valid) {
        throw new Error(
          `backend-status receipt rejected: ${validation.failures.join('; ')}`,
        );
      }
    } else {
      const backendContract = manifest.telemetryContract.backendUnavailable;
      backendStatus = buildTelemetryBackendStatusReceipt({
        rowId: manifest.rowId,
        candidateSha: /^[a-f0-9]{40}$/u.test(manifest.candidateSha || '')
          ? manifest.candidateSha
          : null,
        seat: manifest.seat,
        proofRunId: runId,
        interactions: [],
        requiredCompletenessKeys: backendContract.requiredCompletenessKeys,
        rebindKeys: backendContract.rebindKeys,
        rebindValues: {
          candidate_sha: manifest.candidateSha,
          row_id: manifest.rowId,
          seat: manifest.seat,
          run_id: runId,
          proof_run_id: runId,
        },
      });
    }
    const plannedArtifacts = new Set([
      'EVIDENCE.md',
      'row-result.json',
      'k6-summary.json',
      'backend-status.json',
      ...(authoritativeReceiptRaw ? [receiptContract.file] : []),
      ...(args['seat-readiness'] ? ['seat-readiness.json'] : []),
    ]);
    const artifactStatuses =
      (manifest.telemetryContract.artifact?.requiredFiles || []).map((name) => ({
        name,
        status: plannedArtifacts.has(name) ? 'present' : 'missing',
      }));
    receipts = telemetryReceiptStatuses({
      manifest,
      summary,
      backendStatus,
      fallback: receipts,
    });
    telemetryRebind = telemetryRebindFrom({
      manifest,
      receiptStatuses: receipts,
      backendStatus,
      artifactStatuses,
    });
  }

  // A summary-derived PASS may not outrun its own receipts. A row that declares
  // an authoritative signed receipt keeps that receipt as its sole authority and
  // is not re-judged here.
  const summaryDerivedVerdict = verdictSource === 'k6-summary';
  // A receipt is required when either list says so. `liveRunSafety.requiredReceipts`
  // is the live-run required set and `expectedReceipts[].required` is what this
  // post-processor grades; a row must not be gradeable as optional on a receipt
  // its own live-run policy calls required.
  const liveRequiredReceipts = new Set(manifest.liveRunSafety?.requiredReceipts || []);
  const missingRequiredReceipts = receipts
    .filter((receipt) => (receipt.required || liveRequiredReceipts.has(receipt.name)) && receipt.status === 'missing')
    .map((receipt) => receipt.name);
  const downgradeReasons = [];
  if (summaryDerivedVerdict && outcome === 'PASS-candidate' && missingRequiredReceipts.length) {
    downgradeReasons.push(`required receipt(s) reported missing: ${missingRequiredReceipts.join(', ')}`);
  }
  const telemetryBlockers = outcome === 'PASS-candidate'
    ? telemetryPassBlockers(telemetryRebind)
    : [];
  downgradeReasons.push(...telemetryBlockers.map((entry) => entry.reason));
  if (downgradeReasons.length) {
    outcome = 'PARTIAL-candidate';
    if (telemetryBlockers.length > 0) {
      verdictSource = `${verdictSource}+telemetry-disposition-policy`;
    }
  }

  const failureClass = failureClassFrom({
    outcome,
    failureCount,
    checkRate,
    receipts,
    summary,
    telemetryBlockers,
  });
  const result = {
    schema: 'openclaw.k6.proof-row-result.v1',
    runId,
    generatedAt: new Date().toISOString(),
    rowId: manifest.rowId,
    candidateSha: manifest.candidateSha,
    seat: manifest.seat,
    scenario: scenarioFromManifest(manifest),
    toolSurface: manifest.toolSurface,
    transport: manifest.transport,
    outcome,
    verdictSource,
    ...(authoritativeReceiptDigest ? {
      authoritativeReceipt: {
        ...authoritativeReceipt,
        file: receiptContract.file,
        sha256: authoritativeReceiptDigest,
      },
    } : {}),
    metrics: {
      proofFailures: failureCount,
      checksRate: checkRate,
      durationMs: durationMsFromSummary(summary, manifest.rowId),
    },
    receipts,
    ...(telemetryRebind ? { telemetryRebind } : {}),
    ...(backendStatus ? {
      observability: {
        backendStatus: 'backend-status.json',
        backendDisposition: backendStatus.status,
        backendComplete: backendStatus.complete,
        backendCountAuthority: backendStatus.countAuthority,
        dispositionContractStatus:
          telemetryRebind.dispositionContract
            ? telemetryRebind.status
            : 'not-applicable',
      },
    } : {}),
    liveRunSafety: manifest.liveRunSafety ? {
      classification: manifest.liveRunSafety.classification,
      requiresLiveGatewayToken: Boolean(manifest.liveRunSafety.requiresLiveGatewayToken),
      requiresTargetSessionKey: Boolean(manifest.liveRunSafety.requiresTargetSessionKey),
      requiresCandidateSha: Boolean(manifest.liveRunSafety.requiresCandidateSha),
      requiresExternalAgentOrToolInvocation: Boolean(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation),
      sameSessionConcurrencySafe: Boolean(manifest.liveRunSafety.sameSessionConcurrencySafe),
      expectedArtifactClass: manifest.liveRunSafety.expectedArtifactClass,
      requiredReceipts: manifest.liveRunSafety.requiredReceipts || [],
      foldRequiresReview: manifest.liveRunSafety.foldRequiresReview === true,
    } : null,
    failureClass,
    reason: downgradeReasons.length
      ? `withheld from PASS-candidate: ${downgradeReasons.join('; ')}`
      : outcome === 'construct-only'
      ? 'manifest caps this row at construct-only; it is not behavioral candidate evidence'
      : outcome === 'FAIL-candidate'
      ? 'k6 proof_failures metric is non-zero'
      : outcome === 'PARTIAL-candidate'
        ? 'k6 checks or required receipts did not all pass; preserve as proof debt'
        : 'k6 checks passed and proof_failures is zero; receipts still need human review',
    candidateOnly: true,
    foldRequiresReview: true,
  };

  await mkdir(path.join(runDir, 'artifacts'), { recursive: true });
  await writeFile(path.join(runDir, 'row-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(runDir, 'k6-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  await writeFile(path.join(runDir, 'row-result.json'), JSON.stringify(result, null, 2) + '\n');
  if (backendStatus) {
    await writeFile(
      path.join(runDir, 'backend-status.json'),
      `${JSON.stringify(backendStatus, null, 2)}\n`,
    );
  }
  if (authoritativeReceiptRaw) {
    await writeFile(path.join(runDir, receiptContract.file), authoritativeReceiptRaw);
  }
  if (args['seat-readiness']) {
    await copyFile(args['seat-readiness'], path.join(runDir, 'seat-readiness.json'));
  }
  await writeFile(path.join(runDir, 'EVIDENCE.md'), evidenceDraft({ manifest, summary, result }));

  console.log(JSON.stringify({ runDir, outcome, rowId: manifest.rowId, candidateOnly: true }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
