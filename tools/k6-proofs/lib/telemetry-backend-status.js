export const TELEMETRY_BACKEND_STATUS_SCHEMA =
  'openclaw.k6.telemetry-backend-status.v1';
export const TELEMETRY_BACKEND_INTERACTION_SCHEMA =
  'openclaw.k6.telemetry-backend-interaction.v1';
export const TELEMETRY_BACKEND_DISPOSITION_PASS_SCOPE =
  'backend-disposition-contract';
export const TELEMETRY_BACKEND_STATUSES = Object.freeze([
  'complete',
  'partial',
  'unavailable',
  'capped',
  'unknown',
]);

const STATUS_SET = new Set(TELEMETRY_BACKEND_STATUSES);
const STATUS_PRECEDENCE = ['unavailable', 'capped', 'partial', 'unknown', 'complete'];
const SHA = /^[a-f0-9]{40}$/u;
const FINGERPRINT = /^[a-f0-9]{16}$/u;
const SAFE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const SAFE_ENV = /^[A-Z][A-Z0-9_]*$/u;
const API_STATUS = /^(?:unavailable|http-(?:0|[1-9]\d{0,2}))$/u;
const RECEIPT_KEYS = new Set([
  'schema',
  'rowId',
  'candidateSha',
  'seat',
  'proofRunId',
  'generatedAt',
  'status',
  'complete',
  'countAuthority',
  'requiredCompletenessKeys',
  'interactions',
  'rebind',
]);
const INTERACTION_KEYS = new Set([
  'schema',
  'backend',
  'operation',
  'status',
  'httpStatus',
  'apiStatus',
  'tempoApiStatus',
  'lokiApiStatus',
  'totalBlocks',
  'completedJobs',
  'inspectedBytes',
  'resultCapped',
  'resultCount',
  'resultLimit',
  'windowStartUtc',
  'windowEndUtc',
  'queryFingerprint',
  'backendBaseUrlEnv',
  'sliceStrategy',
  'zeroResultAuthoritative',
]);
const REBIND_KEYS = new Set(['declaredKeys', 'values', 'missingKeys', 'complete']);

function integerOrNull(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function safeIsoOrNull(value) {
  if (value == null || value === '') return null;
  const text = String(value);
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === text
    ? text
    : null;
}

function isSafeIdentity(value) {
  return typeof value === 'string' &&
    value.length <= 256 &&
    SAFE_IDENTITY.test(value) &&
    !value.includes('..') &&
    !/^file:/iu.test(value) &&
    !/^(?:\/|~\/|[A-Za-z]:[\\/])/u.test(value);
}

function isNullableInteger(value) {
  return value === null ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function firstInteger(...values) {
  for (const value of values) {
    const parsed = integerOrNull(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function tempoCompleteness(responseJson) {
  const metrics = responseJson?.metrics || responseJson?.searchMetrics ||
    responseJson?.data?.metrics || {};
  return {
    totalBlocks: firstInteger(metrics.totalBlocks, metrics.total_blocks),
    completedJobs: firstInteger(metrics.completedJobs, metrics.completed_jobs),
    inspectedBytes: firstInteger(metrics.inspectedBytes, metrics.inspected_bytes),
    totalJobs: firstInteger(metrics.totalJobs, metrics.total_jobs),
  };
}

function lokiCompleteness(responseJson) {
  const stats = responseJson?.data?.stats || responseJson?.stats || {};
  const summary = stats.summary || {};
  const store = stats.store || {};
  return {
    totalBlocks: firstInteger(
      summary.totalBlocks,
      summary.total_blocks,
      store.totalChunksRef,
      store.total_chunks_ref,
    ),
    completedJobs: firstInteger(
      summary.completedJobs,
      summary.completed_jobs,
      responseJson?.status === 'success' && Object.keys(stats).length > 0 ? 1 : null,
    ),
    inspectedBytes: firstInteger(
      summary.inspectedBytes,
      summary.inspected_bytes,
      summary.totalBytesProcessed,
      summary.total_bytes_processed,
    ),
    totalJobs: firstInteger(
      summary.totalJobs,
      summary.total_jobs,
      responseJson?.status === 'success' && Object.keys(stats).length > 0 ? 1 : null,
    ),
  };
}

function normalizedCompleteness(backend, responseJson) {
  return backend === 'loki'
    ? lokiCompleteness(responseJson)
    : tempoCompleteness(responseJson);
}

function requiredValue(interaction, key) {
  if (key === 'tempoApiStatus') {
    return interaction.backend === 'tempo' ? interaction.tempoApiStatus : interaction.apiStatus;
  }
  if (key === 'lokiApiStatus') {
    return interaction.backend === 'loki' ? interaction.lokiApiStatus : interaction.apiStatus;
  }
  return interaction[key] ?? null;
}

function hasAllCompleteness(interaction, requiredCompletenessKeys) {
  return requiredCompletenessKeys.every((key) => requiredValue(interaction, key) !== null);
}

function statusFor({
  transportOk,
  responseParsed,
  httpStatus,
  resultCapped,
  completeness,
  requiredCompletenessKeys,
}) {
  if (resultCapped) return 'capped';
  if (transportOk !== true || responseParsed !== true ||
      !Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    return 'unavailable';
  }
  const provisional = {
    ...completeness,
    apiStatus: `http-${httpStatus}`,
    tempoApiStatus: `http-${httpStatus}`,
    lokiApiStatus: `http-${httpStatus}`,
  };
  const dataCompletenessKeys = requiredCompletenessKeys.filter(
    (key) => !['tempoApiStatus', 'lokiApiStatus', 'apiStatus'].includes(key),
  );
  const present = dataCompletenessKeys.filter(
    (key) => requiredValue(provisional, key) !== null,
  ).length;
  if (present === 0) return 'unknown';
  if (!hasAllCompleteness(provisional, requiredCompletenessKeys)) return 'partial';
  if (completeness.totalJobs !== null &&
      completeness.completedJobs !== completeness.totalJobs) {
    return 'partial';
  }
  return 'complete';
}

export function classifyTelemetryBackendInteraction({
  backend,
  operation,
  transportOk = true,
  responseParsed = true,
  httpStatus = null,
  responseJson = null,
  resultCount = null,
  resultLimit = null,
  resultCapped = false,
  windowStartUtc = null,
  windowEndUtc = null,
  queryFingerprint,
  backendBaseUrlEnv,
  sliceStrategy = 'single-window',
  requiredCompletenessKeys = [
    'totalBlocks',
    'completedJobs',
    'inspectedBytes',
    'tempoApiStatus',
  ],
}) {
  if (!['tempo', 'loki'].includes(backend)) {
    throw new Error(`unsupported telemetry backend: ${backend}`);
  }
  if (!isSafeIdentity(operation)) {
    throw new Error('telemetry backend operation must be a public-safe identifier');
  }
  if (!FINGERPRINT.test(String(queryFingerprint || ''))) {
    throw new Error('telemetry backend query fingerprint must be 16 lowercase hex characters');
  }
  if (!SAFE_ENV.test(String(backendBaseUrlEnv || ''))) {
    throw new Error('telemetry backend base URL must be named by a public-safe environment variable');
  }
  if (!isSafeIdentity(sliceStrategy)) {
    throw new Error('telemetry backend slice strategy must be a public-safe identifier');
  }
  const count = integerOrNull(resultCount);
  const limit = integerOrNull(resultLimit);
  const capped = resultCapped === true ||
    (limit !== null && limit > 0 && count !== null && count >= limit);
  const completeness = normalizedCompleteness(backend, responseJson);
  const normalizedHttpStatus = integerOrNull(httpStatus);
  const apiStatus = normalizedHttpStatus === null
    ? 'unavailable'
    : `http-${normalizedHttpStatus}`;
  const status = statusFor({
    transportOk,
    responseParsed,
    httpStatus: normalizedHttpStatus,
    resultCapped: capped,
    completeness,
    requiredCompletenessKeys,
  });
  return {
    schema: TELEMETRY_BACKEND_INTERACTION_SCHEMA,
    backend,
    operation,
    status,
    httpStatus: normalizedHttpStatus,
    apiStatus,
    tempoApiStatus: backend === 'tempo' ? apiStatus : null,
    lokiApiStatus: backend === 'loki' ? apiStatus : null,
    totalBlocks: completeness.totalBlocks,
    completedJobs: completeness.completedJobs,
    inspectedBytes: completeness.inspectedBytes,
    resultCapped: capped,
    resultCount: count,
    resultLimit: limit,
    windowStartUtc: safeIsoOrNull(windowStartUtc),
    windowEndUtc: safeIsoOrNull(windowEndUtc),
    queryFingerprint,
    backendBaseUrlEnv,
    sliceStrategy,
    zeroResultAuthoritative: status === 'complete' && count === 0,
  };
}

export function unknownTelemetryBackendInteraction({
  backend,
  operation = 'not-observed',
  queryFingerprint,
  backendBaseUrlEnv,
  requiredCompletenessKeys,
}) {
  return classifyTelemetryBackendInteraction({
    backend,
    operation,
    transportOk: true,
    responseParsed: true,
    httpStatus: 200,
    responseJson: {},
    resultCount: 0,
    queryFingerprint,
    backendBaseUrlEnv,
    sliceStrategy: 'not-observed',
    requiredCompletenessKeys,
  });
}

function aggregateStatus(interactions) {
  if (!Array.isArray(interactions) || interactions.length === 0) return 'unknown';
  return STATUS_PRECEDENCE.find((status) =>
    interactions.some((interaction) => interaction?.status === status)) || 'unknown';
}

function safeRebindValue(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    return value.length <= 512 && !/[\r\n]/u.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    const entries = value.map(safeRebindValue);
    return entries.every((entry) => entry !== null) ? entries : null;
  }
  return null;
}

function rebindBlock(declaredKeys, suppliedValues) {
  const values = {};
  for (const key of declaredKeys) {
    const value = safeRebindValue(suppliedValues?.[key]);
    if (value !== null) values[key] = value;
  }
  const missingKeys = declaredKeys.filter((key) => !Object.hasOwn(values, key));
  return {
    declaredKeys: [...declaredKeys],
    values,
    missingKeys,
    complete: missingKeys.length === 0,
  };
}

export function buildTelemetryBackendStatusReceipt({
  rowId,
  candidateSha = null,
  seat,
  proofRunId,
  interactions = [],
  requiredCompletenessKeys = [
    'totalBlocks',
    'completedJobs',
    'inspectedBytes',
    'tempoApiStatus',
  ],
  rebindKeys = [],
  rebindValues = {},
  generatedAt = new Date().toISOString(),
}) {
  const status = aggregateStatus(interactions);
  const complete = interactions.length > 0 &&
    interactions.every((interaction) =>
      interaction?.status === 'complete' &&
      hasAllCompleteness(interaction, requiredCompletenessKeys));
  return {
    schema: TELEMETRY_BACKEND_STATUS_SCHEMA,
    rowId,
    candidateSha,
    seat,
    proofRunId,
    generatedAt,
    status,
    complete,
    countAuthority: complete,
    requiredCompletenessKeys: [...requiredCompletenessKeys],
    interactions: [...interactions],
    rebind: rebindBlock(rebindKeys, rebindValues),
  };
}

function validateInteraction(interaction, requiredCompletenessKeys, index) {
  const failures = [];
  const fail = (message) => failures.push(`interactions[${index}]: ${message}`);
  if (interaction?.schema !== TELEMETRY_BACKEND_INTERACTION_SCHEMA) {
    fail('unsupported schema');
  }
  if (!interaction || Object.keys(interaction).some((key) => !INTERACTION_KEYS.has(key)) ||
      [...INTERACTION_KEYS].some((key) => !Object.hasOwn(interaction || {}, key))) {
    fail('interaction shape contains missing or unknown fields');
  }
  if (!['tempo', 'loki'].includes(interaction?.backend)) fail('invalid backend');
  if (!isSafeIdentity(interaction?.operation)) fail('operation is not public-safe');
  if (!STATUS_SET.has(interaction?.status)) fail('invalid status');
  if (!isNullableInteger(interaction?.httpStatus)) fail('invalid httpStatus');
  if (!API_STATUS.test(interaction?.apiStatus || '')) fail('invalid apiStatus');
  const expectedApiStatus = interaction?.httpStatus === null
    ? 'unavailable'
    : `http-${interaction.httpStatus}`;
  if (interaction?.apiStatus !== expectedApiStatus) {
    fail('apiStatus disagrees with httpStatus');
  }
  if (interaction?.tempoApiStatus !==
      (interaction?.backend === 'tempo' ? interaction?.apiStatus : null)) {
    fail('tempoApiStatus disagrees with backend/apiStatus');
  }
  if (interaction?.lokiApiStatus !==
      (interaction?.backend === 'loki' ? interaction?.apiStatus : null)) {
    fail('lokiApiStatus disagrees with backend/apiStatus');
  }
  for (const field of [
    'totalBlocks',
    'completedJobs',
    'inspectedBytes',
    'resultCount',
    'resultLimit',
  ]) {
    if (!isNullableInteger(interaction?.[field])) fail(`invalid ${field}`);
  }
  if (typeof interaction?.resultCapped !== 'boolean') fail('resultCapped must be boolean');
  if (typeof interaction?.zeroResultAuthoritative !== 'boolean') {
    fail('zeroResultAuthoritative must be boolean');
  }
  if (!FINGERPRINT.test(interaction?.queryFingerprint || '')) fail('invalid queryFingerprint');
  if (!SAFE_ENV.test(interaction?.backendBaseUrlEnv || '')) fail('invalid backendBaseUrlEnv');
  if (!isSafeIdentity(interaction?.sliceStrategy)) fail('sliceStrategy is not public-safe');
  for (const field of ['windowStartUtc', 'windowEndUtc']) {
    if (interaction?.[field] !== null && safeIsoOrNull(interaction?.[field]) === null) {
      fail(`${field} is not canonical ISO-8601`);
    }
  }
  if ((interaction?.windowStartUtc === null) !== (interaction?.windowEndUtc === null)) {
    fail('window bounds must both be present or both be null');
  } else if (interaction?.windowStartUtc !== null &&
      Date.parse(interaction.windowStartUtc) > Date.parse(interaction.windowEndUtc)) {
    fail('windowStartUtc is after windowEndUtc');
  }
  if (interaction?.resultCapped === true && interaction?.status !== 'capped') {
    fail('a capped result must use capped status');
  }
  if (interaction?.status === 'capped' && interaction?.resultCapped !== true) {
    fail('capped status requires resultCapped=true');
  }
  if (interaction?.zeroResultAuthoritative === true && interaction?.status !== 'complete') {
    fail('a non-complete response cannot authorize a zero result');
  }
  if (interaction?.zeroResultAuthoritative !==
      (interaction?.status === 'complete' && interaction?.resultCount === 0)) {
    fail('zeroResultAuthoritative disagrees with status/resultCount');
  }
  if (interaction?.status === 'complete' &&
      !hasAllCompleteness(interaction, requiredCompletenessKeys)) {
    fail('complete status is missing required completeness metadata');
  }
  return failures;
}

export function validateTelemetryBackendStatusReceipt(receipt, expected = {}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (!receipt || receipt.schema !== TELEMETRY_BACKEND_STATUS_SCHEMA) {
    return { valid: false, failures: ['unsupported backend-status schema'] };
  }
  if (Object.keys(receipt).some((key) => !RECEIPT_KEYS.has(key)) ||
      [...RECEIPT_KEYS].some((key) => !Object.hasOwn(receipt, key))) {
    fail('backend-status shape contains missing or unknown fields');
  }
  if (typeof receipt.rowId !== 'string' || !SAFE_IDENTITY.test(receipt.rowId)) {
    fail('rowId is not public-safe');
  }
  if (receipt.candidateSha !== null && !SHA.test(receipt.candidateSha || '')) {
    fail('candidateSha must be null or a full lowercase SHA');
  }
  for (const key of ['seat', 'proofRunId']) {
    if (!isSafeIdentity(receipt[key])) {
      fail(`${key} is not public-safe`);
    }
  }
  if (safeIsoOrNull(receipt.generatedAt) === null) fail('generatedAt is not canonical ISO-8601');
  if (!STATUS_SET.has(receipt.status)) fail('invalid aggregate status');
  if (typeof receipt.complete !== 'boolean') fail('complete must be boolean');
  if (typeof receipt.countAuthority !== 'boolean') {
    fail('countAuthority must be boolean');
  }
  if (!Array.isArray(receipt.requiredCompletenessKeys) ||
      receipt.requiredCompletenessKeys.length === 0 ||
      !receipt.requiredCompletenessKeys.every((key) => SAFE_KEY.test(key)) ||
      new Set(receipt.requiredCompletenessKeys).size !==
        receipt.requiredCompletenessKeys.length) {
    fail('requiredCompletenessKeys must be a non-empty public-safe key list');
  }
  if (!Array.isArray(receipt.interactions)) {
    fail('interactions must be an array');
  } else {
    receipt.interactions.forEach((interaction, index) => {
      failures.push(...validateInteraction(
        interaction,
        receipt.requiredCompletenessKeys || [],
        index,
      ));
    });
  }
  const aggregate = aggregateStatus(receipt.interactions || []);
  if (receipt.status !== aggregate) fail('aggregate status disagrees with interactions');
  const complete = (receipt.interactions || []).length > 0 &&
    (receipt.interactions || []).every((interaction) =>
      interaction?.status === 'complete' &&
      hasAllCompleteness(interaction, receipt.requiredCompletenessKeys || []));
  if (receipt.complete !== complete || receipt.countAuthority !== complete) {
    fail('complete/countAuthority disagree with interaction completeness');
  }
  const rebind = receipt.rebind;
  if (!rebind || !Array.isArray(rebind.declaredKeys) ||
      Object.keys(rebind || {}).some((key) => !REBIND_KEYS.has(key)) ||
      [...REBIND_KEYS].some((key) => !Object.hasOwn(rebind || {}, key)) ||
      !rebind.declaredKeys.every((key) => SAFE_KEY.test(key)) ||
      new Set(rebind.declaredKeys).size !== rebind.declaredKeys.length ||
      !rebind.values || typeof rebind.values !== 'object' || Array.isArray(rebind.values) ||
      !Array.isArray(rebind.missingKeys) ||
      new Set(rebind.missingKeys).size !== rebind.missingKeys.length ||
      rebind.complete !== (rebind.missingKeys.length === 0)) {
    fail('invalid rebind block');
  } else {
    const declared = new Set(rebind.declaredKeys);
    if (Object.keys(rebind.values).some((key) => !declared.has(key)) ||
        rebind.missingKeys.some((key) => !declared.has(key)) ||
        rebind.declaredKeys.some((key) =>
          Object.hasOwn(rebind.values, key) === rebind.missingKeys.includes(key))) {
      fail('rebind values and missingKeys do not partition declaredKeys');
    }
    const unsafeValue = (value) => {
      if (Array.isArray(value)) return value.some(unsafeValue);
      if (typeof value !== 'string') return false;
      return value.length > 512 || /[\r\n]/u.test(value) ||
        /\b(?:bearer|authorization|password|secret|token)=/iu.test(value) ||
        /\bagent:[a-z0-9:_-]+\b/iu.test(value) ||
        /(?:^|[\s("'=])(?:\/home\/|\/root\/|~\/|[A-Za-z]:[\\/])/u.test(value) ||
        /\bfile:\/\//iu.test(value);
    };
    if (Object.values(rebind.values).some(unsafeValue)) {
      fail('rebind values contain non-public material');
    }
    if (Object.values(rebind.values).some((value) => {
      const normalized = safeRebindValue(value);
      return normalized === null || JSON.stringify(normalized) !== JSON.stringify(value);
    })) {
      fail('rebind values contain an unsupported public shape');
    }
  }
  if (expected.requiredCompletenessKeys !== undefined &&
      JSON.stringify(receipt.requiredCompletenessKeys) !==
        JSON.stringify(expected.requiredCompletenessKeys)) {
    fail('requiredCompletenessKeys do not match the manifest contract');
  }
  if (expected.rebindKeys !== undefined &&
      JSON.stringify(receipt.rebind?.declaredKeys) !== JSON.stringify(expected.rebindKeys)) {
    fail('rebind declaredKeys do not match the manifest contract');
  }
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (field === 'requiredCompletenessKeys' || field === 'rebindKeys') continue;
    if (expectedValue !== undefined && receipt[field] !== expectedValue) {
      fail(`${field} does not match the expected run identity`);
    }
  }
  return { valid: failures.length === 0, failures };
}

export function evaluateTelemetryBackendDispositionContract(receipt, contract = {}) {
  const failures = [];
  const requiredBackends = Array.isArray(contract.requiredBackends)
    ? [...contract.requiredBackends]
    : [];
  const rowPassStatuses = Array.isArray(contract.rowPassStatuses)
    ? [...contract.rowPassStatuses]
    : [];
  const unique = (values) => new Set(values).size === values.length;

  if (requiredBackends.length === 0 ||
      !unique(requiredBackends) ||
      !requiredBackends.every((backend) => ['tempo', 'loki'].includes(backend))) {
    failures.push('requiredBackends must be a unique non-empty Tempo/Loki list');
  }
  if (rowPassStatuses.length === 0 ||
      !unique(rowPassStatuses) ||
      !rowPassStatuses.every((status) => STATUS_SET.has(status))) {
    failures.push('rowPassStatuses must be a unique non-empty backend-status list');
  }
  if (contract.requireNonAuthoritativeZero !== true) {
    failures.push('requireNonAuthoritativeZero must be true');
  }
  if (contract.requireCompleteRebind !== true) {
    failures.push('requireCompleteRebind must be true');
  }

  const validation = validateTelemetryBackendStatusReceipt(receipt);
  failures.push(...validation.failures.map((failure) => `backend-status: ${failure}`));
  if (validation.valid) {
    const interactions = receipt.interactions;
    for (const backend of requiredBackends) {
      const count = interactions.filter((interaction) => interaction.backend === backend).length;
      if (count !== 1) {
        failures.push(`required backend ${backend} has ${count} interaction receipts`);
      }
    }
    for (const interaction of interactions) {
      if (!requiredBackends.includes(interaction.backend)) {
        failures.push(`unexpected backend interaction: ${interaction.backend}`);
      }
      if (!rowPassStatuses.includes(interaction.status)) {
        failures.push(
          `${interaction.backend} disposition ${interaction.status} is not row-passable`,
        );
      }
      if (interaction.status !== 'complete' &&
          interaction.resultCount === 0 &&
          interaction.zeroResultAuthoritative !== false) {
        failures.push(
          `${interaction.backend} degraded zero must remain non-authoritative`,
        );
      }
    }
    if (interactions.length !== requiredBackends.length) {
      failures.push(
        `expected ${requiredBackends.length} backend interactions, received ${interactions.length}`,
      );
    }
    if (!rowPassStatuses.includes(receipt.status)) {
      failures.push(`aggregate disposition ${receipt.status} is not row-passable`);
    }
    if (receipt.rebind.complete !== true) {
      failures.push(
        `rebind key set is incomplete: ${receipt.rebind.missingKeys.join(', ') || 'unknown'}`,
      );
    }
  }

  return {
    mode: 'honest-backend-disposition',
    status: failures.length === 0 ? 'proven' : 'unproven',
    requiredBackends,
    rowPassStatuses,
    requireNonAuthoritativeZero: contract.requireNonAuthoritativeZero === true,
    requireCompleteRebind: contract.requireCompleteRebind === true,
    failures,
  };
}

export function telemetryBackendStatusBlocksPass(receipt) {
  const validation = validateTelemetryBackendStatusReceipt(receipt);
  return !validation.valid || receipt.complete !== true || receipt.status !== 'complete';
}
