#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const { root, rest } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
const args = new Set(rest);
const manifestsDir = proofsToolPath(root, 'manifests');
const rows = [];
for (const file of readdirSync(manifestsDir).filter((name) => name.endsWith('.json')).sort()) {
  const manifest = JSON.parse(readFileSync(join(manifestsDir, file), 'utf8'));
  const status = manifest.scenario?.status ?? 'missing';
  const classification = manifest.liveRunSafety?.classification ?? 'unknown';
  if (status !== 'runnable') continue;
  if (args.has('--live-suite') && classification !== 'k6-runnable') continue;
  rows.push({ rowId: manifest.rowId, file, status, classification, scenario: manifest.scenario?.name ?? manifest.scenario?.file ?? '' });
}

if (args.has('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else if (args.has('--lines')) {
  for (const row of rows) console.log(row.rowId);
} else {
  console.log(rows.map((row) => row.rowId).join(','));
}
