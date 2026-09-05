import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import {
  rCd2AuthorityIdentity,
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AcquisitionReceipt,
  validateRcd2AuthoritativeReceipt,
} from './r-cd-2-authoritative-receipt.mjs';
import {
  GATEWAY_HMAC_RECEIPT_ALGORITHM,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';
import { validateReadinessReceipt } from '../scripts/target-readiness.mjs';

export const R_CD_2_ROW = 'R-CD-2';
export const R_CD_2_RECEIPT_FILE = 'r-cd-2-authoritative-receipt.json';
export const R_CD_2_SELECTION_RECEIPT_FILE = 'r-cd-2-selected-context-receipt.json';
export const R_CD_2_SELECTION_RECEIPT_SCHEMA =
  'openclaw.k6.r-cd-2-selected-context-receipt.v1';
export const R_CD_2_RECEIPT_SOURCE = 'r-cd-2-row-scoped-resolver';
export const R_CD_2_VERDICT_SOURCE = 'r-cd-2-authoritative-receipt';

const SHA = /^[0-9a-f]{40}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]+$/u;
const MANIFEST_PATH = /^tools\/k6-proofs\/manifests\/[A-Za-z0-9._-]+\.json$/u;
const SCENARIO_PATH = /^tools\/k6-proofs\/scenarios\/[A-Za-z0-9._-]+\.js$/u;
const MATRIX_NONCE = /(?:^|-)([0-9a-f]{8})$/iu;
const SELECTION_KEYS = [
  'candidateOnly',
  'canonicalFoldForbidden',
  'foldRequiresReview',
  'identity',
  'integrity',
  'row',
  'schema',
];
const IDENTITY_KEYS = [
  'candidateSha',
  'docsRef',
  'harness',
  'matrixId',
  'repository',
  'row',
  'runId',
  'runtimeBuildSha',
  'scenario',
  'schema',
  'seat',
];
const HARNESS_IDENTITY_KEYS = [
  'manifestPath',
  'manifestSha256',
  'scenarioPath',
  'scenarioSha256',
];
const INTEGRITY_KEYS = ['algorithm', 'signature'];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exactKeys = (value, expected) =>
  value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');

function readJson(file, label, { optional = false } = {}) {
  if (optional && !existsSync(file)) return null;
  let raw;
  try {
    raw = readFileSync(file);
  } catch (error) {
    throw new Error(`R-CD-2 ${label} missing or unreadable: ${error.message}`);
  }
  try {
    return { value: JSON.parse(raw.toString('utf8')), raw };
  } catch (error) {
    throw new Error(`R-CD-2 ${label} is malformed JSON: ${error.message}`);
  }
}

function same(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `R-CD-2 authority identity mismatch for ${label}: ` +
      `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
    );
  }
}

function selectionCanonical(receipt) {
  return canonicalJson({
    schema: receipt?.schema,
    row: receipt?.row,
    candidateOnly: receipt?.candidateOnly,
    foldRequiresReview: receipt?.foldRequiresReview,
    canonicalFoldForbidden: receipt?.canonicalFoldForbidden,
    identity: receipt?.identity,
  });
}

function normalizedIdentity(identity) {
  return rCd2AuthorityIdentity({
    candidateSha: identity?.candidateSha,
    runtimeBuildSha: identity?.runtimeBuildSha,
    docsRef: identity?.docsRef,
    repository: identity?.repository,
    seat: identity?.seat,
    matrixId: identity?.matrixId,
    row: identity?.row,
    scenario: identity?.scenario,
    manifestPath: identity?.harness?.manifestPath,
    manifestSha256: identity?.harness?.manifestSha256,
    scenarioPath: identity?.harness?.scenarioPath,
    scenarioSha256: identity?.harness?.scenarioSha256,
  }, identity?.runId);
}

function selectionIdentityIsCanonical(identity) {
  try {
    const normalized = normalizedIdentity(identity);
    return exactKeys(identity, IDENTITY_KEYS) &&
      exactKeys(identity.harness, HARNESS_IDENTITY_KEYS) &&
      canonicalJson(identity) === canonicalJson(normalized) &&
      identity.candidateSha === identity.runtimeBuildSha;
  } catch {
    return false;
  }
}

export function signRcd2SelectedContextReceipt({
  identity,
  signingKey = process.env.OPENCLAW_GATEWAY_TOKEN,
} = {}) {
  const normalized = normalizedIdentity(identity);
  if (!selectionIdentityIsCanonical(normalized)) {
    throw new Error('R-CD-2 selected context identity is invalid');
  }
  return sealSignedObserverReceipt({
    receipt: {
      schema: R_CD_2_SELECTION_RECEIPT_SCHEMA,
      row: R_CD_2_ROW,
      candidateOnly: true,
      foldRequiresReview: true,
      canonicalFoldForbidden: true,
      identity: normalized,
    },
    signingKey,
    canonicalize: selectionCanonical,
  });
}

export function validateRcd2SelectedContextReceipt(
  receipt,
  signingKey = process.env.OPENCLAW_GATEWAY_TOKEN,
  expectedIdentity,
) {
  if (
    !exactKeys(receipt, SELECTION_KEYS) ||
    receipt.schema !== R_CD_2_SELECTION_RECEIPT_SCHEMA ||
    receipt.row !== R_CD_2_ROW ||
    receipt.candidateOnly !== true ||
    receipt.foldRequiresReview !== true ||
    receipt.canonicalFoldForbidden !== true ||
    !selectionIdentityIsCanonical(receipt.identity) ||
    !exactKeys(receipt.integrity, INTEGRITY_KEYS) ||
    receipt.integrity.algorithm !== GATEWAY_HMAC_RECEIPT_ALGORITHM ||
    !DIGEST.test(receipt.integrity.signature || '')
  ) {
    return { valid: false, reason: 'invalid-shape' };
  }
  if (expectedIdentity !== undefined) {
    let normalized;
    try {
      normalized = normalizedIdentity(expectedIdentity);
    } catch {
      return { valid: false, reason: 'invalid-expected-identity' };
    }
    if (
      !selectionIdentityIsCanonical(normalized) ||
      canonicalJson(receipt.identity) !== canonicalJson(normalized)
    ) {
      return { valid: false, reason: 'identity-mismatch' };
    }
  }
  if (!validateSignedObserverReceiptIntegrity({
    receipt,
    signingKey,
    canonicalize: selectionCanonical,
  })) {
    return { valid: false, reason: 'invalid-integrity' };
  }
  return { valid: true, identity: normalizedIdentity(receipt.identity) };
}

function required(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`R-CD-2 selected authority context has invalid ${label}`);
  }
  return value;
}

function scenarioFile(value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  return value.endsWith('.js') ? value : `${value}.js`;
}

function portablePath(value) {
  return typeof value === 'string' ? value.replaceAll('\\', '/') : value;
}

function claim(value, expected, label, normalize = (entry) => entry) {
  if (value === undefined || value === null) return;
  same(normalize(value), normalize(expected), label);
}

function resolveString(value, selected) {
  if (typeof value !== 'string') return value;
  const supported = {
    OPENCLAW_CANDIDATE_SHA: selected.candidateSha,
    OPENCLAW_RUNTIME_BUILD_SHA: selected.runtimeBuildSha,
    OPENCLAW_PROOFS_DOCS_REF: selected.docsRef,
    OPENCLAW_PROOFS_REPOSITORY: selected.repository,
    OPENCLAW_SEAT_NAME: selected.seat,
    OPENCLAW_PROOFS_MATRIX_ID: selected.matrixId,
    OPENCLAW_PROOF_RUN_ID: selected.runId,
  };
  return value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/gu, (whole, name, fallback) => {
    if (Object.prototype.hasOwnProperty.call(supported, name)) return supported[name];
    return fallback === undefined ? whole : fallback;
  });
}

export function resolveRcd2ManifestPlaceholders(value, selected) {
  if (typeof value === 'string') return resolveString(value, selected);
  if (Array.isArray(value)) {
    return value.map((entry) => resolveRcd2ManifestPlaceholders(entry, selected));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolveRcd2ManifestPlaceholders(entry, selected),
      ]),
    );
  }
  return value;
}

function pathClaims(root, runDir) {
  const relative = portablePath(path.relative(root, runDir));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('R-CD-2 run directory is outside the explicit authority root');
  }
  const parts = relative.split('/');
  if (parts[0] === 'PROOFS') parts.shift();
  if (parts.length !== 4 || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(
      'R-CD-2 run directory must be <candidate>/<row>/<seat>/<run> relative to the explicit root',
    );
  }
  const [candidateSha, row, seat, runId] = parts;
  required(candidateSha, SHA, 'candidate path component');
  same(row, R_CD_2_ROW, 'row path component');
  required(seat, PUBLIC_ID, 'seat path component');
  required(runId, PUBLIC_ID, 'run path component');
  const nonce = runId.match(MATRIX_NONCE)?.[1]?.toLowerCase();
  if (!nonce) {
    throw new Error('R-CD-2 run path does not carry the selected matrix nonce');
  }
  return { candidateSha, row, seat, runId, matrixNonce: nonce };
}

export function rCd2AuthorityRootForRunDir(runDir) {
  let root = path.resolve(runDir);
  for (let index = 0; index < 4; index += 1) root = path.dirname(root);
  if (existsSync(path.join(root, 'harness-provenance'))) return root;
  const parent = path.dirname(root);
  return path.basename(root) === 'PROOFS' &&
    existsSync(path.join(parent, 'harness-provenance'))
    ? parent
    : root;
}

function selectArchivedProvenance(root, selectedMatrixId) {
  const archiveDir = path.join(root, 'harness-provenance');
  const file = path.join(archiveDir, `${selectedMatrixId}.json`);
  return { ...readJson(file, 'archived matrix provenance'), file };
}

function validateReadiness(readiness, selected, label, signingKey) {
  if (
    !readiness ||
    typeof readiness !== 'object' ||
    Array.isArray(readiness) ||
    readiness.schema !== 'openclaw.k6.seat-readiness.v2' ||
    readiness.outcome !== 'PASS-candidate' ||
    !readiness.candidate ||
    typeof readiness.candidate !== 'object' ||
    Array.isArray(readiness.candidate) ||
    readiness.candidate.valid40Hex !== true ||
    !readiness.seat ||
    typeof readiness.seat !== 'object' ||
    Array.isArray(readiness.seat) ||
    readiness.target?.authentication?.authenticated !== true ||
    readiness.target?.authentication?.request?.client?.id !== 'cli' ||
    readiness.target?.authentication?.request?.method !== 'config.get' ||
    !DIGEST.test(readiness.bindingDigest || '') ||
    !DIGEST.test(readiness.integrity?.signature || '') ||
    readiness.bindings?.runtimeSha !== selected.runtimeBuildSha ||
    readiness.bindings?.docsSha !== selected.docsRef ||
    readiness.bindings?.seat !== selected.seat ||
    !Array.isArray(readiness.bindings?.selectedRows) ||
    !readiness.bindings.selectedRows.includes(selected.row)
  ) {
    throw new Error(`R-CD-2 ${label} has invalid schema or outcome`);
  }
  same(readiness.candidate.sha, selected.candidateSha, `${label} candidate`);
  same(readiness.seat.name, selected.seat, `${label} seat`);
  const integrity = validateReadinessReceipt(readiness, {
    signingKey,
    candidateSha: selected.candidateSha,
    runtimeSha: selected.runtimeBuildSha,
    docsSha: selected.docsRef,
    gatewayFingerprint: readiness.bindings.gatewayUrlFingerprint,
    seat: selected.seat,
    unit: readiness.bindings.unit,
    rows: readiness.bindings.selectedRows,
    requiredDepth: readiness.bindings.requiredMaxSpawnDepth,
    expectedDepth: readiness.bindings.expectedMaxSpawnDepth,
  });
  if (!integrity.valid) {
    throw new Error(`R-CD-2 ${label} failed integrity validation: ${integrity.reason}`);
  }
}

function reconcileArchivedProvenance({
  root,
  runDir,
  provenance,
  selected,
  pathIdentity,
  manifestRaw,
  scenarioRaw,
  signingKey,
}) {
  if (
    provenance?.schema !== 'openclaw.k6.harness-provenance.v1' ||
    provenance?.classification !== 'harness-provenance' ||
    provenance?.harnessIdentityVerified !== true ||
    provenance?.mode !== 'live' ||
    provenance?.docsRefSource !== 'approved-input' ||
    provenance?.candidateOnly !== true ||
    provenance?.foldRequiresReview !== true
  ) {
    throw new Error('R-CD-2 selected archived matrix provenance is not an approved live context');
  }
  const candidateSha = required(provenance.candidateSha, SHA, 'archived candidate SHA');
  const runtimeBuildSha = required(
    provenance.runtimeIdentity?.runtimeBuildSha,
    SHA,
    'archived runtime build SHA',
  );
  same(candidateSha, selected.candidateSha, 'archived candidate');
  same(runtimeBuildSha, selected.runtimeBuildSha, 'archived runtime');
  same(candidateSha, runtimeBuildSha, 'candidate/runtime exact equality');
  same(provenance.runtimeIdentity?.candidateMatchesRuntime, true, 'runtime equality policy');
  same(required(provenance.docsRef, SHA, 'archived docs ref'), selected.docsRef, 'archived docs ref');
  same(
    required(provenance.repository, REPOSITORY, 'archived repository'),
    selected.repository,
    'archived repository',
  );
  const seat = required(provenance.runtimeIdentity?.seat, PUBLIC_ID, 'archived seat');
  same(seat, selected.seat, 'archived seat');
  same(
    provenance.runtimeIdentity?.seatReadinessReceipt,
    'seat-readiness.json',
    'runtime policy receipt',
  );
  const seatReadinessSha256 = required(
    provenance.runtimeIdentity?.seatReadinessSha256,
    DIGEST,
    'runtime policy receipt digest',
  );
  const copiedReadiness = readJson(path.join(runDir, 'seat-readiness.json'), 'copied seat readiness');
  same(sha256(copiedReadiness.raw), seatReadinessSha256, 'copied runtime policy receipt digest');
  validateReadiness(copiedReadiness.value, selected, 'copied seat readiness', signingKey);
  const matrixId = required(provenance.matrixId, PUBLIC_ID, 'archived matrix ID');
  same(matrixId, selected.matrixId, 'archived matrix');
  same(selected.candidateSha, pathIdentity.candidateSha, 'candidate path');
  same(selected.seat, pathIdentity.seat, 'seat path');
  same(selected.runId, pathIdentity.runId, 'run path');
  same(selected.row, pathIdentity.row, 'row path');
  if (!selected.matrixId.toLowerCase().endsWith(`-${pathIdentity.matrixNonce}`)) {
    throw new Error('R-CD-2 selected matrix does not own the run directory nonce');
  }
  if (
    !Array.isArray(provenance.rowSelection) ||
    !provenance.rowSelection.includes(R_CD_2_ROW)
  ) {
    throw new Error('R-CD-2 is absent from the selected archived matrix');
  }
  const rows = Array.isArray(provenance.rows)
    ? provenance.rows.filter((row) => row?.rowId === R_CD_2_ROW)
    : [];
  if (rows.length !== 1) {
    throw new Error(`R-CD-2 selected matrix must contain one row source record (found ${rows.length})`);
  }
  const source = rows[0];
  same(
    required(source.manifestPath, MANIFEST_PATH, 'archived manifest source path'),
    selected.manifestPath,
    'archived manifest source path',
  );
  same(
    required(source.manifestSha256, DIGEST, 'archived manifest source digest'),
    selected.manifestSha256,
    'archived manifest source digest',
  );
  same(
    required(source.scenarioPath, SCENARIO_PATH, 'archived scenario source path'),
    selected.scenarioPath,
    'archived scenario source path',
  );
  same(
    required(source.scenarioSha256, DIGEST, 'archived scenario source digest'),
    selected.scenarioSha256,
    'archived scenario source digest',
  );
  same(sha256(manifestRaw), selected.manifestSha256, 'captured manifest source digest');
  same(sha256(scenarioRaw), selected.scenarioSha256, 'captured scenario source digest');
}

function reconcileManifest(manifest, selected) {
  const resolved = resolveRcd2ManifestPlaceholders(manifest, selected);
  same(resolved?.schema, 'openclaw.k6.proof-row-manifest.v1', 'manifest schema');
  same(resolved?.rowId, selected.row, 'manifest row');
  claim(resolved?.candidateSha, selected.candidateSha, 'manifest candidate');
  claim(resolved?.seat, selected.seat, 'manifest seat');
  claim(resolved?.scenario?.file, selected.scenario, 'manifest scenario file', scenarioFile);
  claim(resolved?.scenario?.name, selected.scenario, 'manifest scenario name', scenarioFile);
  same(resolved?.invocation?.tool, 'continue_delegate', 'manifest invocation tool');
  same(resolved?.invocation?.mode, 'silent-wake', 'manifest invocation mode');
  if (resolved?.review?.candidateOnly !== true || resolved?.review?.foldRequiresReview !== true) {
    throw new Error('R-CD-2 manifest must remain candidate-only and review-required');
  }
  if (resolved?.liveRunSafety?.foldRequiresReview !== true) {
    throw new Error('R-CD-2 manifest live-run safety must remain review-required');
  }
  const destination = resolved?.artifactDestination;
  if (destination) {
    claim(destination.sha, selected.candidateSha, 'manifest artifact candidate');
    claim(destination.row, selected.row, 'manifest artifact row');
    claim(destination.seat, selected.seat, 'manifest artifact seat');
  }
  return resolved;
}

function reconcileMetadata(metadata, selected) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('R-CD-2 runner metadata is required');
  }
  for (const key of [
    'candidateSha', 'runtimeBuildSha', 'docsRef', 'repository', 'seat',
    'matrixId', 'runId', 'row', 'manifestPath', 'manifestSha256',
    'scenarioPath', 'scenarioSha256',
  ]) {
    same(metadata[key], selected[key], `runner metadata ${key}`);
  }
  same(scenarioFile(metadata.scenario), selected.scenario, 'runner metadata scenario');
}

function reconcileReview(review, label, { complete = false, outcome } = {}) {
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    throw new Error(`R-CD-2 ${label} review state is required`);
  }
  if (!Array.isArray(review.pendingReceipts)) {
    throw new Error(`R-CD-2 ${label} pending receipts must be an array`);
  }
  const ready = review.status === 'ready-for-human-review' &&
    review.pendingReceipts.length === 0;
  const pending = outcome !== 'PASS-candidate' &&
    review.status === 'review-pending' &&
    review.pendingReceipts.length > 0;
  if (!ready && !pending) {
    throw new Error(`R-CD-2 ${label} must remain ready for explicit human review`);
  }
  if (complete && review.complete !== true) {
    throw new Error(`R-CD-2 ${label} review completion marker is invalid`);
  }
}

function reconcileAuthorityPolicy({ manifest, runResult, envelope, rowResult, outcome }) {
  if (
    manifest?.review?.candidateOnly !== true ||
    manifest?.review?.foldRequiresReview !== true ||
    manifest?.liveRunSafety?.foldRequiresReview !== true
  ) {
    throw new Error('R-CD-2 manifest authority flags are invalid');
  }
  for (const [label, value] of [
    ['run result', runResult],
    ['normalized row result', rowResult],
  ]) {
    if (!value) continue;
    if (value.candidateOnly !== true || value.foldRequiresReview !== true) {
      throw new Error(`R-CD-2 ${label} authority flags are invalid`);
    }
  }
  if (runResult) reconcileReview(runResult.review, 'run result', { outcome });
  if (rowResult?.review) reconcileReview(rowResult.review, 'normalized row result', { outcome });
  if (envelope) {
    if (
      envelope.candidateOnly !== true ||
      envelope.foldRequiresReview !== true ||
      envelope.canonicalFoldForbidden !== true
    ) {
      throw new Error('R-CD-2 candidate envelope authority flags are invalid');
    }
    reconcileReview(envelope.review, 'candidate envelope', { complete: true, outcome });
  }
}

function reconcileFlatClaim(value, selected, label) {
  if (!value || typeof value !== 'object') return;
  claim(value.candidateSha, selected.candidateSha, `${label} candidateSha`);
  claim(value.sha, selected.candidateSha, `${label} sha`);
  claim(value.runtimeBuildSha, selected.runtimeBuildSha, `${label} runtimeBuildSha`);
  claim(value.docsRef, selected.docsRef, `${label} docsRef`);
  claim(value.repository, selected.repository, `${label} repository`);
  claim(value.seat, selected.seat, `${label} seat`);
  claim(value.matrixId, selected.matrixId, `${label} matrixId`);
  claim(value.runId, selected.runId, `${label} runId`);
  claim(value.row, selected.row, `${label} row`);
  claim(value.rowId, selected.row, `${label} rowId`);
  claim(value.scenario, selected.scenario, `${label} scenario`, scenarioFile);
  claim(value.manifestPath, selected.manifestPath, `${label} manifestPath`, portablePath);
  claim(value.manifestSha256, selected.manifestSha256, `${label} manifestSha256`);
  claim(value.scenarioPath, selected.scenarioPath, `${label} scenarioPath`, portablePath);
  claim(value.scenarioSha256, selected.scenarioSha256, `${label} scenarioSha256`);
}

function reconcileNestedClaims(value, selected, label, carrier = '', root = true) {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value)) {
    const identityCarriers = new Set(['authorityIdentity', 'harness', 'identity']);
    const strongKeys = [
      'candidateSha', 'runtimeBuildSha', 'docsRef', 'repository', 'seat',
      'matrixId', 'runId', 'rowId', 'manifestPath', 'manifestSha256',
      'scenarioPath', 'scenarioSha256',
    ];
    const weakShape = ['row', 'scenario'].filter((key) =>
      Object.prototype.hasOwnProperty.call(value, key)).length === 2;
    if (
      root ||
      identityCarriers.has(carrier) ||
      strongKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key)) ||
      weakShape
    ) {
      reconcileFlatClaim(value, selected, label);
    }
    if (carrier === 'candidate') {
      claim(value.sha, selected.candidateSha, `${label} candidate sha`);
    } else if (carrier === 'runtime' || carrier === 'runtimeIdentity') {
      claim(value.sha, selected.runtimeBuildSha, `${label} runtime sha`);
      claim(value.buildSha, selected.runtimeBuildSha, `${label} runtime buildSha`);
    } else if (carrier === 'docs') {
      claim(value.sha, selected.docsRef, `${label} docs sha`);
      claim(value.ref, selected.docsRef, `${label} docs ref`);
    } else if (carrier === 'matrix') {
      claim(value.id, selected.matrixId, `${label} matrix id`);
    } else if (carrier === 'run') {
      claim(value.id, selected.runId, `${label} run id`);
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    if (entry && typeof entry === 'object') {
      reconcileNestedClaims(entry, selected, `${label}.${key}`, key, false);
    }
  }
}

function validateAcquisitionSnapshot({
  correlation,
  evidence,
  identity,
  signingKey,
  runDir,
}) {
  const validation = validateRcd2AcquisitionReceipt(
    correlation,
    signingKey,
    identity,
    typeof evidence?.nonce === 'string' ? evidence : undefined,
  );
  if (!validation.valid) {
    throw new Error(`R-CD-2 immutable acquisition receipt invalid: ${validation.reason}`);
  }
  const snapshot = readJson(
    path.join(runDir, correlation.tempoSnapshot.file),
    'immutable Tempo snapshot',
  );
  if (sha256(snapshot.raw) !== correlation.tempoSnapshot.sha256) {
    throw new Error('R-CD-2 immutable Tempo snapshot digest mismatch');
  }
}

function reconcileEnvelope(envelope, selected) {
  if (!envelope || typeof envelope !== 'object') return;
  claim(envelope.candidate?.sha, selected.candidateSha, 'candidate envelope candidate');
  claim(envelope.candidate?.docsRef, selected.docsRef, 'candidate envelope docs ref');
  reconcileFlatClaim(envelope.harness, selected, 'candidate envelope harness');
  claim(envelope.run?.id, selected.runId, 'candidate envelope run');
  claim(envelope.run?.rowId, selected.row, 'candidate envelope row');
  claim(envelope.run?.seat, selected.seat, 'candidate envelope seat');
  claim(envelope.run?.scenario, selected.scenario, 'candidate envelope scenario', scenarioFile);
}

function reconcileReceiptIdentity(receipt, selected) {
  const identity = receipt?.identity;
  if (!identity || typeof identity !== 'object') return;
  reconcileFlatClaim(identity, selected, 'authoritative receipt identity');
  reconcileFlatClaim(identity.harness, selected, 'authoritative receipt harness');
}

function reconcileCompleteIdentity(identity, expected, label) {
  if (!identity || typeof identity !== 'object') {
    throw new Error(`R-CD-2 ${label} complete authority identity is required`);
  }
  if (canonicalJson(identity) !== canonicalJson(expected)) {
    throw new Error(`R-CD-2 authority identity mismatch for ${label}`);
  }
}

function parseEvidenceJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`R-CD-2 evidence.jsonl record ${index + 1} is malformed: ${error.message}`);
      }
    });
}

function summaryClaims(runDir) {
  return readdirSync(runDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /summary\.json$/iu.test(entry.name) &&
      entry.name !== 'run-summary.json')
    .map((entry) => readJson(path.join(runDir, entry.name), entry.name).value);
}

export function isRcd2AuthorityRequired({
  root,
  runDir,
  manifest,
  metadata,
  runResult,
  summary,
  evidence,
  correlation,
  envelope,
  rowResult,
} = {}) {
  const values = [
    manifest?.rowId,
    manifest?.artifactDestination?.row,
    metadata?.row,
    runResult?.row,
    runResult?.rowId,
    summary?.row,
    summary?.rowId,
    evidence?.row,
    correlation?.row,
    envelope?.run?.rowId,
    rowResult?.row,
    rowResult?.rowId,
  ];
  if (values.some((value) => String(value || '').trim().toUpperCase() === R_CD_2_ROW)) return true;
  const scenarios = [
    manifest?.scenario?.name,
    manifest?.scenario?.file,
    metadata?.scenario,
    summary?.scenario,
    envelope?.run?.scenario,
    rowResult?.scenario,
  ].map((value) => String(value || '').replace(/\.js$/iu, '').toLowerCase());
  if (scenarios.includes('r-cd-2-silent-wake')) return true;
  const manifests = [
    metadata?.manifestPath,
    envelope?.harness?.manifestPath,
    manifest?.artifactDestination?.manifestPath,
  ].map((value) => path.posix.basename(portablePath(String(value || ''))).toLowerCase());
  if (manifests.includes('r-cd-2.json')) return true;
  if (
    runResult?.authoritativeReceipt?.file === R_CD_2_RECEIPT_FILE ||
    envelope?.authoritativeReceipt?.file === R_CD_2_RECEIPT_FILE ||
    runResult?.verdictSource === R_CD_2_VERDICT_SOURCE ||
    rowResult?.verdictSource === R_CD_2_VERDICT_SOURCE ||
    envelope?.result?.outcomeSource === R_CD_2_VERDICT_SOURCE ||
    runResult?.observability?.traceStatus === R_CD_2_VERDICT_SOURCE ||
    envelope?.observability?.traceStatus === R_CD_2_VERDICT_SOURCE
  ) return true;
  if (runDir) {
    try {
      const resolvedRunDir = path.resolve(runDir);
      if (root) {
        const relativeToBoundary = path.relative(path.resolve(root), resolvedRunDir);
        if (
          relativeToBoundary === '..' ||
          relativeToBoundary.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeToBoundary)
        ) return false;
      }
      const parts = portablePath(resolvedRunDir).split('/').filter(Boolean);
      const final = parts.slice(-4);
      if (
        final.length === 4 &&
        SHA.test(final[0]) &&
        final[1]?.toUpperCase() === R_CD_2_ROW &&
        PUBLIC_ID.test(final[2] || '') &&
        PUBLIC_ID.test(final[3] || '')
      ) return true;
      for (const name of [
        R_CD_2_SELECTION_RECEIPT_FILE,
        R_CD_2_RECEIPT_FILE,
        'r-cd-2-authority-context.json',
      ]) {
        if (existsSync(path.join(resolvedRunDir, name))) return true;
      }
    } catch {
      // Other supplied claims still decide whether this is an R-CD-2 boundary.
    }
  }
  return false;
}

export function establishRcd2AuthorityContext({
  root,
  runDir,
  selectedMatrixId,
  manifest,
  metadata,
  evidence,
  correlation,
  summary,
  rowResult,
  envelope,
  signingKey = process.env.OPENCLAW_GATEWAY_TOKEN,
} = {}) {
  if (!runDir) throw new Error('R-CD-2 authority context requires a run directory');
  const resolvedRunDir = realpathSync(path.resolve(runDir));
  if (root) {
    const boundary = realpathSync(path.resolve(root));
    const relativeToBoundary = path.relative(boundary, resolvedRunDir);
    if (
      relativeToBoundary === '..' ||
      relativeToBoundary.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToBoundary)
    ) {
      throw new Error('R-CD-2 run directory is outside the caller scan boundary');
    }
  }
  const resolvedRoot = realpathSync(rCd2AuthorityRootForRunDir(resolvedRunDir));
  const pathIdentity = pathClaims(resolvedRoot, resolvedRunDir);
  const selection = readJson(
    path.join(resolvedRunDir, R_CD_2_SELECTION_RECEIPT_FILE),
    'selected context receipt',
  );
  const selectionValidation = validateRcd2SelectedContextReceipt(
    selection.value,
    signingKey,
  );
  if (!selectionValidation.valid) {
    throw new Error(
      `R-CD-2 selected context receipt invalid: ${selectionValidation.reason}`,
    );
  }
  const identity = selectionValidation.identity;
  const selected = {
    candidateSha: identity.candidateSha,
    runtimeBuildSha: identity.runtimeBuildSha,
    docsRef: identity.docsRef,
    repository: identity.repository,
    seat: identity.seat,
    matrixId: identity.matrixId,
    runId: identity.runId,
    row: identity.row,
    scenario: identity.scenario,
    manifestPath: identity.harness.manifestPath,
    manifestSha256: identity.harness.manifestSha256,
    scenarioPath: identity.harness.scenarioPath,
    scenarioSha256: identity.harness.scenarioSha256,
  };
  if (selectedMatrixId !== undefined) {
    same(selectedMatrixId, selected.matrixId, 'explicit selected matrix');
  }
  const capturedManifest = readJson(
    path.join(resolvedRunDir, 'row-manifest.json'),
    'captured manifest',
  );
  const scenarioRaw = (() => {
    try {
      return readFileSync(path.join(resolvedRunDir, 'row-scenario.js'));
    } catch (error) {
      throw new Error(`R-CD-2 captured scenario missing or unreadable: ${error.message}`);
    }
  })();
  const archived = selectArchivedProvenance(resolvedRoot, selected.matrixId);
  reconcileArchivedProvenance({
    root: resolvedRoot,
    runDir: resolvedRunDir,
    provenance: archived.value,
    selected,
    pathIdentity,
    manifestRaw: capturedManifest.raw,
    scenarioRaw,
    signingKey,
  });
  const resolvedManifest = reconcileManifest(capturedManifest.value, selected);
  if (manifest) reconcileManifest(manifest, selected);
  const metadataValue = metadata || readJson(
    path.join(resolvedRunDir, 'runner-metadata.json'),
    'runner metadata',
  ).value;
  reconcileMetadata(metadataValue, selected);
  reconcileNestedClaims(metadataValue, selected, 'runner metadata');
  reconcileNestedClaims(summary, selected, 'summary');
  reconcileNestedClaims(evidence, selected, 'evidence');
  reconcileNestedClaims(correlation, selected, 'correlation');
  reconcileNestedClaims(rowResult, selected, 'normalized row result');
  reconcileEnvelope(envelope, selected);
  if (correlation) {
    reconcileCompleteIdentity(correlation.authorityIdentity, identity, 'correlation receipt');
    validateAcquisitionSnapshot({
      correlation,
      evidence: typeof evidence?.nonce === 'string' ? evidence : undefined,
      identity,
      signingKey,
      runDir: resolvedRunDir,
    });
  }

  return {
    root: resolvedRoot,
    runDir: resolvedRunDir,
    selected,
    identity,
    manifest: resolvedManifest,
    metadata: metadataValue,
    provenanceFile: archived.file,
    selectionReceiptFile: path.join(resolvedRunDir, R_CD_2_SELECTION_RECEIPT_FILE),
  };
}

export function consumeRcd2Authority({
  root,
  runDir,
  selectedMatrixId,
  manifest,
  metadata,
  runResult,
  summary,
  evidence,
  derivationEvidence,
  correlation,
  envelope,
  rowResult,
  signingKey = process.env.OPENCLAW_GATEWAY_TOKEN,
  requireRunResult = true,
} = {}) {
  const context = establishRcd2AuthorityContext({
    root,
    runDir,
    selectedMatrixId,
    manifest,
    metadata,
    evidence,
    correlation,
    summary,
    rowResult,
    envelope,
    signingKey,
  });
  const dir = context.runDir;
  const result = runResult || readJson(
    path.join(dir, 'run-result.json'),
    'run result',
    { optional: !requireRunResult },
  )?.value;
  if (requireRunResult && !result) throw new Error('R-CD-2 run result is required');
  reconcileNestedClaims(result, context.selected, 'run result');
  const summaries = [...summaryClaims(dir), ...(summary ? [summary] : [])];
  for (const entry of summaries) reconcileNestedClaims(entry, context.selected, 'summary');
  const privateEvidence = readJson(
    path.join(dir, 'private-evidence.json'),
    'private evidence',
    { optional: true },
  )?.value;
  if (privateEvidence) reconcileNestedClaims(
    privateEvidence,
    context.selected,
    'private evidence',
  );
  for (const entry of parseEvidenceJsonl(path.join(dir, 'evidence.jsonl'))) {
    reconcileNestedClaims(entry, context.selected, 'public evidence');
  }
  const correlationValue = correlation || readJson(
    path.join(dir, 'continuation-trace-correlation.json'),
    'correlation receipt',
    { optional: true },
  )?.value;
  if (correlationValue) {
    reconcileNestedClaims(correlationValue, context.selected, 'correlation receipt');
    reconcileCompleteIdentity(
      correlationValue.authorityIdentity,
      context.identity,
      'correlation receipt',
    );
    validateAcquisitionSnapshot({
      correlation: correlationValue,
      evidence: typeof (privateEvidence || derivationEvidence)?.nonce === 'string'
        ? privateEvidence || derivationEvidence
        : undefined,
      identity: context.identity,
      signingKey,
      runDir: dir,
    });
  }
  const envelopeValue = envelope || readJson(
    path.join(dir, 'candidate-run-result.json'),
    'candidate envelope',
    { optional: true },
  )?.value;
  if (envelopeValue) {
    reconcileEnvelope(envelopeValue, context.selected);
    reconcileNestedClaims(envelopeValue, context.selected, 'candidate envelope');
  }

  const receiptRead = readJson(
    path.join(dir, R_CD_2_RECEIPT_FILE),
    'authoritative receipt',
  );
  const receipt = receiptRead.value;
  reconcileReceiptIdentity(receipt, context.selected);
  reconcileNestedClaims(receipt, context.selected, 'authoritative receipt');
  const receiptSha256 = sha256(receiptRead.raw);
  if (result?.authoritativeReceipt?.sha256 !== undefined &&
      result.authoritativeReceipt.sha256 !== receiptSha256) {
    throw new Error('R-CD-2 authoritative receipt digest mismatch');
  }
  const validation = validateRcd2AuthoritativeReceipt(receipt, signingKey, context.identity);
  if (!validation.valid) {
    throw new Error(`R-CD-2 authoritative receipt invalid: ${validation.reason}`);
  }
  const evidenceForDerivation = privateEvidence || derivationEvidence;
  if (evidenceForDerivation) {
    const rederived = resolveRcd2AuthoritativeReceipt({
      evidence: evidenceForDerivation,
      correlation: correlationValue,
      identity: context.identity,
      signingKey,
    });
    if (canonicalJson(rederived) !== canonicalJson(receipt)) {
      throw new Error('R-CD-2 authoritative receipt does not match selected disk evidence');
    }
  }
  reconcileAuthorityPolicy({
    manifest: context.manifest,
    runResult: result,
    envelope: envelopeValue,
    rowResult,
    outcome: validation.verdict,
  });

  if (result) {
    same(result.verdictSource, R_CD_2_VERDICT_SOURCE, 'run result verdict source');
    same(result.verdict, validation.verdict, 'run result verdict');
    const declaration = result.authoritativeReceipt;
    same(declaration?.file, R_CD_2_RECEIPT_FILE, 'run result receipt file');
    if (declaration?.sha256 !== receiptSha256) {
      throw new Error('R-CD-2 authoritative receipt digest mismatch');
    }
    same(declaration?.validated, true, 'run result receipt validation');
    same(declaration?.source, R_CD_2_RECEIPT_SOURCE, 'run result receipt source');
  }
  for (const entry of parseEvidenceJsonl(path.join(dir, 'evidence.jsonl'))) {
    claim(entry.verdict, validation.verdict, 'public evidence verdict');
    claim(
      entry.authoritativeReceipt,
      R_CD_2_RECEIPT_FILE,
      'public evidence authoritative receipt',
    );
  }
  if (envelopeValue) {
    same(envelopeValue.result?.outcomeSource, R_CD_2_VERDICT_SOURCE, 'candidate envelope verdict source');
    same(envelopeValue.result?.outcome, validation.verdict, 'candidate envelope verdict');
    same(
      envelopeValue.authoritativeReceipt?.file,
      R_CD_2_RECEIPT_FILE,
      'candidate envelope receipt file',
    );
    same(
      envelopeValue.authoritativeReceipt?.sha256,
      receiptSha256,
      'candidate envelope receipt digest',
    );
  }
  if (rowResult) {
    same(rowResult.outcome, validation.verdict, 'normalized row result outcome');
  }

  return {
    rowId: R_CD_2_ROW,
    outcome: validation.verdict,
    identity: context.identity,
    candidateOnly: true,
    foldRequiresReview: true,
    canonicalFoldForbidden: true,
    review: {
      status: result?.review?.status || 'ready-for-human-review',
      pendingReceipts: result?.review?.pendingReceipts || [],
      complete: (result?.review?.pendingReceipts || []).length === 0,
    },
    authoritativeReceipt: {
      file: R_CD_2_RECEIPT_FILE,
      sha256: receiptSha256,
      source: R_CD_2_RECEIPT_SOURCE,
    },
    selectedMatrixProvenance: portablePath(path.relative(context.root, context.provenanceFile)),
  };
}
