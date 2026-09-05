import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DEPENDENCY_RECEIPT_SCHEMA, REQUIRED_PRODUCT_SHA, validateProducerReceipt } from './producer-receipt.mjs';

export const PRODUCER_CLASSIFICATIONS = new Set([
  'behavioral-live',
  'process-local',
  'static-only',
  'construct-only',
  'dependency-gated',
]);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadProducerCatalog(proofsDir) {
  return readJson(path.join(proofsDir, 'qualification/producer-catalog.json'));
}

export function loadRowManifests(proofsDir) {
  const directory = path.join(proofsDir, 'manifests');
  return readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({ file, manifest: readJson(path.join(directory, file)) }));
}

function inferredClassification(manifest, catalog) {
  if (manifest.scenario?.status === 'construct-only') return 'construct-only';
  if (manifest.scenario?.file === 'static-corpus-row-validator.js') return 'static-only';
  return catalog.defaults?.[manifest.liveRunSafety?.classification] || null;
}

export function buildProducerRegistry({ proofsDir, catalog = loadProducerCatalog(proofsDir) }) {
  const failures = [];
  if (catalog.requiredProductSha !== REQUIRED_PRODUCT_SHA) {
    failures.push({ code: 'producer.product-sha', message: 'catalog must bind the required product SHA' });
  }
  const manifestEntries = loadRowManifests(proofsDir);
  const manifestByRow = new Map(
    manifestEntries.map(({ file, manifest }) => [manifest.rowId, { file, manifest }]),
  );
  const rowIds = new Set([...manifestByRow.keys(), ...Object.keys(catalog.rows || {})]);
  const rows = {};

  for (const rowId of [...rowIds].sort()) {
    const manifestEntry = manifestByRow.get(rowId) || null;
    const override = catalog.rows?.[rowId] || {};
    const classification = override.classification ||
      (manifestEntry ? inferredClassification(manifestEntry.manifest, catalog) : null);
    if (!PRODUCER_CLASSIFICATIONS.has(classification)) {
      failures.push({
        code: 'producer.classification-missing',
        rowId,
        message: `${rowId} has no producer classification`,
      });
      continue;
    }

    const scenario = override.scenario || manifestEntry?.manifest.scenario?.file || null;
    if (classification === 'behavioral-live') {
      if (!manifestEntry ||
          manifestEntry.manifest.scenario?.status !== 'runnable' ||
          manifestEntry.manifest.liveRunSafety?.classification !== 'k6-runnable') {
        failures.push({
          code: 'producer.behavioral-not-runnable',
          rowId,
          message: `${rowId} behavioral producer is not declared runnable and k6-runnable`,
        });
      } else if (!scenario || scenario === 'static-corpus-row-validator.js') {
        failures.push({
          code: 'producer.behavioral-static-only',
          rowId,
          message: `${rowId} requires a behavioral producer, not a static validator`,
        });
      } else if (!existsSync(path.join(proofsDir, 'scenarios', scenario))) {
        failures.push({
          code: 'producer.scenario-missing',
          rowId,
          message: `${rowId} producer scenario is missing: ${scenario}`,
        });
      }
    }
    if (classification === 'process-local' && !Array.isArray(override.argv)) {
      failures.push({
        code: 'producer.command-missing',
        rowId,
        message: `${rowId} process-local producer has no argv`,
      });
    }
    if (override.prerequisite && !Array.isArray(override.prerequisite.argv)) {
      failures.push({
        code: 'producer.prerequisite-command-missing',
        rowId,
        message: `${rowId} process-local prerequisite has no argv`,
      });
    }
    if (catalog.requiredBehavioralRows?.includes(rowId) &&
        !['behavioral-live', 'process-local'].includes(classification)) {
      failures.push({
        code: 'producer.required-behavioral-missing',
        rowId,
        message: `${rowId} is required behavioral coverage but is ${classification}`,
      });
    }
    rows[rowId] = {
      rowId,
      classification,
      manifest: manifestEntry?.file || null,
      scenario,
      argv: override.argv || null,
      prerequisite: override.prerequisite || null,
      requiresLiveTrace: override.requiresLiveTrace === true,
      dependsOn: override.dependsOn || [],
      blockedBy: override.blockedBy || null,
    };
  }
  for (const rowId of catalog.requiredBehavioralRows || []) {
    if (!rows[rowId]) {
      failures.push({
        code: 'producer.required-behavioral-missing',
        rowId,
        message: `${rowId} is required behavioral coverage but has no catalog or manifest entry`,
      });
    }
  }
  return { schema: catalog.schema, rows, failures };
}

function topologicalRows(rowIds, registry) {
  const selected = new Set(rowIds);
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  const failures = [];

  function visit(rowId) {
    if (visited.has(rowId)) return;
    if (visiting.has(rowId)) {
      failures.push({
        code: 'producer.dependency-cycle',
        rowId,
        message: `dependency cycle includes ${rowId}`,
      });
      return;
    }
    visiting.add(rowId);
    for (const dependency of registry.rows[rowId]?.dependsOn || []) {
      if (!registry.rows[dependency]) {
        failures.push({
          code: 'producer.dependency-missing',
          rowId,
          dependency,
          message: `${rowId} depends on unknown row ${dependency}`,
        });
        continue;
      }
      if (selected.has(dependency)) visit(dependency);
    }
    visiting.delete(rowId);
    visited.add(rowId);
    ordered.push(rowId);
  }
  for (const rowId of rowIds) visit(rowId);
  return { ordered, failures };
}

export function resolveProducerPlan({
  selection,
  registry,
  receipts = [],
  candidateSha = '',
  docsSha = '',
  runId = '',
  trustedIssuers = {},
  nowMs = Date.now(),
}) {
  let rowIds;
  if (selection === 'all') {
    rowIds = Object.keys(registry.rows);
  } else if (selection === 'live-suite') {
    rowIds = Object.values(registry.rows)
      .filter((row) => ['behavioral-live', 'process-local', 'dependency-gated'].includes(row.classification))
      .map((row) => row.rowId);
  } else {
    rowIds = selection.split(',').map((row) => row.trim().toUpperCase()).filter(Boolean);
  }

  const failures = [...registry.failures];
  const validReceipts = new Map();
  const seenRows = new Set();
  const seenIds = new Set();
  const seenEvidence = new Set();
  for (const receipt of receipts) {
    const rowId = receipt?.rowId;
    if (seenRows.has(rowId) || seenIds.has(receipt?.receiptId) ||
        seenEvidence.has(receipt?.producerEvidenceId) ||
        !registry.rows[rowId] || !validateProducerReceipt(receipt, {
          schema: DEPENDENCY_RECEIPT_SCHEMA, rowId, candidateSha, docsSha,
          runId, trustedIssuers, nowMs,
        })) {
      failures.push({ code: 'producer.receipt-invalid', message: 'untrusted, stale, replayed or duplicate dependency receipt' });
    } else {
      validReceipts.set(rowId, receipt);
    }
    seenRows.add(rowId);
    seenIds.add(receipt?.receiptId);
    seenEvidence.add(receipt?.producerEvidenceId);
  }
  // A hostile member invalidates the entire bundle, not only its row.
  if (failures.some((failure) => failure.code === 'producer.receipt-invalid')) validReceipts.clear();
  for (const rowId of rowIds) {
    if (!registry.rows[rowId]) {
      failures.push({
        code: 'producer.row-unknown',
        rowId,
        message: `unknown producer row ${rowId}`,
      });
    }
  }
  const knownRows = rowIds.filter((rowId) => registry.rows[rowId]);
  const topology = topologicalRows(knownRows, registry);
  failures.push(...topology.failures);
  const rows = topology.ordered.map((rowId) => {
    const row = registry.rows[rowId];
    const ownReceiptSatisfied = validReceipts.has(rowId);
    const missingDependencies = row.dependsOn.filter((dependency) => (
      !validReceipts.has(dependency)
    ));
    const blocked = row.classification === 'dependency-gated' &&
      (!ownReceiptSatisfied || missingDependencies.length > 0);
    return { ...row, ownReceiptSatisfied, missingDependencies, blocked };
  });
  return {
    schema: 'openclaw.k6.producer-plan.v1',
    selection,
    classifications: Object.fromEntries(
      [...PRODUCER_CLASSIFICATIONS].map((classification) => [
        classification,
        rows.filter((row) => row.classification === classification).map((row) => row.rowId),
      ]),
    ),
    rows,
    failures,
    blocked: rows.filter((row) => row.blocked).map((row) => ({
      rowId: row.rowId,
      blockedBy: row.blockedBy,
      missingDependencies: row.missingDependencies,
    })),
    ok: failures.length === 0 && rows.every((row) => !row.blocked),
  };
}

export function expandProducerArgv(argv, values) {
  const replacements = {
    FINAL_PRODUCT_CHECKOUT: values.productDir,
    FINAL_SUCCESSOR_SHA: values.candidateSha,
    ROW_ARTIFACT_DIR: values.artifactDir,
  };
  return argv.map((argument) => String(argument).replace(
    /\$\{([A-Z_]+)\}/gu,
    (_, name) => replacements[name] || '',
  ));
}
