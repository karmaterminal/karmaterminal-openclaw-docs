#!/usr/bin/env node
/**
 * check-proof-row-manifests.mjs — ensure every current PROOFS row has a k6 manifest entry.
 *
 * This does not require every proof row to be k6-runnable. Manual-only rows may be
 * construct-only or scaffold, but they should still be explicit in the catalog so
 * the public executable-suite surface can explain the full 29-row corpus.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'PROOFS', 'INDEX.json');
const manifestsDir = path.join(root, 'tools', 'k6-proofs', 'manifests');
const failures = [];

if (!existsSync(indexPath)) failures.push(`missing ${indexPath}`);
if (!existsSync(manifestsDir)) failures.push(`missing ${manifestsDir}`);

let currentSha = '';
let proofRows = [];
if (!failures.length) {
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  currentSha = index.current_sha;
  const corpusDir = path.join(root, 'PROOFS', currentSha);
  if (!currentSha || !existsSync(corpusDir)) {
    failures.push(`current PROOFS corpus missing: ${corpusDir}`);
  } else {
    proofRows = readdirSync(corpusDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== 'gates')
      .sort();
  }
}

const manifestRows = [];
if (!failures.length) {
  for (const file of readdirSync(manifestsDir).filter((name) => name.endsWith('.json')).sort()) {
    const manifest = JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8'));
    if (manifest.rowId) manifestRows.push({ rowId: manifest.rowId, file });
  }
}

const manifestByUpper = new Map(manifestRows.map((row) => [row.rowId.toUpperCase(), row]));
const missing = proofRows.filter((row) => !manifestByUpper.has(row.toUpperCase()));

if (missing.length) {
  failures.push(`proof rows missing manifest entries: ${missing.join(', ')}`);
}

console.log(`Current corpus: PROOFS/${currentSha}`);
console.log(`Proof rows: ${proofRows.length}`);
console.log(`Manifest entries: ${manifestRows.length}`);
if (missing.length) console.log(`Missing manifests: ${missing.join(', ')}`);
else console.log('Missing manifests: 0');

if (failures.length) {
  console.error('\nProof row manifest coverage check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Proof row manifest coverage check passed.');
}
