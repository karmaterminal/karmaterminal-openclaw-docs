import {
  evaluateTelemetryBackendDispositionContract,
  TELEMETRY_BACKEND_DISPOSITION_PASS_SCOPE,
  telemetryBackendStatusBlocksPass,
  validateTelemetryBackendStatusReceipt,
} from './telemetry-backend-status.js';

const RECEIPT_STATUSES = new Set(['present', 'missing', 'unknown', 'absent']);
const ARTIFACT_STATUSES = new Set(['present', 'missing']);

function normalizedStatuses(values, allowed) {
  return Array.isArray(values)
    ? values.filter((entry) =>
        entry && typeof entry.name === 'string' && allowed.has(entry.status))
    : [];
}

function isBackendDispositionContract(manifest) {
  return manifest?.telemetryContract?.verdictAuthority?.passScope ===
    TELEMETRY_BACKEND_DISPOSITION_PASS_SCOPE;
}

function assertedReceiptPresent(summary, name) {
  const value = summary?.proof_receipts?.[name] ?? summary?.receipts?.[name];
  return value === true || value === 'present';
}

export function telemetryReceiptStatuses({
  manifest,
  summary = {},
  backendStatus = null,
  fallback = [],
}) {
  const normalizedFallback = normalizedStatuses(fallback, RECEIPT_STATUSES);
  if (!isBackendDispositionContract(manifest)) return normalizedFallback;

  const contract = manifest.telemetryContract;
  const disposition = contract.verdictAuthority.backendDispositionContract || {};
  const backendValidation = backendStatus
    ? validateTelemetryBackendStatusReceipt(backendStatus)
    : { valid: false };
  const interactions = backendStatus?.interactions || [];
  const requiredBackends = Array.isArray(disposition.requiredBackends)
    ? disposition.requiredBackends
    : [];
  const exactBackendReceipts = backendValidation.valid &&
    interactions.length === requiredBackends.length &&
    requiredBackends.every((backend) =>
      interactions.filter((interaction) => interaction.backend === backend).length === 1);
  const controlsPass = ['complete', 'partial', 'unavailable', 'capped', 'unknown']
    .every((status) => summary?.classificationControls?.[status] === status);
  const known = new Map(normalizedFallback.map((entry) => [entry.name, entry]));
  const names = new Set([
    ...known.keys(),
    ...(contract.rebindReceipts || []),
  ]);

  for (const name of names) {
    let present;
    if (name === 'backend-completeness-receipt') {
      present = assertedReceiptPresent(summary, name) && exactBackendReceipts;
    } else if (name === 'degraded-response-classified') {
      present = assertedReceiptPresent(summary, name) && controlsPass;
    } else if (name === 'rebind-key-set-published') {
      present = assertedReceiptPresent(summary, name) &&
        backendValidation.valid &&
        backendStatus?.rebind?.complete === true;
    } else if (name === 'slice-strategy-recorded') {
      present = assertedReceiptPresent(summary, name) &&
        backendValidation.valid &&
        interactions.length > 0 &&
        interactions.every((interaction) =>
          typeof interaction.sliceStrategy === 'string' &&
          interaction.sliceStrategy.length > 0);
    } else {
      continue;
    }
    known.set(name, {
      ...(known.get(name) || {}),
      name,
      status: present ? 'present' : 'missing',
    });
  }

  return [...known.values()];
}

export function telemetryRebindFrom({
  manifest,
  receiptStatuses = [],
  backendStatus = null,
  artifactStatuses = [],
}) {
  const contract = manifest?.telemetryContract;
  if (!contract) return null;
  const receipts = normalizedStatuses(receiptStatuses, RECEIPT_STATUSES);
  const artifacts = normalizedStatuses(artifactStatuses, ARTIFACT_STATUSES);
  const statusByName = new Map(receipts.map((entry) => [entry.name, entry.status]));
  const declaredRebindReceipts = Array.isArray(contract.rebindReceipts)
    ? contract.rebindReceipts
    : [];
  const unprovenRebindReceipts = declaredRebindReceipts
    .map((name) => ({ name, status: statusByName.get(name) || 'absent' }))
    .filter((entry) => entry.status !== 'present');
  const backendValidation = backendStatus
    ? validateTelemetryBackendStatusReceipt(backendStatus)
    : { valid: false, failures: ['backend-status.json is absent'] };
  const dispositionContract = isBackendDispositionContract(manifest)
    ? evaluateTelemetryBackendDispositionContract(
        backendStatus,
        contract.verdictAuthority.backendDispositionContract,
      )
    : null;
  const backendBlocked = dispositionContract
    ? dispositionContract.status !== 'proven'
    : !backendStatus || telemetryBackendStatusBlocksPass(backendStatus);
  const missingRequiredArtifacts = artifacts
    .filter((entry) => entry.status !== 'present')
    .map((entry) => entry.name);
  const backend = {
    file: 'backend-status.json',
    validated: backendValidation.valid,
    disposition: backendStatus?.status || 'unknown',
    complete: backendStatus?.complete === true,
    countAuthority: backendStatus?.countAuthority === true,
    requiredCompletenessKeys:
      backendStatus?.requiredCompletenessKeys ||
      contract.backendUnavailable?.requiredCompletenessKeys ||
      [],
    declaredRebindKeys:
      backendStatus?.rebind?.declaredKeys ||
      contract.backendUnavailable?.rebindKeys ||
      [],
    missingRebindKeys:
      backendStatus?.rebind?.missingKeys ||
      contract.backendUnavailable?.rebindKeys ||
      [],
    validationFailures: backendValidation.failures || [],
  };
  const rebindablePassClaimed =
    contract.rebindable === true ||
    contract.verdictAuthority?.passScope === 'behavioral-and-telemetry-rebindable';
  const rebindBlocked =
    (contract.enforcement === 'blocking' || rebindablePassClaimed) &&
    (declaredRebindReceipts.length === 0 || unprovenRebindReceipts.length > 0);
  const status = !backendBlocked &&
    missingRequiredArtifacts.length === 0 &&
    unprovenRebindReceipts.length === 0 &&
    declaredRebindReceipts.length > 0
    ? 'proven'
    : 'unproven';
  return {
    contract: contract.schema,
    enforcement: contract.enforcement,
    rebindable: contract.rebindable === true,
    passScope: contract.verdictAuthority?.passScope || null,
    productInstrumentationPrerequisite:
      contract.productInstrumentationPrerequisite === true,
    prerequisiteRows: Array.isArray(contract.prerequisiteRows)
      ? contract.prerequisiteRows
      : [],
    backendUnavailableDisposition:
      contract.backendUnavailable?.disposition || null,
    declaredRebindReceipts,
    unprovenRebindReceipts,
    status,
    backend,
    ...(dispositionContract ? { dispositionContract } : {}),
    requiredArtifacts: artifacts,
    missingRequiredArtifacts,
    passBlockers: {
      backend: backendBlocked,
      requiredArtifacts: missingRequiredArtifacts.length > 0,
      rebind: rebindBlocked,
    },
  };
}

export function telemetryPassBlockers(telemetryRebind) {
  if (!telemetryRebind) return [];
  const blockers = [];
  if (telemetryRebind.passBlockers?.backend) {
    const dispositionFailures = telemetryRebind.dispositionContract?.failures || [];
    blockers.push({
      failureClass: 'backend-disposition',
      receipt: 'backend-status',
      reason: telemetryRebind.passScope === TELEMETRY_BACKEND_DISPOSITION_PASS_SCOPE
        ? `backend disposition row contract is unproven: ${
            dispositionFailures.join('; ') || 'invalid or missing backend receipt'
          }`
        : `telemetry backend is ${telemetryRebind.backend?.disposition || 'unknown'}; ` +
          'complete metadata is required',
    });
  }
  if (telemetryRebind.passBlockers?.requiredArtifacts) {
    blockers.push({
      failureClass: 'missing-telemetry-artifact',
      receipt: 'telemetry-artifacts',
      reason:
        `required telemetry artifact(s) missing: ${telemetryRebind.missingRequiredArtifacts.join(', ')}`,
    });
  }
  if (telemetryRebind.passBlockers?.rebind) {
    blockers.push({
      failureClass: 'telemetry-rebind-unproven',
      receipt: 'telemetry-rebind',
      reason:
        `telemetry rebind not proven (${telemetryRebind.enforcement}): ` +
        (telemetryRebind.unprovenRebindReceipts.length > 0
          ? telemetryRebind.unprovenRebindReceipts
              .map((entry) => `${entry.name}=${entry.status}`)
              .join(', ')
          : 'no rebind receipt declared'),
    });
  }
  return blockers;
}

export function validateTelemetryRebind(value) {
  const failures = [];
  const safeString = (entry) =>
    typeof entry === 'string' && entry.length > 0 && entry.length <= 256 &&
    !/[\r\n]/u.test(entry) &&
    !/\bagent:[a-z0-9:_-]+\b/iu.test(entry) &&
    !/(?:^|[\s("'=])(?:\/home\/|\/root\/|~\/|[A-Za-z]:[\\/])/u.test(entry);
  const exactKeys = (entry, keys, label, optional = []) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      failures.push(`${label} must be an object`);
      return;
    }
    const expected = new Set([...keys, ...optional]);
    for (const key of Object.keys(entry)) {
      if (!expected.has(key)) failures.push(`${label} contains unknown key ${key}`);
    }
    for (const key of keys) {
      if (!Object.hasOwn(entry, key)) failures.push(`${label} is missing ${key}`);
    }
  };
  exactKeys(value, [
    'contract',
    'enforcement',
    'rebindable',
    'passScope',
    'productInstrumentationPrerequisite',
    'prerequisiteRows',
    'backendUnavailableDisposition',
    'declaredRebindReceipts',
    'unprovenRebindReceipts',
    'status',
    'backend',
    'requiredArtifacts',
    'missingRequiredArtifacts',
    'passBlockers',
  ], 'telemetryRebind', ['dispositionContract']);
  if (failures.length > 0) return { valid: false, failures };
  exactKeys(value.backend, [
    'file',
    'validated',
    'disposition',
    'complete',
    'countAuthority',
    'requiredCompletenessKeys',
    'declaredRebindKeys',
    'missingRebindKeys',
    'validationFailures',
  ], 'telemetryRebind.backend');
  exactKeys(value.passBlockers, [
    'backend',
    'requiredArtifacts',
    'rebind',
  ], 'telemetryRebind.passBlockers');
  const hasDispositionContract = Object.hasOwn(value, 'dispositionContract');
  if (value.passScope === TELEMETRY_BACKEND_DISPOSITION_PASS_SCOPE) {
    if (!hasDispositionContract) {
      failures.push('telemetryRebind.dispositionContract is required for disposition scope');
    } else {
      exactKeys(value.dispositionContract, [
        'mode',
        'status',
        'requiredBackends',
        'rowPassStatuses',
        'requireNonAuthoritativeZero',
        'requireCompleteRebind',
        'failures',
      ], 'telemetryRebind.dispositionContract');
      if (value.dispositionContract.mode !== 'honest-backend-disposition') {
        failures.push('telemetryRebind.dispositionContract.mode is invalid');
      }
      if (!['proven', 'unproven'].includes(value.dispositionContract.status)) {
        failures.push('telemetryRebind.dispositionContract.status is invalid');
      }
      if (!Array.isArray(value.dispositionContract.requiredBackends) ||
          !value.dispositionContract.requiredBackends.every((backend) =>
            ['tempo', 'loki'].includes(backend))) {
        failures.push('telemetryRebind.dispositionContract.requiredBackends is invalid');
      }
      if (!Array.isArray(value.dispositionContract.rowPassStatuses) ||
          !value.dispositionContract.rowPassStatuses.every((status) =>
            ['complete', 'partial', 'unavailable', 'capped', 'unknown'].includes(status))) {
        failures.push('telemetryRebind.dispositionContract.rowPassStatuses is invalid');
      }
      for (const field of ['requireNonAuthoritativeZero', 'requireCompleteRebind']) {
        if (value.dispositionContract[field] !== true) {
          failures.push(`telemetryRebind.dispositionContract.${field} must be true`);
        }
      }
      if (!Array.isArray(value.dispositionContract.failures) ||
          !value.dispositionContract.failures.every(safeString)) {
        failures.push('telemetryRebind.dispositionContract.failures must be public-safe');
      }
      if (value.passBlockers.backend !==
          (value.dispositionContract.status !== 'proven')) {
        failures.push('telemetryRebind backend blocker disagrees with disposition contract');
      }
    }
  } else if (hasDispositionContract) {
    failures.push('telemetryRebind.dispositionContract is only valid for disposition scope');
  }
  for (const field of [
    'prerequisiteRows',
    'declaredRebindReceipts',
    'missingRequiredArtifacts',
  ]) {
    if (!Array.isArray(value[field]) || !value[field].every(safeString)) {
      failures.push(`telemetryRebind.${field} must be a public-safe string array`);
    }
  }
  for (const [field, statuses] of [
    ['unprovenRebindReceipts', new Set(['present', 'missing', 'unknown', 'absent'])],
    ['requiredArtifacts', new Set(['present', 'missing'])],
  ]) {
    if (!Array.isArray(value[field])) {
      failures.push(`telemetryRebind.${field} must be an array`);
      continue;
    }
    for (const entry of value[field]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
          Object.keys(entry).length !== 2 ||
          !Object.hasOwn(entry, 'name') || !Object.hasOwn(entry, 'status') ||
          !safeString(entry.name) || !statuses.has(entry.status)) {
        failures.push(`telemetryRebind.${field} contains an invalid entry`);
      }
    }
  }
  if (!['proven', 'unproven'].includes(value.status)) {
    failures.push('telemetryRebind.status is invalid');
  }
  if (value.backend.file !== 'backend-status.json') {
    failures.push('telemetryRebind.backend.file must be backend-status.json');
  }
  for (const field of [
    'requiredCompletenessKeys',
    'declaredRebindKeys',
    'missingRebindKeys',
    'validationFailures',
  ]) {
    if (!Array.isArray(value.backend[field]) ||
        !value.backend[field].every((entry) =>
          typeof entry === 'string' && entry.length <= 256 && !/[\r\n]/u.test(entry))) {
      failures.push(`telemetryRebind.backend.${field} must be a public-safe string array`);
    }
  }
  for (const field of ['backend', 'requiredArtifacts', 'rebind']) {
    if (typeof value.passBlockers[field] !== 'boolean') {
      failures.push(`telemetryRebind.passBlockers.${field} must be boolean`);
    }
  }
  for (const field of ['validated', 'complete', 'countAuthority']) {
    if (typeof value.backend[field] !== 'boolean') {
      failures.push(`telemetryRebind.backend.${field} must be boolean`);
    }
  }
  return { valid: failures.length === 0, failures };
}
