import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildTelemetryBackendStatusReceipt,
  validateTelemetryBackendStatusReceipt,
} from '../../lib/telemetry-backend-status.js';

export function fingerprintTelemetryQuery(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

async function readExisting(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`backend-status.json is unreadable: ${error.message}`);
  }
}

function sameArray(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function assertIdentity(receipt, context) {
  for (const field of ['rowId', 'candidateSha', 'seat', 'proofRunId']) {
    if ((receipt[field] ?? null) !== (context[field] ?? null)) {
      throw new Error(`backend-status identity mismatch for ${field}`);
    }
  }
  if (!sameArray(receipt.requiredCompletenessKeys, context.requiredCompletenessKeys)) {
    throw new Error('backend-status required completeness keys changed mid-run');
  }
  if (!sameArray(receipt.rebind?.declaredKeys, context.rebindKeys)) {
    throw new Error('backend-status rebind keys changed mid-run');
  }
}

async function atomicWrite(file, receipt) {
  const validation = validateTelemetryBackendStatusReceipt(receipt);
  if (!validation.valid) {
    throw new Error(`refusing invalid backend-status receipt: ${validation.failures.join('; ')}`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

function mergedRebindValues(existing, context) {
  return {
    ...(existing?.rebind?.values || {}),
    ...(context.rebindValues || {}),
  };
}

export async function readTelemetryBackendStatus(file, expected = {}) {
  const receipt = await readExisting(file);
  if (!receipt) return null;
  const validation = validateTelemetryBackendStatusReceipt(receipt, expected);
  if (!validation.valid) {
    throw new Error(`backend-status.json is invalid: ${validation.failures.join('; ')}`);
  }
  return receipt;
}

export async function ensureTelemetryBackendStatus(file, context) {
  const existing = await readExisting(file);
  if (existing) {
    const validation = validateTelemetryBackendStatusReceipt(existing);
    if (!validation.valid) {
      throw new Error(`backend-status.json is invalid: ${validation.failures.join('; ')}`);
    }
    assertIdentity(existing, context);
    return existing;
  }
  const receipt = buildTelemetryBackendStatusReceipt({
    ...context,
    interactions: [],
  });
  await atomicWrite(file, receipt);
  return receipt;
}

export async function recordTelemetryBackendInteraction(file, context, interaction) {
  const existing = await readExisting(file);
  if (existing) {
    const validation = validateTelemetryBackendStatusReceipt(existing);
    if (!validation.valid) {
      throw new Error(`backend-status.json is invalid: ${validation.failures.join('; ')}`);
    }
    assertIdentity(existing, context);
  }
  const receipt = buildTelemetryBackendStatusReceipt({
    ...context,
    interactions: [...(existing?.interactions || []), interaction],
    rebindValues: mergedRebindValues(existing, context),
  });
  await atomicWrite(file, receipt);
  return receipt;
}

export async function finalizeTelemetryBackendStatus(file, context) {
  const existing = await ensureTelemetryBackendStatus(file, context);
  assertIdentity(existing, context);
  const receipt = buildTelemetryBackendStatusReceipt({
    ...context,
    interactions: existing.interactions,
    rebindValues: mergedRebindValues(existing, context),
  });
  await atomicWrite(file, receipt);
  return receipt;
}
