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

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--root' && argv[index + 1]) {
      args.root = path.resolve(argv[++index]);
      continue;
    }
    throw new Error(`usage: ${path.basename(argv[1])} [--root <repository-root>]`);
  }
  return args;
}

const { root } = parseArgs(process.argv);
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
      .filter((entry) => entry.isDirectory() && /^R-[A-Z0-9-]+$/iu.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }
}

const manifestRows = [];
if (!failures.length) {
  for (const file of readdirSync(manifestsDir).filter((name) => name.endsWith('.json')).sort()) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8'));
      if (manifest.rowId) manifestRows.push({ rowId: manifest.rowId, file });
    } catch (error) {
      failures.push(`invalid manifest JSON: ${file} (${error.message})`);
    }
  }
}

const proofRowUpperSet = new Set(proofRows.map((r) => r.toUpperCase()));
const manifestByUpper = new Map(manifestRows.map((row) => [row.rowId.toUpperCase(), row]));
const missing = proofRows.filter((row) => !manifestByUpper.has(row.toUpperCase()));
const duplicateRows = [...manifestRows.reduce((byRow, row) => {
  const key = row.rowId.toUpperCase();
  byRow.set(key, [...(byRow.get(key) || []), row.file]);
  return byRow;
}, new Map())]
  .filter(([, files]) => files.length > 1)
  .map(([rowId, files]) => `${rowId} (${files.join(', ')})`);

// Manifest-only rows: in the live-suite manifest catalog but not yet in the canonical proof
// board corpus (e.g. model-override rows, R-CW-4, R-OBS-status). These are k6-runnable
// candidates pending a canonical fold — they are intentional, not gaps.
const manifestOnly = manifestRows.filter(
  (row) => row.rowId !== 'preflight' && !proofRowUpperSet.has(row.rowId.toUpperCase()),
);

if (missing.length) {
  failures.push(`proof rows missing manifest entries: ${missing.join(', ')}`);
}
if (duplicateRows.length) {
  failures.push(`duplicate manifest row IDs: ${duplicateRows.join('; ')}`);
}

console.log(`Current corpus: PROOFS/${currentSha}`);
console.log(`Proof rows: ${proofRows.length}`);
console.log(`Manifest entries: ${manifestRows.length}`);
if (missing.length) console.log(`Missing manifests: ${missing.join(', ')}`);
else console.log('Missing manifests: 0');
if (manifestOnly.length) {
  console.log(
    `Manifest-only (live-suite but not yet on proof board): ${manifestOnly.map((r) => r.rowId).join(', ')}`,
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
