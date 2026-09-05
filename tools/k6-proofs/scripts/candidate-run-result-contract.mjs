import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hasVerifiedRrc2Outcome } from '../lib/request-compaction-receipt.js';
import {
  consumeRcd2Authority,
  isRcd2AuthorityRequired,
  R_CD_2_RECEIPT_FILE,
  R_CD_2_RECEIPT_SOURCE,
  R_CD_2_VERDICT_SOURCE,
} from '../lib/r-cd-2-authority-context.mjs';
import { validateRcdTokenAuthoritativeReceipt } from '../lib/r-cd-token-authoritative-receipt.mjs';

export const CANDIDATE_RUN_RESULT_SCHEMA = 'openclaw.k6.candidate-run-result.v1';
export const PROOF_ROW_MANIFEST_SCHEMA = 'openclaw.k6.proof-row-manifest.v1';

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HARNESS_MANIFEST_PATH = /^tools\/k6-proofs\/manifests\/[A-Za-z0-9._-]+\.json$/;
const HARNESS_SCENARIO_PATH = /^tools\/k6-proofs\/scenarios\/[A-Za-z0-9._-]+\.js$/;
export const COPIED_MANIFEST = 'row-manifest.json';
export const COPIED_SCENARIO = 'row-scenario.js';
const OUTCOMES = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

// The exact public-safe artifact names a candidate directory may publish. Both
// the emitter and this consumer contract use this one list.
export const SAFE_CANDIDATE_ARTIFACTS = new Set([
  COPIED_MANIFEST, COPIED_SCENARIO, 'runner-metadata.json', 'run-result.json',
  'candidate-run-result.json', 'seat-readiness.json', 'evidence.jsonl',
  'r-cd-2-authoritative-receipt.json', 'r-cd-2-selected-context-receipt.json',
  'attempt-state.json', 'build-identity-gate.json', 'interruption-receipt.json',
  'r-cd-token-authoritative-receipt.json',
  'evidence-lines.log', 'evidence-redaction.json', 'gateway-journal.log',
  'gateway-journal-capture.json', 'gateway-journal-redaction.json',
]);

export function isSafeCandidateArtifact(name) {
  // Basename only. `../../private-summary.json` must never satisfy the summary
  // pattern, and no artifact entry may traverse out of the candidate directory.
  if (typeof name !== 'string' || !name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') return false;
  return SAFE_CANDIDATE_ARTIFACTS.has(name) || /(?:^|-)summary\.json$/i.test(name);
}

// The envelope is machine-generated with a fixed shape. Refusing unknown keys
// stops a hand-edited sidecar from smuggling extra material (a token, a private
// path, raw process output) past review while every checked field still agrees.
const ENVELOPE_KEYS = {
  root: {
    required: ['schema', 'candidateOnly', 'foldRequiresReview', 'canonicalFoldForbidden', 'candidate', 'harness', 'run', 'result', 'observability', 'review', 'artifacts'],
    optional: ['authoritativeReceipt'],
  },
  candidate: { required: ['sha', 'docsRef'], optional: [] },
  harness: {
    required: ['docsRef', 'repository', 'manifestPath', 'manifestSha256', 'scenarioPath', 'scenarioSha256', 'manifestArtifact', 'scenarioArtifact'],
    optional: [],
  },
  run: { required: ['id', 'rowId', 'seat', 'scenario', 'executionKind'], optional: [] },
  result: { required: ['outcome', 'outcomeSource', 'effectiveExitCode', 'behaviorProof'], optional: [] },
  observability: { required: ['traceStatus', 'traceCaptured', 'correlationReceiptPresent'], optional: [] },
  review: { required: ['status', 'pendingReceipts', 'complete'], optional: [] },
  artifacts: {
    required: ['manifest', 'scenario', 'runnerMetadata', 'runResult', 'files', 'tempoTraceJson', 'correlationReceipt'],
    optional: [],
  },
  authoritativeReceipt: { required: ['file', 'sha256'], optional: [] },
};

function hasExactKeys(value, spec) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...spec.required, ...spec.optional]);
  if (keys.some((key) => !allowed.has(key))) return false;
  return spec.required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function envelopeShapeIsCanonical(envelope) {
  if (!hasExactKeys(envelope, ENVELOPE_KEYS.root)) return false;
  for (const section of ['candidate', 'harness', 'run', 'result', 'observability', 'review', 'artifacts']) {
    if (!hasExactKeys(envelope[section], ENVELOPE_KEYS[section])) return false;
  }
  if (Object.prototype.hasOwnProperty.call(envelope, 'authoritativeReceipt') &&
      !hasExactKeys(envelope.authoritativeReceipt, ENVELOPE_KEYS.authoritativeReceipt)) return false;
  if (envelope.run.executionKind !== 'row-list-runner') return false;
  const artifacts = envelope.artifacts;
  if (artifacts.manifest !== COPIED_MANIFEST || artifacts.scenario !== COPIED_SCENARIO) return false;
  if (artifacts.runnerMetadata !== 'runner-metadata.json' || artifacts.runResult !== 'run-result.json') return false;
  if (!Array.isArray(artifacts.files) || !artifacts.files.every(isSafeCandidateArtifact)) return false;
  for (const optional of ['tempoTraceJson', 'correlationReceipt']) {
    const value = artifacts[optional];
    if (value !== null && !isSafeArtifactReference(value)) return false;
  }
  return true;
}

// Observability artifact names are emitted straight from the raw run result, so
// they must be basename-only and must still agree with that sibling.
export function isSafeArtifactReference(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function artifactReferencesMatchRunResult(envelope, runResult) {
  const observability = runResult?.observability || {};
  const pairs = [
    [envelope.artifacts.tempoTraceJson, observability.tempoTraceJson],
    [envelope.artifacts.correlationReceipt, observability.correlationReceipt],
  ];
  return pairs.every(([declared, raw]) => (declared ?? null) === (raw ?? null));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function fileDigest(file) {
  try {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Re-verify the immutable harness identity a sidecar envelope claims (#496).
 *
 * A sidecar may only suppress its raw sibling when the run metadata records the
 * approved docs ref, the repository identity, both harness source paths, and
 * both source digests; when the envelope repeats every one of them exactly; and
 * when the copied manifest/scenario bytes still hash to those digests.
 */
function harnessIdentityMatches({ envelope, metadata, runDir }) {
  const harness = envelope?.harness;
  if (!harness) return false;
  const docsRef = nonEmptyString(metadata.docsRef);
  const repository = nonEmptyString(metadata.repository);
  const manifestPath = nonEmptyString(metadata.manifestPath);
  const scenarioPath = nonEmptyString(metadata.scenarioPath);
  const manifestSha256 = nonEmptyString(metadata.manifestSha256);
  const scenarioSha256 = nonEmptyString(metadata.scenarioSha256);
  if (!SHA.test(docsRef || '') || !REPOSITORY.test(repository || '')) return false;
  if (!HARNESS_MANIFEST_PATH.test(manifestPath || '') || !HARNESS_SCENARIO_PATH.test(scenarioPath || '')) return false;
  if (!DIGEST.test(manifestSha256 || '') || !DIGEST.test(scenarioSha256 || '')) return false;
  if (envelope.candidate?.docsRef !== docsRef) return false;
  if (harness.docsRef !== docsRef || harness.repository !== repository) return false;
  if (harness.manifestPath !== manifestPath || harness.scenarioPath !== scenarioPath) return false;
  if (harness.manifestSha256 !== manifestSha256 || harness.scenarioSha256 !== scenarioSha256) return false;
  if (harness.manifestArtifact !== COPIED_MANIFEST || harness.scenarioArtifact !== COPIED_SCENARIO) return false;
  if (fileDigest(path.join(runDir, COPIED_MANIFEST)) !== manifestSha256) return false;
  if (fileDigest(path.join(runDir, COPIED_SCENARIO)) !== scenarioSha256) return false;
  return true;
}

function scenarioName(manifest) {
  return manifest?.scenario?.name || manifest?.scenario?.file?.replace(/\.js$/, '') || null;
}

function authoritativeReceiptContract(rowId) {
  if (rowId === 'R-CD-2') {
    return {
      file: R_CD_2_RECEIPT_FILE,
      source: R_CD_2_RECEIPT_SOURCE,
      verdictSource: R_CD_2_VERDICT_SOURCE,
      validate: null,
    };
  }
  if (rowId === 'R-CD-TOKEN') {
    return {
      file: 'r-cd-token-authoritative-receipt.json',
      source: 'r-cd-token-row-scoped-resolver',
      verdictSource: 'r-cd-token-authoritative-receipt',
      validate: validateRcdTokenAuthoritativeReceipt,
    };
  }
  return null;
}

// Consumers must use this before a sidecar can replace its sibling raw result.
// It deliberately proves only candidate-review routing consistency, never a
// canonical fold or behavioral PASS.
export function candidateEnvelopeMatchesSiblings({
  envelope,
  manifest,
  metadata,
  runResult,
  runDir,
  signingKey = process.env.OPENCLAW_GATEWAY_TOKEN,
}) {
  let rCd2Authority = null;
  if (isRcd2AuthorityRequired({ runDir, envelope, manifest, metadata, runResult })) {
    try {
      rCd2Authority = consumeRcd2Authority({
        runDir,
        envelope,
        manifest,
        metadata,
        runResult,
        signingKey,
      });
    } catch {
      return false;
    }
  }
  if (!envelope || envelope.schema !== CANDIDATE_RUN_RESULT_SCHEMA) return false;
  if (!envelopeShapeIsCanonical(envelope)) return false;
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
  if (!hasVerifiedRrc2Outcome(rowId, envelope.result.outcome, runResult.evidence)) return false;
  const authoritative = authoritativeReceiptContract(rowId);
  // A row with no row-scoped resolver must not carry an authoritative receipt
  // declaration at all: that block is the sole verdict authority where it
  // applies, and it may not be introduced anywhere else.
  if (!authoritative && Object.prototype.hasOwnProperty.call(envelope, 'authoritativeReceipt')) return false;
  if (authoritative && !Object.prototype.hasOwnProperty.call(envelope, 'authoritativeReceipt')) return false;
  if (authoritative && (
    runResult.verdictSource !== authoritative.verdictSource ||
    runResult.authoritativeReceipt?.validated !== true ||
    runResult.authoritativeReceipt?.source !== authoritative.source ||
    runResult.authoritativeReceipt?.file !== authoritative.file ||
    !existsSync(path.join(runDir, authoritative.file))
  )) return false;
  if (!artifactReferencesMatchRunResult(envelope, runResult)) return false;
  if (manifest.rowId !== rowId || scenarioName(manifest) !== scenario) return false;
  if (manifest.candidateSha && manifest.candidateSha !== candidateSha) return false;
  if (envelope.candidate?.sha !== candidateSha || !SHA.test(envelope.candidate?.docsRef || '')) return false;
  if (!harnessIdentityMatches({ envelope, metadata, runDir })) return false;
  if (envelope.run?.id !== path.basename(runDir) || envelope.run?.rowId !== rowId || envelope.run?.seat !== seat || envelope.run?.scenario !== scenario) return false;
  if (envelope.result?.outcome !== runResult.verdict || envelope.result?.outcomeSource !== runResult.verdictSource) return false;
  if (authoritative) {
    const declared = runResult.authoritativeReceipt;
    if (declared?.validated !== true || declared?.source !== authoritative.source ||
        envelope.authoritativeReceipt?.file !== authoritative.file ||
        envelope.authoritativeReceipt?.sha256 !== declared?.sha256 ||
        !/^[a-f0-9]{64}$/iu.test(declared?.sha256 || '')) return false;
    try {
      if (rowId === 'R-CD-2') {
        if (!rCd2Authority ||
            rCd2Authority.outcome !== runResult.verdict ||
            rCd2Authority.authoritativeReceipt.sha256 !== declared.sha256) return false;
      } else {
        const raw = readFileSync(path.join(runDir, declared.file));
        if (createHash('sha256').update(raw).digest('hex') !== declared.sha256) return false;
        const receipt = JSON.parse(raw.toString('utf8'));
        const integrity = authoritative.validate(
          receipt,
          process.env.OPENCLAW_GATEWAY_TOKEN,
        );
        if (!integrity.valid || integrity.verdict !== runResult.verdict) return false;
        if (rowId === 'R-CD-TOKEN' && (
          receipt.binding?.candidateSha !== candidateSha ||
          receipt.binding?.runtimeBuildSha !== candidateSha ||
          metadata.runtimeBuildSha !== candidateSha
        )) return false;
      }
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
