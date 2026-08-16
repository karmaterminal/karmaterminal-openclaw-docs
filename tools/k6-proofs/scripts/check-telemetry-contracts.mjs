#!/usr/bin/env node
/**
 * check-telemetry-contracts.mjs — row telemetry rebind contract check
 * (karmaterminal/openclaw#1254).
 *
 * The continuation telemetry census established that a proof row can execute
 * real behavior and still be impossible to rebind afterwards:
 *
 *   - accepted continuation entry spans omit origin/session/turn identity, so
 *     typed-tool spans and accepted-entry spans cannot be causally joined;
 *   - proof/k6 traffic carries no durable resource/trace marker, so it cannot
 *     be excluded from a fleet census honestly;
 *   - there is no canonical zero-payload/finalization outcome span, only log
 *     strings that are heuristics;
 *   - a degraded telemetry backend can answer 200 with zero results, which is
 *     not evidence of absence.
 *
 * This validator refuses to let a manifest paper over any of that. A row whose
 * required receipts depend on telemetry must declare `telemetryContract`, and a
 * row may only claim a telemetry-rebindable PASS when every identity marker
 * (origin, session, turn, run) and the proof-run marker are declared as
 * actually emitted by the product.
 *
 * The repository root comes from the shared repo-root contract, so running this
 * from the repository root, from tools/k6-proofs, and from
 * tools/k6-proofs/scripts inspects the same files.
 */
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

export const TELEMETRY_CONTRACT_SCHEMA = 'openclaw.k6.row-telemetry-contract.v1';

/**
 * Receipts whose evidence is telemetry. When one of these is a *required*
 * receipt the row's verdict rests on telemetry, so the row must state what it
 * expects the product to emit and what it does when the backend degrades.
 */
export const TELEMETRY_RECEIPTS = new Set([
  'trace-id',
  'tempo-trace-json',
  'continuation-trace-correlation',
  'trace-or-session-correlation',
  'reason-telemetry-redaction-review',
]);

/** Identity markers an independent observer needs to rebind an entry span. */
export const IDENTITY_PURPOSES = ['origin', 'session', 'turn', 'run'];

/** The cross-cutting census concerns; each is owned by exactly one remedy row. */
export const REMEDY_CONCERNS = [
  'origin-provenance',
  'proof-run-classification',
  'terminal-outcome',
  'backend-disposition',
];

const CENSUS_ISSUE = 'karmaterminal/openclaw#1254';
const CENSUS_REPORT_COMMIT = '39803b297bd4786db3971eb82a3a7fd0b29bc643';
const CENSUS_PRODUCT_BASIS = '6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955';
const PASS_SCOPES = new Set(['behavioral-only', 'behavioral-and-telemetry-rebindable']);
const BACKEND_DISPOSITIONS = new Set(['PARTIAL-candidate', 'FAIL-candidate']);
const ENFORCEMENTS = new Set(['advisory', 'blocking']);

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate one manifest's telemetry contract.
 *
 * Exported so tests can drive the rules directly with fixture manifests rather
 * than only through the catalog on disk.
 *
 * @param {object} manifest parsed row manifest
 * @param {{file?: string, knownRowIds?: Set<string>}} [options]
 * @returns {string[]} failure strings (empty when the manifest is compliant)
 */
export function validateTelemetryContract(manifest, { file = manifest?.rowId || 'manifest', knownRowIds = null } = {}) {
  const failures = [];
  const fail = (message) => failures.push(`${file}: ${message}`);

  const requiredReceipts = manifest?.liveRunSafety?.requiredReceipts;
  const requiredTelemetryReceipts = Array.isArray(requiredReceipts)
    ? requiredReceipts.filter((name) => TELEMETRY_RECEIPTS.has(name))
    : [];
  const contract = manifest?.telemetryContract;

  if (!contract) {
    if (requiredTelemetryReceipts.length) {
      fail(
        `liveRunSafety.requiredReceipts includes telemetry receipt(s) ${requiredTelemetryReceipts.join(', ')} ` +
        `but the manifest declares no telemetryContract (${CENSUS_ISSUE})`,
      );
    }
    return failures;
  }

  if (contract.schema !== TELEMETRY_CONTRACT_SCHEMA) {
    fail(`telemetryContract.schema must be ${TELEMETRY_CONTRACT_SCHEMA}`);
    return failures;
  }

  const census = contract.census || {};
  if (census.issue !== CENSUS_ISSUE) fail(`telemetryContract.census.issue must be ${CENSUS_ISSUE}`);
  if (census.reportCommit !== CENSUS_REPORT_COMMIT) {
    fail(`telemetryContract.census.reportCommit must be the census commit ${CENSUS_REPORT_COMMIT}`);
  }
  if (census.productBasis !== CENSUS_PRODUCT_BASIS) {
    fail(`telemetryContract.census.productBasis must be the exact product basis ${CENSUS_PRODUCT_BASIS}`);
  }

  if (!ENFORCEMENTS.has(contract.enforcement)) {
    fail(`telemetryContract.enforcement must be one of ${[...ENFORCEMENTS].join(', ')}`);
  }
  if (typeof contract.rebindable !== 'boolean') fail('telemetryContract.rebindable must be boolean');
  if (typeof contract.productInstrumentationPrerequisite !== 'boolean') {
    fail('telemetryContract.productInstrumentationPrerequisite must be boolean');
  }

  const spans = contract.expectedTelemetry?.spans;
  const attributes = contract.expectedTelemetry?.attributes;
  if (!Array.isArray(spans) || spans.length === 0) {
    fail('telemetryContract.expectedTelemetry.spans must be non-empty');
  }
  if (!Array.isArray(attributes) || attributes.length === 0) {
    fail('telemetryContract.expectedTelemetry.attributes must be non-empty');
  }

  const attributeList = Array.isArray(attributes) ? attributes : [];
  const spanList = Array.isArray(spans) ? spans : [];

  // An attribute or span the product does not emit yet must name the product
  // issue that will emit it. Otherwise the gap is invisible to a later reader.
  for (const attribute of attributeList) {
    if (!nonEmptyString(attribute?.key)) fail('telemetryContract attribute entries require a key');
    if (attribute?.emittedByProduct === false && !nonEmptyString(attribute?.productIssue)) {
      fail(`telemetryContract attribute '${attribute?.key}' is not emitted by the product and must name productIssue`);
    }
  }
  for (const span of spanList) {
    if (!nonEmptyString(span?.name)) fail('telemetryContract span entries require a name');
    if (span?.emittedByProduct === false && !nonEmptyString(span?.productIssue)) {
      fail(`telemetryContract span '${span?.name}' is not emitted by the product and must name productIssue`);
    }
  }

  const purposeEmitted = new Map();
  for (const attribute of attributeList) {
    if (!nonEmptyString(attribute?.purpose)) continue;
    const emitted = attribute.emittedByProduct === true;
    purposeEmitted.set(attribute.purpose, (purposeEmitted.get(attribute.purpose) ?? false) || emitted);
  }

  const missingIdentity = IDENTITY_PURPOSES.filter((purpose) => purposeEmitted.get(purpose) !== true);
  const proofRunEmitted = purposeEmitted.get('proof-run') === true;

  // The census gate: no origin/session/turn identity and no proof-run marker
  // means no honest telemetry-rebindable claim, so no PASS may rest on one.
  if (contract.rebindable === true) {
    if (missingIdentity.length) {
      fail(
        `telemetryContract.rebindable=true requires product-emitted identity attributes for ${missingIdentity.join(', ')}`,
      );
    }
    if (!proofRunEmitted) {
      fail('telemetryContract.rebindable=true requires a product-emitted proof-run marker attribute');
    }
    if (contract.productInstrumentationPrerequisite === true) {
      fail('telemetryContract.rebindable=true cannot be paired with productInstrumentationPrerequisite=true');
    }
  }

  if (contract.productInstrumentationPrerequisite === true) {
    if (contract.rebindable === true) {
      fail('telemetryContract.productInstrumentationPrerequisite=true requires rebindable=false');
    }
    if (!nonEmptyArray(contract.prerequisiteRows)) {
      fail('telemetryContract.productInstrumentationPrerequisite=true requires a non-empty prerequisiteRows list');
    } else if (knownRowIds) {
      for (const rowId of contract.prerequisiteRows) {
        if (!knownRowIds.has(rowId)) {
          fail(`telemetryContract.prerequisiteRows references unknown row '${rowId}'`);
        }
        if (rowId === manifest.rowId) {
          fail('telemetryContract.prerequisiteRows must not reference the row itself');
        }
      }
    }
  }

  const redaction = contract.redaction || {};
  if (!nonEmptyString(redaction.rule)) fail('telemetryContract.redaction.rule must be a non-empty string');
  if (!nonEmptyArray(redaction.forbiddenInArtifacts)) {
    fail('telemetryContract.redaction.forbiddenInArtifacts must be non-empty');
  }

  const controls = contract.controls || {};
  if (!nonEmptyString(controls.positive)) fail('telemetryContract.controls.positive must be a non-empty string');
  if (!nonEmptyString(controls.negative)) fail('telemetryContract.controls.negative must be a non-empty string');

  const backend = contract.backendUnavailable || {};
  if (!BACKEND_DISPOSITIONS.has(backend.disposition)) {
    fail(`telemetryContract.backendUnavailable.disposition must be one of ${[...BACKEND_DISPOSITIONS].join(', ')}`);
  }
  if (backend.treatZeroAsAbsence !== false) {
    fail('telemetryContract.backendUnavailable.treatZeroAsAbsence must be false; a degraded backend answering zero is not absence');
  }
  if (!nonEmptyArray(backend.requiredCompletenessKeys)) {
    fail('telemetryContract.backendUnavailable.requiredCompletenessKeys must be non-empty');
  }
  if (!nonEmptyArray(backend.rebindKeys)) {
    fail('telemetryContract.backendUnavailable.rebindKeys must be non-empty');
  }

  const artifact = contract.artifact || {};
  if (!nonEmptyString(artifact.schema)) fail('telemetryContract.artifact.schema must be a non-empty string');
  if (!nonEmptyArray(artifact.requiredFiles)) fail('telemetryContract.artifact.requiredFiles must be non-empty');

  const verdict = contract.verdictAuthority || {};
  if (!PASS_SCOPES.has(verdict.passScope)) {
    fail(`telemetryContract.verdictAuthority.passScope must be one of ${[...PASS_SCOPES].join(', ')}`);
  }
  for (const key of ['pass', 'partial', 'fail']) {
    if (!nonEmptyString(verdict[key])) fail(`telemetryContract.verdictAuthority.${key} must be a non-empty string`);
  }
  if (verdict.passScope === 'behavioral-and-telemetry-rebindable' && contract.rebindable !== true) {
    fail('telemetryContract.verdictAuthority.passScope=behavioral-and-telemetry-rebindable requires rebindable=true');
  }

  const execution = contract.execution || {};
  for (const key of ['deterministicK6', 'manual', 'relationship']) {
    if (!nonEmptyString(execution[key])) fail(`telemetryContract.execution.${key} must be a non-empty string`);
  }

  const expectedReceiptNames = new Set((manifest.expectedReceipts || []).map((receipt) => receipt?.name));
  const claimsRebindablePass =
    contract.rebindable === true || verdict.passScope === 'behavioral-and-telemetry-rebindable';

  // A telemetry-rebindable claim must be enforceable at run time, not merely
  // declared. Without blocking enforcement and a concrete receipt list the
  // post-processor has nothing to withhold a PASS on.
  if (claimsRebindablePass && contract.enforcement !== 'blocking') {
    fail('a telemetry-rebindable claim (rebindable=true or passScope=behavioral-and-telemetry-rebindable) requires telemetryContract.enforcement=blocking');
  }
  if (claimsRebindablePass && !nonEmptyArray(contract.rebindReceipts)) {
    fail('a telemetry-rebindable claim requires a non-empty telemetryContract.rebindReceipts list');
  }

  if (contract.enforcement === 'blocking') {
    if (!nonEmptyArray(contract.rebindReceipts)) {
      fail('telemetryContract.enforcement=blocking requires a non-empty rebindReceipts list');
    } else {
      for (const receiptName of contract.rebindReceipts) {
        if (!expectedReceiptNames.has(receiptName)) {
          fail(`telemetryContract.rebindReceipts references '${receiptName}' but expectedReceipts has no matching receipt`);
        }
      }
    }
  } else if (contract.rebindReceipts !== undefined && !nonEmptyArray(contract.rebindReceipts)) {
    fail('telemetryContract.rebindReceipts must be a non-empty string array when present');
  }

  // The two required-receipt lists must agree about any telemetry receipt.
  // `liveRunSafety.requiredReceipts` is what pulls a row into this contract,
  // while `expectedReceipts[].required` is what the post-processor judges, so a
  // disagreement lets a row declare a receipt required and be graded as if it
  // were optional.
  const liveRequired = new Set(Array.isArray(requiredReceipts) ? requiredReceipts : []);
  for (const receipt of manifest.expectedReceipts || []) {
    if (!receipt || !TELEMETRY_RECEIPTS.has(receipt.name)) continue;
    if (liveRequired.has(receipt.name) && receipt.required !== true) {
      fail(
        `receipt '${receipt.name}' is in liveRunSafety.requiredReceipts but expectedReceipts marks it required=${JSON.stringify(receipt.required)}; ` +
        'the two required-receipt lists must agree for a telemetry receipt',
      );
    }
  }

  if (contract.remedyConcern !== undefined && !REMEDY_CONCERNS.includes(contract.remedyConcern)) {
    fail(`telemetryContract.remedyConcern must be one of ${REMEDY_CONCERNS.join(', ')}`);
  }

  return failures;
}

/**
 * Validate a whole catalog: per-manifest rules plus the cross-cutting rule that
 * every census concern is owned by exactly one remedy row.
 *
 * @param {Array<{file: string, manifest: object}>} entries
 * @returns {{failures: string[], rows: Array<object>}}
 */
export function validateTelemetryCatalog(entries) {
  const failures = [];
  const knownRowIds = new Set(entries.map(({ manifest }) => manifest?.rowId).filter(Boolean));
  const rows = [];
  const concernOwners = new Map(REMEDY_CONCERNS.map((concern) => [concern, []]));

  for (const { file, manifest } of entries) {
    failures.push(...validateTelemetryContract(manifest, { file, knownRowIds }));
    const contract = manifest?.telemetryContract;
    if (!contract) continue;
    rows.push({
      file,
      rowId: manifest.rowId,
      enforcement: contract.enforcement,
      rebindable: contract.rebindable === true,
      passScope: contract.verdictAuthority?.passScope,
      productPrerequisite: contract.productInstrumentationPrerequisite === true,
      remedyConcern: contract.remedyConcern ?? null,
    });
    if (contract.remedyConcern && concernOwners.has(contract.remedyConcern)) {
      concernOwners.get(contract.remedyConcern).push(manifest.rowId);
    }
  }

  // Concern ownership only binds once the catalog carries telemetry contracts at
  // all. A catalog with no contracts is separately caught by the per-row rule
  // that a telemetry-dependent row must declare one.
  if (rows.length) {
    for (const concern of REMEDY_CONCERNS) {
      const owners = concernOwners.get(concern);
      if (owners.length === 0) {
        failures.push(`census remedy concern '${concern}' has no owning row (${CENSUS_ISSUE})`);
      } else if (owners.length > 1) {
        failures.push(`census remedy concern '${concern}' is claimed by more than one row: ${owners.join(', ')}`);
      }
    }
  }

  return { failures, rows };
}

function readCatalog(root) {
  const manifestsDir = proofsToolPath(root, 'manifests');
  return readdirSync(manifestsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((file) => ({ file, manifest: JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8')) }));
}

function main() {
  const { root } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
  const entries = readCatalog(root);
  const { failures, rows } = validateTelemetryCatalog(entries);

  for (const row of rows) {
    console.log(
      [
        row.file,
        row.rowId,
        row.enforcement,
        `rebindable=${row.rebindable}`,
        row.passScope,
        `productPrerequisite=${row.productPrerequisite}`,
        row.remedyConcern ?? '-',
      ].join('\t'),
    );
  }

  const telemetryRequired = entries.filter(({ manifest }) =>
    (manifest?.liveRunSafety?.requiredReceipts || []).some((name) => TELEMETRY_RECEIPTS.has(name)),
  ).length;

  console.log(
    `\nTelemetry contracts: ${rows.length} declared; ` +
    `${telemetryRequired} rows require telemetry receipts; ` +
    `${rows.filter((row) => row.rebindable).length} claim telemetry-rebindable PASS.`,
  );

  if (failures.length) {
    console.error('\nRow telemetry contract check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Row telemetry contract check passed.');
  }
}

/**
 * True when this module is the process entry point.
 *
 * `import.meta.url` is realpath-resolved but `process.argv[1]` is not, so a
 * symlinked invocation path (a symlinked TMPDIR snapshot root, an operator
 * -supplied origin root) would otherwise make the comparison false and turn
 * this validator into a silent exit-0 no-op inside the catalog preflight.
 */
function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  const resolved = path.resolve(entry);
  let real = resolved;
  try {
    real = realpathSync(resolved);
  } catch {
    // Keep the non-realpath form; an unreadable entry path is still comparable.
  }
  const self = import.meta.url;
  return self === pathToFileURL(real).href || self === pathToFileURL(resolved).href;
}

if (invokedAsCli()) {
  main();
}
