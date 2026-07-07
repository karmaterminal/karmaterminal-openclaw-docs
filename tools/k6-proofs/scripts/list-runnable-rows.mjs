#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const root = process.cwd().endsWith('/tools/k6-proofs') ? process.cwd() : join(process.cwd(), 'tools/k6-proofs');
const manifestsDir = join(root, 'manifests');
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
