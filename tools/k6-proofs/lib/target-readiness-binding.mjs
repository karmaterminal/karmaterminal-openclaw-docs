import { createHash } from 'node:crypto';

const SHA = /^[0-9a-f]{40}$/u;
const ROW = /^[A-Z0-9][A-Z0-9._-]*$/u;
const UNIT = /^[A-Za-z0-9][A-Za-z0-9_.@:-]*$/u;

export function publicGatewayTarget(value) {
  const url = new URL(value);
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('gateway URL must use ws or wss');
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  const publicUrl = url.toString().replace(/\/$/, '');
  return {
    url: publicUrl,
    fingerprint: createHash('sha256').update(publicUrl).digest('hex'),
  };
}

export function buildTargetReadinessBinding({
  gatewayWs,
  seat,
  gatewayUnit,
  docsHead,
  candidateSha,
  runtimeBuildSha,
  selectedRows,
  requiredMaxSpawnDepth,
  expectedMaxSpawnDepth,
}) {
  const gateway = publicGatewayTarget(gatewayWs);
  return {
    gatewayUrlFingerprint: gateway.fingerprint,
    seat,
    gatewayUnit,
    docsHead: docsHead || null,
    candidateSha: candidateSha || null,
    runtimeBuildSha: runtimeBuildSha || null,
    selectedRows: [...selectedRows],
    requiredMaxSpawnDepth,
    expectedMaxSpawnDepth,
  };
}

export function targetReadinessBindingErrors(actual, expected, { requireComplete = false } = {}) {
  const errors = [];
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return ['binding-missing'];
  for (const key of [
    'gatewayUrlFingerprint',
    'seat',
    'gatewayUnit',
    'docsHead',
    'candidateSha',
    'runtimeBuildSha',
    'requiredMaxSpawnDepth',
    'expectedMaxSpawnDepth',
  ]) {
    if (actual[key] !== expected[key]) errors.push(`${key}-mismatch`);
  }
  if (
    !Array.isArray(actual.selectedRows) ||
    actual.selectedRows.length !== expected.selectedRows.length ||
    actual.selectedRows.some((row, index) => row !== expected.selectedRows[index])
  ) {
    errors.push('selectedRows-mismatch');
  }
  if (!/^[0-9a-f]{64}$/u.test(actual.gatewayUrlFingerprint || '')) errors.push('gateway-fingerprint-invalid');
  if (typeof actual.seat !== 'string' || actual.seat.length === 0) errors.push('seat-invalid');
  if (!UNIT.test(actual.gatewayUnit || '')) errors.push('gateway-unit-invalid');
  if (!Array.isArray(actual.selectedRows) || actual.selectedRows.some((row) => !ROW.test(row))) {
    errors.push('selected-rows-invalid');
  }
  if (requireComplete) {
    if (!SHA.test(actual.docsHead || '')) errors.push('docs-head-invalid');
    if (!SHA.test(actual.candidateSha || '')) errors.push('candidate-sha-invalid');
    if (!SHA.test(actual.runtimeBuildSha || '')) errors.push('runtime-build-sha-invalid');
  }
  return [...new Set(errors)];
}
