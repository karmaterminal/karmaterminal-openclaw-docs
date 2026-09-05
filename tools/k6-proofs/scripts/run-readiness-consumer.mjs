import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateReadinessReceipt } from './target-readiness.mjs';

const DIGEST = /^[a-f0-9]{64}$/u;
const RECEIPT_FILE = 'seat-readiness.json';

function required(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`runner metadata ${label} is required`);
  }
  return value;
}

export async function consumeRunReadiness(runDir, metadata, signingKey) {
  const context = metadata?.readiness;
  if (
    !context ||
    context.receipt !== RECEIPT_FILE ||
    !DIGEST.test(context.sha256 || '') ||
    !Array.isArray(context.selectedRows)
  ) {
    throw new Error('runner metadata readiness context is missing or invalid');
  }
  const raw = await readFile(path.join(runDir, RECEIPT_FILE))
    .catch((error) => {
      throw new Error(`seat readiness receipt is missing or unreadable: ${error.message}`);
    });
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== context.sha256) {
    throw new Error('seat readiness receipt digest mismatch');
  }
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch (error) {
    throw new Error(`seat readiness receipt is malformed JSON: ${error.message}`);
  }
  const row = required(metadata.row, 'row');
  if (!context.selectedRows.includes(row)) {
    throw new Error(`seat readiness receipt does not select row ${row}`);
  }
  const result = validateReadinessReceipt(receipt, {
    signingKey,
    candidateSha: required(metadata.candidateSha, 'candidateSha'),
    runtimeSha: required(metadata.runtimeBuildSha, 'runtimeBuildSha'),
    docsSha: required(metadata.docsRef, 'docsRef'),
    gatewayFingerprint: required(context.gatewayUrlFingerprint, 'readiness.gatewayUrlFingerprint'),
    seat: required(metadata.seat, 'seat'),
    unit: required(context.unit, 'readiness.unit'),
    rows: context.selectedRows,
    requiredDepth: required(context.requiredMaxSpawnDepth, 'readiness.requiredMaxSpawnDepth'),
    expectedDepth: required(context.expectedMaxSpawnDepth, 'readiness.expectedMaxSpawnDepth'),
  });
  if (!result.valid) {
    throw new Error(`seat readiness receipt rejected: ${result.reason}`);
  }
  return receipt;
}
