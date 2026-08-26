import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const PRODUCT_DEFAULT_MAX_SPAWN_DEPTH = 1;
export const PROOF_PROFILE_MAX_SPAWN_DEPTH = 5;
export const REVIEWED_MAX_SPAWN_DEPTH = 5;

const ROW_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/u;

export class ContinuationDepthContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContinuationDepthContractError';
    this.code = code;
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function assertDepth(value, code, label) {
  if (!Number.isInteger(value) || value < 1 || value > REVIEWED_MAX_SPAWN_DEPTH) {
    throw new ContinuationDepthContractError(
      code,
      `${label} must be an integer from 1 through ${REVIEWED_MAX_SPAWN_DEPTH}`,
    );
  }
  return value;
}

export function parseSelectedRows(input) {
  const values = Array.isArray(input)
    ? input
    : String(input ?? '').split(',');
  const rows = [];
  for (const value of values) {
    const row = String(value).trim().toUpperCase();
    if (!row) continue;
    if (!ROW_ID_PATTERN.test(row)) {
      throw new ContinuationDepthContractError(
        'malformed-row-id',
        'selected row ids must use the public Project-81 row-id alphabet',
      );
    }
    if (!rows.includes(row)) rows.push(row);
  }
  return rows;
}

export function validateManifestContinuationRequirements(manifest) {
  const failures = [];
  const requirements = manifest?.continuationRequirements;
  if (requirements === undefined) return failures;
  if (!isObject(requirements)) {
    return ['continuationRequirements must be an object'];
  }
  const keys = Object.keys(requirements);
  for (const key of keys) {
    if (!['requiredSpawnDepth', 'reason'].includes(key)) {
      failures.push(`continuationRequirements has unsupported property '${key}'`);
    }
  }
  if (!hasOwn(requirements, 'requiredSpawnDepth')) {
    failures.push('continuationRequirements.requiredSpawnDepth is required');
  } else if (
    !Number.isInteger(requirements.requiredSpawnDepth) ||
    requirements.requiredSpawnDepth < 1 ||
    requirements.requiredSpawnDepth > REVIEWED_MAX_SPAWN_DEPTH
  ) {
    failures.push(
      `continuationRequirements.requiredSpawnDepth must be an integer from 1 through ${REVIEWED_MAX_SPAWN_DEPTH}`,
    );
  }
  if (hasOwn(requirements, 'reason') && (
    typeof requirements.reason !== 'string' ||
    requirements.reason.trim().length === 0
  )) {
    failures.push('continuationRequirements.reason must be a non-empty string when provided');
  }
  return failures;
}

export function resolveContinuationDepthRequirements({ rows, manifestsDir }) {
  const selectedRows = parseSelectedRows(rows);
  if (selectedRows.length === 0) {
    return {
      selectedRows,
      rowRequirements: [],
      nestedRows: [],
      requiredMaxSpawnDepth: PRODUCT_DEFAULT_MAX_SPAWN_DEPTH,
    };
  }
  if (!manifestsDir) {
    throw new ContinuationDepthContractError(
      'manifest-catalog-unavailable',
      'the proof-row manifest catalog is required to resolve selected rows',
    );
  }

  const catalog = new Map();
  for (const file of readdirSync(manifestsDir).filter((name) => name.endsWith('.json')).sort()) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8'));
    } catch {
      throw new ContinuationDepthContractError(
        'manifest-catalog-invalid',
        'the proof-row manifest catalog contains invalid JSON',
      );
    }
    if (typeof manifest?.rowId === 'string') {
      catalog.set(manifest.rowId.toUpperCase(), manifest);
    }
  }

  const rowRequirements = selectedRows.map((rowId) => {
    const manifest = catalog.get(rowId);
    if (!manifest) {
      throw new ContinuationDepthContractError(
        'unknown-selected-row',
        `selected row ${rowId} is not present in the proof-row manifest catalog`,
      );
    }
    const failures = validateManifestContinuationRequirements(manifest);
    if (failures.length > 0) {
      throw new ContinuationDepthContractError(
        'manifest-depth-requirement-invalid',
        `selected row ${rowId} has an invalid continuation depth requirement: ${failures.join('; ')}`,
      );
    }
    const declared = manifest.continuationRequirements !== undefined;
    const requiredSpawnDepth = declared
      ? manifest.continuationRequirements.requiredSpawnDepth
      : PRODUCT_DEFAULT_MAX_SPAWN_DEPTH;
    return { rowId, requiredSpawnDepth, declared };
  });
  const requiredMaxSpawnDepth = Math.max(
    PRODUCT_DEFAULT_MAX_SPAWN_DEPTH,
    ...rowRequirements.map((entry) => entry.requiredSpawnDepth),
  );

  return {
    selectedRows,
    rowRequirements,
    nestedRows: rowRequirements
      .filter((entry) => entry.requiredSpawnDepth > PRODUCT_DEFAULT_MAX_SPAWN_DEPTH)
      .map((entry) => entry.rowId),
    requiredMaxSpawnDepth,
  };
}

export function parseExpectedMaxSpawnDepth(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = typeof value === 'number'
    ? value
    : (/^[1-9][0-9]*$/u.test(String(value)) ? Number(value) : Number.NaN);
  return assertDepth(
    normalized,
    'expected-depth-invalid',
    'expected maxSpawnDepth',
  );
}

export function inspectConfiguredMaxSpawnDepth(config) {
  const subagents = config?.agents?.defaults?.subagents;
  if (!hasOwn(subagents, 'maxSpawnDepth')) {
    return {
      configuredMaxSpawnDepth: null,
      effectiveMaxSpawnDepth: PRODUCT_DEFAULT_MAX_SPAWN_DEPTH,
      source: 'product-default',
      valid: true,
      reason: null,
    };
  }
  const configuredMaxSpawnDepth = subagents.maxSpawnDepth;
  if (
    !Number.isInteger(configuredMaxSpawnDepth) ||
    configuredMaxSpawnDepth < 1 ||
    configuredMaxSpawnDepth > REVIEWED_MAX_SPAWN_DEPTH
  ) {
    return {
      configuredMaxSpawnDepth: null,
      effectiveMaxSpawnDepth: null,
      source: 'invalid',
      valid: false,
      reason: 'configured-depth-malformed',
    };
  }
  return {
    configuredMaxSpawnDepth,
    effectiveMaxSpawnDepth: configuredMaxSpawnDepth,
    source: 'explicit',
    valid: true,
    reason: null,
  };
}

export function evaluateContinuationDepth({
  config,
  configAvailable = true,
  requirements,
  expectedMaxSpawnDepth = null,
}) {
  const base = {
    configuredMaxSpawnDepth: null,
    effectiveMaxSpawnDepth: null,
    requiredMaxSpawnDepth: requirements?.requiredMaxSpawnDepth ?? null,
    expectedMaxSpawnDepth,
    productDefaultMaxSpawnDepth: PRODUCT_DEFAULT_MAX_SPAWN_DEPTH,
    proofProfileMaxSpawnDepth: PROOF_PROFILE_MAX_SPAWN_DEPTH,
    selectedRows: requirements?.selectedRows ?? [],
    nestedRows: requirements?.nestedRows ?? [],
    source: 'unknown',
    sufficient: false,
    expectationMatched: expectedMaxSpawnDepth === null ? null : false,
    reason: null,
  };
  if (!configAvailable || !isObject(config)) {
    return { ...base, mode: 'unavailable', reason: 'configured-depth-unknown' };
  }
  if (!requirements || !Number.isInteger(requirements.requiredMaxSpawnDepth)) {
    return { ...base, mode: 'checked', reason: 'required-depth-unknown' };
  }

  const inspected = inspectConfiguredMaxSpawnDepth(config);
  if (!inspected.valid) {
    return {
      ...base,
      ...inspected,
      mode: 'checked',
      requiredMaxSpawnDepth: requirements.requiredMaxSpawnDepth,
    };
  }
  const expectationMatched = expectedMaxSpawnDepth === null
    ? null
    : inspected.effectiveMaxSpawnDepth === expectedMaxSpawnDepth;
  const enough = inspected.effectiveMaxSpawnDepth >= requirements.requiredMaxSpawnDepth;
  let reason = null;
  if (!enough) reason = 'effective-depth-insufficient';
  else if (expectationMatched === false) reason = 'proof-profile-depth-mismatch';

  return {
    ...base,
    ...inspected,
    mode: 'checked',
    requiredMaxSpawnDepth: requirements.requiredMaxSpawnDepth,
    sufficient: enough && expectationMatched !== false,
    expectationMatched,
    reason,
  };
}

export function applyIsolatedProofProfile(config) {
  if (!isObject(config)) {
    throw new ContinuationDepthContractError(
      'base-config-invalid',
      'base config must be a JSON object',
    );
  }
  const agents = isObject(config.agents) ? config.agents : {};
  const defaults = isObject(agents.defaults) ? agents.defaults : {};
  const subagents = isObject(defaults.subagents) ? defaults.subagents : {};
  return {
    ...config,
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        subagents: {
          ...subagents,
          maxSpawnDepth: PROOF_PROFILE_MAX_SPAWN_DEPTH,
        },
      },
    },
  };
}
