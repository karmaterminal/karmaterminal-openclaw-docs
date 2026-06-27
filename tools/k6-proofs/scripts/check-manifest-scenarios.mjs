#!/usr/bin/env node
/**
 * check-manifest-scenarios.mjs — manifest ↔ runnable scenario registry check.
 *
 * A manifest is OK when it either:
 *   - declares scenario.status="runnable" and points at an existing
 *     tools/k6-proofs/scenarios/*.js file via scenario.file (or scenario.name), or
 *   - declares scenario.status="scaffold" / "construct-only" to make a missing
 *     scenario intentionally non-runnable instead of accidental.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const proofsDir = path.join(root, 'tools', 'k6-proofs');
const manifestsDir = path.join(proofsDir, 'manifests');
const scenariosDir = path.join(proofsDir, 'scenarios');
const validStatuses = new Set(['runnable', 'scaffold', 'construct-only']);

function withoutJs(value) {
  return String(value || '').replace(/\.js$/u, '');
}

function manifestFiles() {
  return readdirSync(manifestsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

const scenarioBasenames = new Set(
  readdirSync(scenariosDir)
    .filter((name) => name.endsWith('.js'))
    .map(withoutJs),
);

const failures = [];
const rows = [];

for (const file of manifestFiles()) {
  const manifestPath = path.join(manifestsDir, file);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const scenario = manifest.scenario || {};
  const status = scenario.status;
  const runnableRef = withoutJs(scenario.file || (status === 'runnable' ? scenario.name : ''));
  const expectedRef = withoutJs(scenario.expectedFile || scenario.name);
  const existing = runnableRef ? scenarioBasenames.has(runnableRef) : false;

  rows.push({ file, rowId: manifest.rowId, status, runnableRef, expectedRef, existing });

  if (!validStatuses.has(status)) {
    failures.push(`${file}: scenario.status must be one of ${[...validStatuses].join(', ')}`);
    continue;
  }

  if (status === 'runnable') {
    if (!runnableRef) {
      failures.push(`${file}: runnable manifest must set scenario.file or scenario.name`);
    } else if (!existing) {
      failures.push(`${file}: runnable scenario '${runnableRef}.js' is missing under tools/k6-proofs/scenarios/`);
    }
  }

  if (status === 'construct-only' && (scenario.file || scenario.expectedFile)) {
    failures.push(`${file}: construct-only manifest should not declare scenario.file/expectedFile`);
  }
}

for (const row of rows) {
  const ref = row.runnableRef || row.expectedRef || '-';
  const suffix = row.status === 'runnable'
    ? (row.existing ? 'OK' : 'MISSING')
    : 'intentional non-runnable';
  console.log(`${row.file}\t${row.rowId}\t${row.status}\t${ref}\t${suffix}`);
}

if (failures.length) {
  console.error('\nManifest scenario registry check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nManifest scenario registry check passed: ${rows.length} manifests; ${scenarioBasenames.size} scenario files.`);
}
