import {
  existsSync,
  realpathSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasVerifiedRrc2Outcome } from '../candidate-run-result-contract.mjs';

export const POLICY_SCHEMA = 'openclaw.proofs.continuation-acceptance-policy.v1';
export const ACCEPTANCE_SCHEMA = 'openclaw.proofs.continuation-acceptance.v1';
export const MATRIX_STATES = ['pass', 'partial', 'thin', 'fail', 'honest_limit', 'missing'];
export const ROLLUP_KEYS = ['total_rows', ...MATRIX_STATES];
export const SUPPLEMENTAL_ROW_IDS = [
  'R-OBS-CONT-PROVENANCE',
  'R-OBS-PROOF-MARKER',
  'R-OBS-TERMINAL-OUTCOME',
];
export const REQUIRED_TARGET_ROLLUP = {
  total_rows: 38,
  pass: 37,
  partial: 0,
  thin: 0,
  fail: 0,
  honest_limit: 1,
  missing: 0,
};
export const SUPPLEMENTAL_TARGET_ROLLUP = {
  total_rows: 3,
  pass: 0,
  partial: 0,
  thin: 0,
  fail: 0,
  honest_limit: 0,
  missing: 3,
};
const TELEMETRY_CATALOG_COMMIT = '5a061227cbb438572bc9aecdb1dbc902dc585452';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_POLICY_PATH = path.resolve(
  moduleDir,
  '../../continuation-acceptance-policy.json',
);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sumStates(rollup) {
  return MATRIX_STATES.reduce((total, state) => total + (rollup[state] || 0), 0);
}

function safeReceiptPath(root, receiptPath, captureSha) {
  if (typeof receiptPath !== 'string' || !receiptPath ||
      path.isAbsolute(receiptPath) || receiptPath.includes('\\')) {
    return null;
  }
  const normalized = path.posix.normalize(receiptPath);
  if (normalized.startsWith('../') || normalized.includes('/../') ||
      !normalized.startsWith(`PROOFS/${captureSha}/R-RC-2/`)) {
    return null;
  }
  try {
    const resolvedRoot = realpathSync(path.resolve(root));
    const resolved = realpathSync(path.resolve(resolvedRoot, normalized));
    if (!resolved.startsWith(`${resolvedRoot}${path.sep}`) ||
        !statSync(resolved).isFile()) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

export function tallyRows(rows) {
  const rollup = Object.fromEntries(MATRIX_STATES.map((state) => [state, 0]));
  for (const row of rows) {
    if (MATRIX_STATES.includes(row?.state)) rollup[row.state] += 1;
  }
  return { total_rows: rows.length, ...rollup };
}

export function loadContinuationAcceptancePolicy(policyPath = DEFAULT_POLICY_PATH) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function validateContinuationAcceptancePolicy(policy) {
  const failures = [];
  if (!isObject(policy)) return ['policy must be an object'];
  if (policy.schema !== POLICY_SCHEMA) {
    failures.push(`policy schema must be ${POLICY_SCHEMA}`);
  }
  if (!Array.isArray(policy.required_rows) || policy.required_rows.length === 0) {
    failures.push('policy required_rows must be a non-empty array');
  }
  if (!Array.isArray(policy.supplemental_rows) ||
      policy.supplemental_rows.length === 0) {
    failures.push('policy supplemental_rows must be a non-empty array');
  }

  const requiredIds = Array.isArray(policy.required_rows) ? policy.required_rows : [];
  const supplementalIds = Array.isArray(policy.supplemental_rows)
    ? policy.supplemental_rows.map((entry) => entry?.row)
    : [];
  const requiredDuplicates = duplicates(requiredIds);
  const supplementalDuplicates = duplicates(supplementalIds);
  if (requiredDuplicates.length) {
    failures.push(`policy required_rows contains duplicates: ${requiredDuplicates.join(', ')}`);
  }
  if (supplementalDuplicates.length) {
    failures.push(`policy supplemental_rows contains duplicates: ${supplementalDuplicates.join(', ')}`);
  }
  const overlap = requiredIds.filter((row) => supplementalIds.includes(row));
  if (overlap.length) {
    failures.push(`policy required/supplemental overlap: ${overlap.join(', ')}`);
  }
  if (requiredIds.length !== 38) {
    failures.push(`policy must contain exactly 38 required rows, got ${requiredIds.length}`);
  }
  if (!sameJson(supplementalIds, SUPPLEMENTAL_ROW_IDS)) {
    failures.push(
      `policy supplemental_rows must be exactly: ${SUPPLEMENTAL_ROW_IDS.join(', ')}`,
    );
  }
  if (!requiredIds.includes('R-OBS-BACKEND-DISPOSITION')) {
    failures.push('R-OBS-BACKEND-DISPOSITION must remain required');
  }
  for (const entry of policy.supplemental_rows || []) {
    if (!isObject(entry) || typeof entry.row !== 'string') {
      failures.push('every supplemental policy entry must be an object with row');
      continue;
    }
    if (entry.classification !== 'future-product-telemetry' ||
        entry.state !== 'missing' ||
        entry.issue !== 'karmaterminal/openclaw#1254' ||
        entry.introduced_commit !== TELEMETRY_CATALOG_COMMIT ||
        entry.catalog_pr !== 'karmaterminal/karmaterminal-openclaw-docs#512') {
      failures.push(`${entry.row} has an invalid supplemental provenance contract`);
    }
  }
  const allowed = policy.required_non_pass;
  if (!isObject(allowed) || allowed.row !== 'R-RC-2' ||
      allowed.state !== 'honest_limit' ||
      allowed.candidate_verdict !== 'HONEST-LIMIT-candidate' ||
      allowed.receipt_required !== true) {
    failures.push('required_non_pass must reserve receipt-backed honest_limit for R-RC-2');
  }
  for (const [label, rollup, expectedRows] of [
    ['target_rollup', policy.target_rollup, requiredIds.length],
    ['supplemental_target_rollup', policy.supplemental_target_rollup, supplementalIds.length],
  ]) {
    if (!isObject(rollup) || ROLLUP_KEYS.some((key) => !Number.isInteger(rollup[key]) || rollup[key] < 0)) {
      failures.push(`${label} must contain non-negative integer rollup keys`);
      continue;
    }
    if (rollup.total_rows !== expectedRows || sumStates(rollup) !== expectedRows) {
      failures.push(`${label} must tally exactly ${expectedRows} rows`);
    }
  }
  if (!sameJson(policy.target_rollup, REQUIRED_TARGET_ROLLUP)) {
    failures.push('target_rollup must be exactly 37 PASS plus one honest limit');
  }
  if (!sameJson(policy.supplemental_target_rollup, SUPPLEMENTAL_TARGET_ROLLUP)) {
    failures.push('supplemental_target_rollup must preserve three missing rows');
  }
  return failures;
}

export function isContinuationAcceptanceManifest(
  manifest,
  policy = loadContinuationAcceptancePolicy(),
) {
  if (!isObject(manifest)) return false;
  if (manifest.acceptance || manifest.supplemental_rows) return true;
  const ids = new Set([
    ...(Array.isArray(manifest.required_rows) ? manifest.required_rows : []),
    ...(Array.isArray(manifest.rows) ? manifest.rows.map((row) => row?.row) : []),
  ]);
  const policyIds = [...policy.required_rows, ...SUPPLEMENTAL_ROW_IDS];
  return policyIds.filter((row) => ids.has(row)).length >= 30;
}

export function flattenDispatchAllocation(allocation) {
  const failures = [];
  const entries = [];
  if (Array.isArray(allocation)) {
    for (const [index, entry] of allocation.entries()) {
      if (!isObject(entry) || typeof entry.row !== 'string' || !entry.row) {
        failures.push(`dispatch_allocation[${index}] must be an object with row`);
        continue;
      }
      if (typeof entry.owner !== 'string' || !entry.owner ||
          typeof entry.status !== 'string' || !entry.status) {
        failures.push(`dispatch_allocation[${index}] must name owner and status`);
        continue;
      }
      entries.push({ ...entry });
    }
  } else if (isObject(allocation)) {
    for (const [owner, rows] of Object.entries(allocation)) {
      if (!Array.isArray(rows)) {
        failures.push(`dispatch_allocation.${owner} must be an array`);
        continue;
      }
      for (const row of rows) {
        if (typeof row !== 'string' || !row) {
          failures.push(`dispatch_allocation.${owner} contains an invalid row`);
          continue;
        }
        if (row === 'PREFLIGHT') continue;
        entries.push({ row, owner, status: 'assigned' });
      }
    }
  } else {
    failures.push('dispatch_allocation must be an array or owner-to-row map');
  }
  return { entries, failures };
}

function receiptStatus(manifest, policy, root) {
  const allowed = policy.required_non_pass;
  const receiptPath = manifest.acceptance?.honest_limit_receipts?.[allowed.row];
  const resolved = safeReceiptPath(root, receiptPath, manifest.capture_sha);
  if (!resolved || !existsSync(resolved)) {
    return {
      valid: false,
      path: receiptPath || null,
      reason: 'receipt path is missing, unsafe, or absent',
    };
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    return { valid: false, path: receiptPath, reason: `receipt is invalid JSON: ${error.message}` };
  }
  const valid = receipt.verdict === allowed.candidate_verdict &&
    receipt.effectiveExitCode === 0 &&
    hasVerifiedRrc2Outcome(allowed.row, receipt.verdict, receipt.evidence);
  return {
    valid,
    path: receiptPath,
    reason: valid ? null : 'receipt lacks the nonce-bound structured context_threshold rejection',
  };
}

function classifyAcceptance(manifest, policy, root) {
  const rowsById = new Map((manifest.rows || []).map((row) => [row.row, row]));
  const requiredRows = policy.required_rows
    .map((row) => rowsById.get(row))
    .filter(Boolean);
  const supplementalRows = policy.supplemental_rows
    .map((entry) => rowsById.get(entry.row))
    .filter(Boolean);
  const requiredRollup = tallyRows(requiredRows);
  const supplementalRollup = tallyRows(supplementalRows);
  const receipt = receiptStatus(manifest, policy, root);
  const blockers = [];
  for (const row of requiredRows) {
    if (row.state === 'pass') continue;
    if (row.row === policy.required_non_pass.row &&
        row.state === policy.required_non_pass.state &&
        row.candidate_verdict === policy.required_non_pass.candidate_verdict &&
        receipt.valid) {
      continue;
    }
    blockers.push({
      row: row.row,
      state: row.state,
      reason: row.row === policy.required_non_pass.row && row.state === policy.required_non_pass.state
        ? receipt.reason || 'honest-limit receipt is invalid'
        : 'required row is not PASS',
    });
  }
  const complete = blockers.length === 0 &&
    sameJson(requiredRollup, policy.target_rollup);
  return {
    requiredRollup,
    supplementalRollup,
    receipt,
    blockers,
    complete,
  };
}

export function analyzeContinuationAcceptanceManifest(
  manifest,
  {
    policy = loadContinuationAcceptancePolicy(),
    root = process.cwd(),
  } = {},
) {
  const failures = validateContinuationAcceptancePolicy(policy);
  if (!isObject(manifest)) {
    return { valid: false, failures: [...failures, 'manifest must be an object'] };
  }

  const requiredIds = Array.isArray(manifest.required_rows) ? manifest.required_rows : [];
  const supplementalEntries = Array.isArray(manifest.supplemental_rows)
    ? manifest.supplemental_rows
    : [];
  const supplementalIds = supplementalEntries.map((entry) => entry?.row);
  const rowIds = Array.isArray(manifest.rows) ? manifest.rows.map((row) => row?.row) : [];
  const expectedAll = [...policy.required_rows, ...policy.supplemental_rows.map((entry) => entry.row)];

  if (!sameJson(requiredIds, policy.required_rows)) {
    failures.push('required_rows must exactly match the canonical 38-row continuation policy');
  }
  if (!sameJson(supplementalEntries, policy.supplemental_rows)) {
    failures.push('supplemental_rows must exactly match the typed three-row future-product collection');
  }
  for (const [label, values] of [
    ['required_rows', requiredIds],
    ['supplemental_rows', supplementalIds],
    ['rows', rowIds],
  ]) {
    const found = duplicates(values);
    if (found.length) failures.push(`${label} contains duplicates: ${found.join(', ')}`);
  }
  const overlap = requiredIds.filter((row) => supplementalIds.includes(row));
  if (overlap.length) failures.push(`required/supplemental overlap: ${overlap.join(', ')}`);
  const rowSet = new Set(rowIds);
  const missingRows = expectedAll.filter((row) => !rowSet.has(row));
  const unclassifiedRows = rowIds.filter((row) => !expectedAll.includes(row));
  if (missingRows.length) failures.push(`classified rows missing from rows[]: ${missingRows.join(', ')}`);
  if (unclassifiedRows.length) failures.push(`rows[] contains unclassified rows: ${unclassifiedRows.join(', ')}`);
  if (rowIds.length !== expectedAll.length) {
    failures.push(`rows[] must contain exactly ${expectedAll.length} classified rows, got ${rowIds.length}`);
  }

  const rowsById = new Map((manifest.rows || []).map((row) => [row.row, row]));
  for (const entry of policy.supplemental_rows) {
    const row = rowsById.get(entry.row);
    if (!row) continue;
    if (row.state !== entry.state) {
      failures.push(`${entry.row} supplemental state must remain ${entry.state}`);
    }
    if (row.state === 'missing' && row.candidate_verdict === 'PASS-candidate') {
      failures.push(`${entry.row} is supplemental/missing and cannot claim PASS-candidate`);
    }
  }
  for (const row of manifest.rows || []) {
    if (!MATRIX_STATES.includes(row.state)) {
      failures.push(`${row.row} has unknown state ${JSON.stringify(row.state)}`);
    }
    if (row.state === 'honest_limit' && row.row !== policy.required_non_pass.row) {
      failures.push(`${row.row} cannot use honest_limit; it is reserved for R-RC-2`);
    }
  }

  const dispatch = flattenDispatchAllocation(manifest.dispatch_allocation);
  failures.push(...dispatch.failures);
  const dispatchIds = dispatch.entries.map((entry) => entry.row);
  const dispatchDuplicates = duplicates(dispatchIds);
  if (dispatchDuplicates.length) {
    failures.push(`dispatch_allocation contains duplicates: ${dispatchDuplicates.join(', ')}`);
  }
  const dispatchMissing = policy.required_rows.filter((row) => !dispatchIds.includes(row));
  const dispatchExtra = dispatchIds.filter((row) => !policy.required_rows.includes(row));
  if (dispatchMissing.length) {
    failures.push(`required rows missing dispatch allocation: ${dispatchMissing.join(', ')}`);
  }
  if (dispatchExtra.length) {
    failures.push(`dispatch allocation contains non-required rows: ${dispatchExtra.join(', ')}`);
  }

  const catalogRollup = tallyRows(manifest.rows || []);
  if (!sameJson(manifest.rollup, catalogRollup)) {
    failures.push('rollup must tally all catalog rows, including supplemental history');
  }
  const classification = classifyAcceptance(manifest, policy, root);
  if (!sameJson(manifest.supplemental_rollup, classification.supplementalRollup)) {
    failures.push('supplemental_rollup must tally only supplemental rows');
  }
  const acceptance = manifest.acceptance;
  if (!isObject(acceptance) || acceptance.schema !== ACCEPTANCE_SCHEMA) {
    failures.push(`acceptance.schema must be ${ACCEPTANCE_SCHEMA}`);
  } else {
    if (!sameJson(acceptance.required_rollup, classification.requiredRollup)) {
      failures.push('acceptance.required_rollup must tally only required rows');
    }
    if (!sameJson(acceptance.target_rollup, policy.target_rollup)) {
      failures.push('acceptance.target_rollup must match the canonical 37 PASS + one honest-limit target');
    }
    if (acceptance.complete !== classification.complete) {
      failures.push('acceptance.complete disagrees with required-row state and receipt policy');
    }
    if (!sameJson(acceptance.blocking_required_rows, classification.blockers)) {
      failures.push('acceptance.blocking_required_rows is stale or incomplete');
    }
  }
  const rrc2 = rowsById.get(policy.required_non_pass.row);
  if (rrc2?.state === policy.required_non_pass.state && !classification.receipt.valid) {
    failures.push(`R-RC-2 honest_limit is not receipt-backed: ${classification.receipt.reason}`);
  }

  return {
    valid: failures.length === 0,
    failures,
    requiredRows: requiredIds,
    supplementalRows: supplementalIds,
    dispatchRows: dispatchIds,
    catalogRollup,
    requiredRollup: classification.requiredRollup,
    supplementalRollup: classification.supplementalRollup,
    acceptance: {
      complete: classification.complete,
      blockers: classification.blockers,
      receipt: classification.receipt,
    },
  };
}

export function buildContinuationAcceptanceManifest(
  sourceManifest,
  {
    allocationManifest = sourceManifest,
    honestLimitReceipts = sourceManifest?.acceptance?.honest_limit_receipts || {},
    policy = loadContinuationAcceptancePolicy(),
    root = process.cwd(),
  } = {},
) {
  const policyFailures = validateContinuationAcceptancePolicy(policy);
  if (policyFailures.length) {
    throw new Error(`invalid continuation acceptance policy: ${policyFailures.join('; ')}`);
  }
  if (!isObject(sourceManifest) || !Array.isArray(sourceManifest.rows)) {
    throw new Error('source manifest must contain rows[]');
  }
  const expectedAll = [...policy.required_rows, ...policy.supplemental_rows.map((entry) => entry.row)];
  const sourceRowIds = sourceManifest.rows.map((row) => row?.row);
  const sourceDuplicates = duplicates(sourceRowIds);
  if (sourceDuplicates.length) {
    throw new Error(`source rows[] contains duplicates: ${sourceDuplicates.join(', ')}`);
  }
  const missing = expectedAll.filter((row) => !sourceRowIds.includes(row));
  const extra = sourceRowIds.filter((row) => !expectedAll.includes(row));
  if (missing.length || extra.length || sourceRowIds.length !== expectedAll.length) {
    throw new Error(
      `source rows[] does not match continuation policy` +
      `${missing.length ? `; missing: ${missing.join(', ')}` : ''}` +
      `${extra.length ? `; unclassified: ${extra.join(', ')}` : ''}`,
    );
  }

  const allocation = flattenDispatchAllocation(allocationManifest?.dispatch_allocation);
  if (allocation.failures.length) {
    throw new Error(`source dispatch allocation is invalid: ${allocation.failures.join('; ')}`);
  }
  const byRow = new Map();
  for (const entry of allocation.entries) {
    if (byRow.has(entry.row)) {
      throw new Error(`source dispatch allocation duplicates ${entry.row}`);
    }
    byRow.set(entry.row, entry);
  }
  const missingAllocation = expectedAll.filter((row) => !byRow.has(row));
  if (missingAllocation.length) {
    throw new Error(`source dispatch allocation drops classified rows: ${missingAllocation.join(', ')}`);
  }
  const sourceRowsById = new Map(sourceManifest.rows.map((row) => [row.row, row]));

  const manifest = {
    ...sourceManifest,
    required_rows: [...policy.required_rows],
    supplemental_rows: policy.supplemental_rows.map((entry) => ({ ...entry })),
    dispatch_allocation: policy.required_rows.map((row) => {
      const entry = { ...byRow.get(row) };
      const sourceRow = sourceRowsById.get(row);
      if (Object.prototype.hasOwnProperty.call(sourceRow, 'fired')) {
        entry.status = sourceRow.fired ? 'fired' : 'not-fired';
      }
      return entry;
    }),
    rollup: tallyRows(sourceManifest.rows),
    supplemental_rollup: tallyRows(
      sourceManifest.rows.filter((row) =>
        policy.supplemental_rows.some((entry) => entry.row === row.row)),
    ),
    acceptance: {
      schema: ACCEPTANCE_SCHEMA,
      required_rollup: tallyRows(
        sourceManifest.rows.filter((row) => policy.required_rows.includes(row.row)),
      ),
      target_rollup: { ...policy.target_rollup },
      complete: false,
      blocking_required_rows: [],
      honest_limit_receipts: { ...honestLimitReceipts },
    },
  };
  const classification = classifyAcceptance(manifest, policy, root);
  manifest.acceptance.complete = classification.complete;
  manifest.acceptance.blocking_required_rows = classification.blockers;
  return manifest;
}
