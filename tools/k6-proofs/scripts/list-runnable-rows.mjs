#!/usr/bin/env node
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';
import {
  buildProducerRegistry,
  loadProducerCatalog,
  resolveProducerPlan,
} from '../lib/producer-catalog.mjs';

const { root, rest } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
const args = new Set(rest);
const fromIndex = rest.indexOf('--from');
const fromRow = fromIndex >= 0 ? rest[fromIndex + 1]?.trim().toUpperCase() : null;
if (fromIndex >= 0 && !fromRow) {
  console.error('--from requires a row ID');
  process.exit(2);
}
const proofsDir = proofsToolPath(root);
const registry = buildProducerRegistry({
  proofsDir,
  catalog: loadProducerCatalog(proofsDir),
});
const selection = args.has('--live-suite') ? 'live-suite' : 'all';
const plan = resolveProducerPlan({ selection, registry });
if (plan.failures.length > 0) {
  for (const failure of plan.failures) console.error(`${failure.code}: ${failure.message}`);
  process.exit(2);
}
const rows = plan.rows
  .filter((row) =>
    row.manifest &&
    !row.blocked &&
    ['behavioral-live', 'process-local'].includes(row.classification))
  .map((row) => ({
    rowId: row.rowId,
    file: row.manifest,
    classification: row.classification,
    scenario: row.scenario,
    dependsOn: row.dependsOn,
    blocked: row.blocked,
  }));

if (fromRow) {
  const start = rows.findIndex((row) => row.rowId.toUpperCase() === fromRow);
  if (start < 0) {
    console.error(`--from row is not runnable: ${fromRow}`);
    process.exit(2);
  }
  rows.splice(0, start);
}

if (args.has('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else if (args.has('--lines')) {
  for (const row of rows) console.log(row.rowId);
} else {
  console.log(rows.map((row) => row.rowId).join(','));
}
