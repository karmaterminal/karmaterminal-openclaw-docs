import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseExactPnpmPackageManager, verifyPnpmLockProvenance } from './pnpm-provenance.mjs';
import { isVerifiedRrc2HonestLimitEvidence } from './request-compaction-receipt.js';

export const QUALIFICATION_SCHEMA = 'openclaw.k6.proof-harness-qualification.v1';
const SHA = /^[0-9a-f]{40}$/u;
const TERMINAL_GOOD = new Set(['PASS', 'HONEST-LIMIT']);

function failure(code, message, detail = null) {
  return { code, message, detail };
}

export function validateExactIdentities(identities) {
  const failures = [];
  for (const name of ['productSha', 'runtimeSha', 'docsSha', 'corpusSha']) {
    if (!SHA.test(identities?.[name] || '')) {
      failures.push(failure('identity.invalid', `${name} must be 40 lowercase hex characters`));
    }
  }
  for (const name of ['gatewayId', 'seat', 'sessionId', 'runId']) {
    if (typeof identities?.[name] !== 'string' || !identities[name].trim()) {
      failures.push(failure('identity.missing', `${name} is required`));
    }
  }
  try {
    const gateway = new URL(identities?.gatewayUrl || '');
    if (!['ws:', 'wss:'].includes(gateway.protocol) || !gateway.hostname) {
      failures.push(failure('gateway.url', 'gatewayUrl must be an absolute ws:// or wss:// URL'));
    }
  } catch {
    failures.push(failure('gateway.url', 'gatewayUrl must be an absolute ws:// or wss:// URL'));
  }
  return failures;
}

export function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function realDirectory(value, label) {
  if (!existsSync(value)) throw new Error(`${label} is missing`);
  const info = lstatSync(value);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a real non-symlink directory`);
  }
  return realpathSync(value);
}

export function validateWorkspace({ productDir, homeDir, pnpmVersion }) {
  const failures = [];
  try {
    const productRoot = realDirectory(productDir, 'product directory');
    const homeRoot = realDirectory(homeDir, 'HOME');
    if (!isInside(productRoot, homeRoot)) {
      failures.push(failure('workspace.outside-home', 'product checkout must be HOME-contained'));
    }
    const packageJson = JSON.parse(readFileSync(path.join(productRoot, 'package.json'), 'utf8'));
    const manager = parseExactPnpmPackageManager(packageJson.packageManager);
    if (pnpmVersion !== manager.version) {
      failures.push(failure(
        'workspace.pnpm-version',
        `active pnpm ${pnpmVersion || 'unavailable'} does not match candidate ${manager.version}`,
      ));
    }
    const candidateLock = readFileSync(path.join(productRoot, 'pnpm-lock.yaml'), 'utf8');
    const installedLockPath = path.join(productRoot, 'node_modules/.pnpm/lock.yaml');
    const installedStore = realDirectory(path.dirname(installedLockPath), 'pnpm virtual store');
    if (!isInside(installedStore, productRoot)) {
      failures.push(failure('workspace.external-virtual-store', 'pnpm virtual store escapes product checkout'));
    }
    const installedLock = readFileSync(installedLockPath, 'utf8');
    const provenance = verifyPnpmLockProvenance({
      candidateLock,
      installedLock,
      packageManager: manager,
    });
    if (!existsSync(path.join(productRoot, 'pnpm-workspace.yaml'))) {
      failures.push(failure('workspace.missing-layout', 'pnpm-workspace.yaml is missing'));
    }
    return { failures, packageManager: manager.declaration, provenance };
  } catch (error) {
    failures.push(failure('workspace.invalid', error.message || String(error)));
    return { failures, packageManager: null, provenance: null };
  }
}

export function validateEnvironmentReceipt(receipt, identities) {
  const failures = [];
  if (receipt?.gateway?.url !== identities.gatewayUrl) {
    failures.push(failure('gateway.url-mismatch', 'gateway probe URL does not match the bound gateway URL'));
  }
  if (![receipt?.gateway?.targetId, receipt?.gateway?.instanceId].includes(identities.gatewayId)) {
    failures.push(failure('gateway.identity-mismatch', 'gateway probe identity does not match the bound gateway identity'));
  }
  if (receipt?.gateway?.reachable !== true || receipt?.gateway?.configValid !== true) {
    failures.push(failure('gateway.unready', 'gateway is unreachable or its config is invalid'));
  }
  if (receipt?.gateway?.runtimeExactMatches !== true) {
    failures.push(failure('gateway.runtime-mismatch', 'gateway build identity does not match the bound runtime SHA'));
  }
  if (receipt?.observability?.diagnosticsOtelLoaded !== true) {
    failures.push(failure('observability.missing-diagnostics-otel', 'diagnostics-otel is not loaded'));
  }
  if (receipt?.observability?.tempoQueryReachable !== true) {
    failures.push(failure('observability.tempo-query', 'Tempo query surface is unreachable'));
  }
  if (receipt?.observability?.tempoIntakeReachable !== true) {
    failures.push(failure('observability.tempo-intake', 'Tempo intake surface is unreachable'));
  }
  if (receipt?.disposableSession?.id !== identities.sessionId ||
      receipt?.disposableSession?.created !== true ||
      receipt?.disposableSession?.cleaned !== true) {
    failures.push(failure('session.disposable-lifecycle', 'disposable session creation and cleanup did not both succeed'));
  }
  return failures;
}

export function validateProducerCatalog({ requiredRows, manifests, catalog, docsRoot, productRoot }) {
  const failures = [];
  const producers = {};
  const manifestByRow = new Map(manifests.map((manifest) => [manifest.rowId, manifest]));
  for (const row of requiredRows) {
    const manifest = manifestByRow.get(row);
    if (!manifest) {
      failures.push(failure('producer.missing-manifest', `${row} has no row manifest`, { row }));
      continue;
    }
    const special = catalog?.rows?.[row];
    const scenarioFile = manifest.scenario?.file || `${manifest.scenario?.name || ''}.js`;
    const isStaticConsumer = scenarioFile === 'static-corpus-row-validator.js';
    const isDirectProducer =
      manifest.scenario?.status === 'runnable' &&
      manifest.liveRunSafety?.classification === 'k6-runnable' &&
      !isStaticConsumer;
    if (special) {
      if (typeof special.command !== 'string' || !special.command.trim()) {
        failures.push(failure('producer.absent', `${row} has no explicit producer command`, { row }));
        continue;
      }
      const missingDocsPaths = (special.requiredPaths || [])
        .filter((entry) => !existsSync(path.join(docsRoot, entry)));
      const missingProductPaths = (special.requiredProductPaths || [])
        .filter((entry) => !existsSync(path.join(productRoot, entry)));
      if (missingDocsPaths.length || missingProductPaths.length || special.reviewed !== true) {
        failures.push(failure('producer.unavailable', `${row} producer is not reviewed and present`, {
          row,
          reviewed: special.reviewed === true,
          missingDocsPaths,
          missingProductPaths,
        }));
      }
      producers[row] = {
        kind: special.kind,
        command: special.command,
        reviewed: special.reviewed === true && missingDocsPaths.length === 0 && missingProductPaths.length === 0,
        dependsOn: special.dependsOn || [],
        requiresLiveTrace: special.requiresLiveTrace === true,
      };
      continue;
    }
    if (isDirectProducer) {
      const scenarioPath = path.join(docsRoot, 'tools/k6-proofs/scenarios', scenarioFile);
      if (!existsSync(scenarioPath)) {
        failures.push(failure('producer.missing-scenario', `${row} runnable scenario is missing`, { row, scenarioFile }));
      }
      producers[row] = {
        kind: 'harness-live',
        command: `./tools/k6-proofs/scripts/run-proofs.sh --live --docs-ref "$APPROVED_DOCS_SHA" ${row} "$FINAL_SUCCESSOR_SHA"`,
        reviewed: existsSync(scenarioPath),
        dependsOn: [],
      };
      continue;
    }
    failures.push(failure('producer.absent', `${row} has neither a live producer nor an explicit process-local command`, { row }));
  }
  return { failures, producers };
}

function producerReceiptPayload(receipt) {
  return JSON.stringify({
    row: receipt?.row,
    runId: receipt?.runId,
    sessionId: receipt?.sessionId,
    productSha: receipt?.productSha,
    runtimeSha: receipt?.runtimeSha,
    docsSha: receipt?.docsSha,
    corpusSha: receipt?.corpusSha,
    seat: receipt?.seat,
    verdict: receipt?.verdict,
    consumptionState: receipt?.consumptionState,
    issuedAt: receipt?.issuedAt,
    expiresAt: receipt?.expiresAt,
  });
}

export function signProducerReceipt(receipt, signingKey) {
  return createHmac('sha256', signingKey)
    .update(producerReceiptPayload(receipt))
    .digest('hex');
}

export function validateProducerReceipt(receipt, expected, { signingKey, now = Date.now() } = {}) {
  const failures = [];
  for (const key of ['row', 'runId', 'sessionId', 'productSha', 'runtimeSha', 'docsSha', 'corpusSha', 'seat']) {
    if (receipt?.[key] !== expected?.[key]) {
      failures.push(failure('receipt.binding-mismatch', `producer receipt ${key} mismatch`, { key }));
    }
  }
  if (receipt?.verdict !== 'PASS') failures.push(failure('receipt.non-pass', 'producer receipt verdict must be PASS'));
  const suppliedDigest = receipt?.signatureDigest || '';
  const expectedDigest = signingKey ? signProducerReceipt(receipt, signingKey) : '';
  const signatureValid = /^[0-9a-f]{64}$/u.test(suppliedDigest) &&
    /^[0-9a-f]{64}$/u.test(expectedDigest) &&
    timingSafeEqual(Buffer.from(suppliedDigest, 'hex'), Buffer.from(expectedDigest, 'hex'));
  if (receipt?.signed !== true || !signatureValid) {
    failures.push(failure('receipt.unsigned', 'producer receipt HMAC is missing or invalid'));
  }
  if (receipt?.consumptionState !== 'fresh') {
    failures.push(failure('receipt.consumed', 'producer receipt must be fresh and unconsumed'));
  }
  const issuedAt = Date.parse(receipt?.issuedAt || '');
  const expiresAt = Date.parse(receipt?.expiresAt || '');
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) ||
      issuedAt > now || expiresAt <= now || expiresAt <= issuedAt) {
    failures.push(failure('receipt.stale', 'producer receipt validity window is missing, expired, or invalid'));
  }
  return failures;
}

export function validateConsumerDependencies({ row, producers, receipts, identities, signingKey, now }) {
  const failures = [];
  for (const dependency of producers?.[row]?.dependsOn || []) {
    const matches = receipts.filter((receipt) => receipt?.row === dependency);
    if (matches.length !== 1) {
      failures.push(failure('dependency.ambiguous', `${row} requires exactly one ${dependency} receipt`, {
        row,
        dependency,
        found: matches.length,
      }));
      continue;
    }
    failures.push(...validateProducerReceipt(matches[0], {
      row: dependency,
      runId: identities.runId,
      sessionId: identities.sessionId,
      productSha: identities.productSha,
      runtimeSha: identities.runtimeSha,
      docsSha: identities.docsSha,
      corpusSha: identities.corpusSha,
      seat: identities.seat,
    }, { signingKey, now }));
  }
  return failures;
}

export function validateTerminalRollup(rows, requiredRows = null) {
  const failures = [];
  if (!Array.isArray(rows)) {
    return [failure('rollup.invalid', 'terminal rollup rows must be an array')];
  }
  if (requiredRows) {
    const counts = new Map();
    for (const row of rows) counts.set(row?.row, (counts.get(row?.row) || 0) + 1);
    for (const required of requiredRows) {
      if (counts.get(required) !== 1) {
        failures.push(failure('rollup.row-set', `${required} must appear exactly once in the terminal rollup`, { row: required }));
      }
    }
    for (const row of counts.keys()) {
      if (!requiredRows.includes(row)) {
        failures.push(failure('rollup.unexpected-row', `${row || '<missing>'} is not a required row`, { row }));
      }
    }
  }
  for (const row of rows) {
    const verdict = String(row?.verdict || '').toUpperCase().replace(/-CANDIDATE$/u, '');
    if (!TERMINAL_GOOD.has(verdict)) {
      failures.push(failure('rollup.non-pass', `${row?.row || 'unknown row'} is ${verdict || 'MISSING'}`, {
        row: row?.row || null,
        verdict: verdict || 'MISSING',
      }));
      continue;
    }
    if (verdict === 'HONEST-LIMIT') {
      const valid = row?.row === 'R-RC-2' && isVerifiedRrc2HonestLimitEvidence(row?.evidence);
      if (!valid) {
        failures.push(failure('rollup.invalid-honest-limit', 'R-RC-2 HONEST-LIMIT lacks its numeric receipt authority'));
      }
    }
  }
  return failures;
}

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function classifyManagedFlows({ inventory, identities, nowMs = Date.now() }) {
  const failures = [];
  const flows = Array.isArray(inventory?.flows) ? inventory.flows : [];
  if (!Array.isArray(inventory?.flows)) {
    failures.push(failure('flows.invalid-inventory', 'managed-flow inventory must contain a flows array'));
  }
  const publicInventory = [];
  for (const flow of flows) {
    if (flow?.syncMode !== 'managed') continue;
    const label = `${flow?.goal || ''} ${flow?.stateJson?.task || ''}`;
    const row = label.match(/\bR-[A-Z0-9-]+\b/u)?.[0] || null;
    const managed = row !== null || /\b(?:k6|proof|post-compaction lifeboat)\b/iu.test(label) ||
      /\bproof\b/iu.test(String(flow?.controllerId || '')) ||
      flow?.ownerKey === identities.sessionId;
    if (!managed) continue;
    const updatedAt = Number(flow?.updatedAt);
    const active = Number(flow?.taskSummary?.active);
    const total = Number(flow?.taskSummary?.total);
    const bound =
      flow?.stateJson?.proofRunId === identities.runId &&
      flow?.stateJson?.proofSessionId === identities.sessionId &&
      flow?.stateJson?.productSha === identities.productSha &&
      flow?.stateJson?.runtimeSha === identities.runtimeSha &&
      flow?.stateJson?.docsSha === identities.docsSha &&
      flow?.stateJson?.corpusSha === identities.corpusSha &&
      flow?.stateJson?.seat === identities.seat;
    const contaminating =
      ['queued', 'running'].includes(flow?.status) &&
      (!bound || active > 0 || total > 0);
    publicInventory.push({
      flowFingerprint: fingerprint(flow?.flowId || 'missing'),
      ownerFingerprint: fingerprint(flow?.ownerKey || 'missing'),
      controller: typeof flow?.controllerId === 'string' ? flow.controllerId : null,
      row,
      status: typeof flow?.status === 'string' ? flow.status : null,
      ageSeconds: Number.isFinite(updatedAt) ? Math.max(0, Math.floor((nowMs - updatedAt) / 1000)) : null,
      active: Number.isFinite(active) ? active : null,
      total: Number.isFinite(total) ? total : null,
      namespace: bound ? 'current' : 'historical-or-unbound',
      contaminating,
    });
    if (contaminating) {
      failures.push(failure('flows.contamination', `${row || 'unlabeled'} managed flow can contaminate the proof namespace`, {
        row,
        flowFingerprint: fingerprint(flow?.flowId || 'missing'),
      }));
    }
  }
  return { failures, inventory: publicInventory };
}

export function runHostileControls() {
  const sha = 'a'.repeat(40);
  const signingKey = Buffer.from('qualification-hostile-control-key');
  const now = Date.parse('2026-09-04T00:00:00Z');
  const identities = {
    productSha: sha,
    runtimeSha: sha,
    docsSha: sha,
    corpusSha: sha,
    gatewayId: 'gateway-a',
    gatewayUrl: 'ws://127.0.0.1:18789',
    seat: 'seat-a',
    sessionId: 'session-a',
    runId: 'run-a',
  };
  const receipt = {
    row: 'PRODUCER',
    runId: 'run-a',
    sessionId: 'session-a',
    productSha: sha,
    runtimeSha: sha,
    docsSha: sha,
    corpusSha: sha,
    seat: 'seat-a',
    verdict: 'PASS',
    signed: true,
    consumptionState: 'fresh',
    issuedAt: '2026-09-03T23:00:00Z',
    expiresAt: '2026-09-04T01:00:00Z',
  };
  receipt.signatureDigest = signProducerReceipt(receipt, signingKey);
  const expectedBinding = {
    row: receipt.row,
    runId: receipt.runId,
    sessionId: receipt.sessionId,
    productSha: receipt.productSha,
    runtimeSha: receipt.runtimeSha,
    docsSha: receipt.docsSha,
    corpusSha: receipt.corpusSha,
    seat: receipt.seat,
  };
  const controls = [
    ['malformed-sha', validateExactIdentities({ ...identities, productSha: 'short' }).length > 0],
    ['null-numeric', validateTerminalRollup([{ row: 'R-RC-2', verdict: 'HONEST-LIMIT', evidence: { context_usage: null } }]).length > 0],
    ['wrong-row-receipt', validateProducerReceipt({ ...receipt, row: 'OTHER' }, expectedBinding, { signingKey, now }).length > 0],
    ['cross-run-receipt', validateProducerReceipt({ ...receipt, runId: 'run-old' }, expectedBinding, { signingKey, now }).length > 0],
    ['cross-session-receipt', validateProducerReceipt({ ...receipt, sessionId: 'session-old' }, expectedBinding, { signingKey, now }).length > 0],
    ['cross-sha-receipt', validateProducerReceipt({ ...receipt, productSha: 'c'.repeat(40) }, expectedBinding, { signingKey, now }).length > 0],
    ['stale-receipt', validateProducerReceipt({ ...receipt, expiresAt: '2026-09-03T23:30:00Z' }, expectedBinding, { signingKey, now }).length > 0],
    ['consumed-receipt', validateProducerReceipt({ ...receipt, consumptionState: 'consumed' }, expectedBinding, { signingKey, now }).length > 0],
    ['unsigned-receipt', validateProducerReceipt({ ...receipt, signed: false }, expectedBinding, { signingKey, now }).length > 0],
    ['partial-rollup', validateTerminalRollup([{ row: 'R-CW-1', verdict: 'PARTIAL' }]).length > 0],
    ['legacy-seat-label-not-gate', !Object.hasOwn(identities, 'allocationLabel')],
    ['stale-flow', classifyManagedFlows({
      inventory: { flows: [{
        flowId: 'old-flow',
        ownerKey: 'old-session',
        syncMode: 'managed',
        controllerId: 'core/continuation-delegate',
        status: 'queued',
        goal: 'R-CD-3 post-compaction lifeboat',
        updatedAt: 1,
        taskSummary: { active: 0, total: 0 },
        stateJson: {},
      }] },
      identities,
      nowMs: 2,
    }).failures.length > 0],
  ];
  return {
    ok: controls.every(([, rejected]) => rejected),
    controls: controls.map(([name, rejected]) => ({ name, rejected })),
  };
}
