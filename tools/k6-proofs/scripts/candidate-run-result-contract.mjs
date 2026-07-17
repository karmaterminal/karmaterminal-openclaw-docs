import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateRcd2AuthoritativeReceipt } from '../lib/r-cd-2-authoritative-receipt.mjs';

export const CANDIDATE_RUN_RESULT_SCHEMA = 'openclaw.k6.candidate-run-result.v1';
export const PROOF_ROW_MANIFEST_SCHEMA = 'openclaw.k6.proof-row-manifest.v1';

const SHA = /^[0-9a-f]{40}$/;
const OUTCOMES = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function scenarioName(manifest) {
  return manifest?.scenario?.name || manifest?.scenario?.file?.replace(/\.js$/, '') || null;
}

// Consumers must use this before a sidecar can replace its sibling raw result.
// It deliberately proves only candidate-review routing consistency, never a
// canonical fold or behavioral PASS.
export function candidateEnvelopeMatchesSiblings({ envelope, manifest, metadata, runResult, runDir }) {
  if (!envelope || envelope.schema !== CANDIDATE_RUN_RESULT_SCHEMA) return false;
  if (envelope.candidateOnly !== true || envelope.foldRequiresReview !== true || envelope.canonicalFoldForbidden !== true) return false;
  if (envelope.result?.behaviorProof !== false || !OUTCOMES.has(envelope.result?.outcome)) return false;
  if (envelope.result?.effectiveExitCode !== 0) return false;
  if (envelope.review?.status !== 'ready-for-human-review' || envelope.review?.complete !== true || !Array.isArray(envelope.review?.pendingReceipts) || envelope.review.pendingReceipts.length !== 0) return false;

  if (!manifest || manifest.schema !== PROOF_ROW_MANIFEST_SCHEMA || manifest.review?.candidateOnly !== true || manifest.review?.foldRequiresReview !== true) return false;
  if (!metadata || !runResult || runResult.candidateOnly !== true || runResult.foldRequiresReview !== true) return false;
  if (runResult.effectiveExitCode !== 0 || runResult.review?.status !== 'ready-for-human-review' || !Array.isArray(runResult.review?.pendingReceipts) || runResult.review.pendingReceipts.length !== 0) return false;

  const rowId = nonEmptyString(metadata.row);
  const candidateSha = nonEmptyString(metadata.candidateSha);
  const seat = nonEmptyString(metadata.seat);
  const scenario = nonEmptyString(metadata.scenario)?.replace(/\.js$/, '');
  if (!rowId || !candidateSha || !seat || !scenario || !SHA.test(candidateSha)) return false;
  if (rowId === 'R-CD-2' && (
    runResult.verdictSource !== 'r-cd-2-authoritative-receipt' ||
    runResult.authoritativeReceipt?.validated !== true ||
    runResult.authoritativeReceipt?.source !== 'r-cd-2-row-scoped-resolver' ||
    !existsSync(path.join(runDir, 'r-cd-2-authoritative-receipt.json'))
  )) return false;
  if (manifest.rowId !== rowId || scenarioName(manifest) !== scenario) return false;
  if (manifest.candidateSha && manifest.candidateSha !== candidateSha) return false;
  if (envelope.candidate?.sha !== candidateSha || !SHA.test(envelope.candidate?.docsRef || '')) return false;
  if (envelope.run?.id !== path.basename(runDir) || envelope.run?.rowId !== rowId || envelope.run?.seat !== seat || envelope.run?.scenario !== scenario) return false;
  if (envelope.result?.outcome !== runResult.verdict || envelope.result?.outcomeSource !== runResult.verdictSource) return false;
  if (rowId === 'R-CD-2') {
    const declared = runResult.authoritativeReceipt;
    if (declared?.validated !== true || declared?.source !== 'r-cd-2-row-scoped-resolver' ||
        envelope.authoritativeReceipt?.file !== 'r-cd-2-authoritative-receipt.json' ||
        envelope.authoritativeReceipt?.sha256 !== declared?.sha256 ||
        !/^[a-f0-9]{64}$/iu.test(declared?.sha256 || '')) return false;
    try {
      const raw = readFileSync(path.join(runDir, declared.file));
      if (createHash('sha256').update(raw).digest('hex') !== declared.sha256) return false;
      const receipt = JSON.parse(raw.toString('utf8'));
      const integrity = validateRcd2AuthoritativeReceipt(receipt, process.env.OPENCLAW_GATEWAY_TOKEN);
      if (!integrity.valid || integrity.verdict !== runResult.verdict) return false;
    } catch { return false; }
  }
  if (manifest.liveRunSafety?.expectedArtifactClass === 'construct-only' && envelope.result.outcome !== 'construct-only') return false;
  const rawObservability = runResult.observability;
  if (!rawObservability || typeof rawObservability.traceStatus !== 'string') return false;
  if (envelope.observability?.traceStatus !== rawObservability.traceStatus) return false;
  if (envelope.observability?.traceCaptured !== Boolean(rawObservability.traceId)) return false;
  if (envelope.observability?.correlationReceiptPresent !== Boolean(rawObservability.correlationReceipt)) return false;
  return true;
}
