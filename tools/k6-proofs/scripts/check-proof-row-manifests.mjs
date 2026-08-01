#!/usr/bin/env node
/**
 * check-proof-row-manifests.mjs — ensure every current PROOFS row has a k6 manifest entry.
 *
 * This does not require every proof row to be k6-runnable. Manual-only rows may be
 * construct-only or scaffold, but they should still be explicit in the catalog so
 * the public executable-suite surface can explain the full 29-row corpus.
 *
 * The repository root comes from the shared repo-root contract, so running this
 * from the repository root and from tools/k6-proofs inspects the same files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const { root } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
const indexPath = path.join(root, 'PROOFS', 'INDEX.json');
const manifestsDir = proofsToolPath(root, 'manifests');
const failures = [];
const SUPPORT_DIRECTORIES = new Set(['artifacts', 'gates']);

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
      .filter((name) => !SUPPORT_DIRECTORIES.has(name))
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

const proofRowUpperSet = new Set(proofRows.map((r) => r.toUpperCase()));
const manifestByUpper = new Map(manifestRows.map((row) => [row.rowId.toUpperCase(), row]));
const missing = proofRows.filter((row) => !manifestByUpper.has(row.toUpperCase()));
const caseMismatches = proofRows.flatMap((row) => {
  const manifest = manifestByUpper.get(row.toUpperCase());
  return manifest && manifest.rowId !== row
    ? [`${row} != ${manifest.rowId} (${manifest.file})`]
    : [];
});
const duplicateManifestRows = [...manifestRows.reduce((byRow, row) => {
  const key = row.rowId.toUpperCase();
  const entries = byRow.get(key) ?? [];
  entries.push(row.file);
  byRow.set(key, entries);
  return byRow;
}, new Map())]
  .filter(([, files]) => files.length > 1)
  .map(([rowId, files]) => `${rowId} (${files.join(', ')})`);

// Manifest-only rows: in the manifest catalog but not yet in the canonical proof
// board corpus (e.g. model-override rows, R-CW-4, R-OBS-STATUS, or static boundary
// checks). These are intentional catalog entries, not proof-corpus gaps.
const manifestOnly = manifestRows.filter(
  (row) => row.rowId !== 'preflight' && !proofRowUpperSet.has(row.rowId.toUpperCase()),
);

if (missing.length) {
  failures.push(`proof rows missing manifest entries: ${missing.join(', ')}`);
}
if (caseMismatches.length) {
  failures.push(`proof row/manifest ID case mismatches: ${caseMismatches.join('; ')}`);
}
if (duplicateManifestRows.length) {
  failures.push(`duplicate manifest row IDs: ${duplicateManifestRows.join('; ')}`);
}

console.log(`Current corpus: PROOFS/${currentSha}`);
console.log(`Proof rows: ${proofRows.length}`);
console.log(`Manifest entries: ${manifestRows.length}`);
if (missing.length) console.log(`Missing manifests: ${missing.join(', ')}`);
else console.log('Missing manifests: 0');
if (manifestOnly.length) {
  console.log(
    `Manifest-only (catalog but not yet on proof board): ${manifestOnly.map((r) => r.rowId).join(', ')}`,
  );
} else {
  console.log('Manifest-only rows: 0');
}

if (failures.length) {
  console.error('\nProof row manifest coverage check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Proof row manifest coverage check passed.');
}
