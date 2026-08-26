import {
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
  const backendBlocked = !backendStatus ||
    telemetryBackendStatusBlocksPass(backendStatus);
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
    blockers.push({
      failureClass: 'backend-disposition',
      receipt: 'backend-status',
      reason:
        `telemetry backend is ${telemetryRebind.backend?.disposition || 'unknown'}; ` +
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
  const exactKeys = (entry, keys, label) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      failures.push(`${label} must be an object`);
      return;
    }
    const expected = new Set(keys);
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
  ], 'telemetryRebind');
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
  for (const field of [
    'prerequisiteRows',
    'declaredRebindReceipts',
    'unprovenRebindReceipts',
    'requiredArtifacts',
    'missingRequiredArtifacts',
  ]) {
    if (!Array.isArray(value[field])) failures.push(`telemetryRebind.${field} must be an array`);
  }
  if (!['proven', 'unproven'].includes(value.status)) {
    failures.push('telemetryRebind.status is invalid');
  }
  if (value.backend.file !== 'backend-status.json') {
    failures.push('telemetryRebind.backend.file must be backend-status.json');
  }
  for (const field of ['backend', 'requiredArtifacts', 'rebind']) {
    if (typeof value.passBlockers[field] !== 'boolean') {
      failures.push(`telemetryRebind.passBlockers.${field} must be boolean`);
    }
  }
  return { valid: failures.length === 0, failures };
}
