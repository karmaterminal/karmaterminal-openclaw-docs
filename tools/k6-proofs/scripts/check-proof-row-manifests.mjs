#!/usr/bin/env node
/**
 * Ensure every canonical current-corpus row has a k6 manifest entry.
 *
 * proofs-manifest.json is the declared row inventory. Generated support
 * directories are ignored only for the separate undeclared-directory check.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const SUPPORT_DIRECTORIES = new Set(['artifacts', 'gates']);

export function inspectCorpusRows(corpusDir, proofManifest) {
  const declaredRows = (proofManifest.rows || [])
    .map((entry) => ({
      rowId: entry.row,
      directory: path.basename(String(entry.dir || '').replace(/\/+$/, '')),
    }))
    .filter((entry) => entry.rowId && entry.directory);
  const declaredDirectories = new Set(declaredRows.map((entry) => entry.directory));
  const onDiskDirectories = readdirSync(corpusDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !SUPPORT_DIRECTORIES.has(name) && !name.startsWith('_'))
    .sort();

  return {
    declaredRows,
    undeclaredDirectories: onDiskDirectories.filter((name) => !declaredDirectories.has(name)),
  };
}

export function checkProofRowManifests(root) {
  const indexPath = path.join(root, 'PROOFS', 'INDEX.json');
  const manifestsDir = proofsToolPath(root, 'manifests');
  const failures = [];

  if (!existsSync(indexPath)) failures.push(`missing ${indexPath}`);
  if (!existsSync(manifestsDir)) failures.push(`missing ${manifestsDir}`);

  let currentSha = '';
  let proofRows = [];
  let undeclaredDirectories = [];
  if (!failures.length) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    currentSha = index.current_sha;
    const corpusDir = path.join(root, 'PROOFS', currentSha);
    const proofManifestPath = path.join(corpusDir, 'proofs-manifest.json');
    if (!currentSha || !existsSync(corpusDir)) {
      failures.push(`current PROOFS corpus missing: ${corpusDir}`);
    } else if (!existsSync(proofManifestPath)) {
      failures.push(`missing ${proofManifestPath}`);
    } else {
      const inspected = inspectCorpusRows(
        corpusDir,
        JSON.parse(readFileSync(proofManifestPath, 'utf8')),
      );
      proofRows = inspected.declaredRows.map((row) => row.rowId);
      undeclaredDirectories = inspected.undeclaredDirectories;
    }
  }

  const manifestRows = [];
  if (!failures.length) {
    for (const file of readdirSync(manifestsDir).filter((name) => name.endsWith('.json')).sort()) {
      const manifest = JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8'));
      if (manifest.rowId) manifestRows.push({ rowId: manifest.rowId, file });
    }
  }

  const proofRowUpperSet = new Set(proofRows.map((row) => row.toUpperCase()));
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
  const manifestOnly = manifestRows.filter(
    (row) => row.rowId !== 'preflight' && !proofRowUpperSet.has(row.rowId.toUpperCase()),
  );

  if (missing.length) failures.push(`proof rows missing manifest entries: ${missing.join(', ')}`);
  if (caseMismatches.length) {
    failures.push(`proof row/manifest ID case mismatches: ${caseMismatches.join('; ')}`);
  }
  if (duplicateManifestRows.length) {
    failures.push(`duplicate manifest row IDs: ${duplicateManifestRows.join('; ')}`);
  }
  if (undeclaredDirectories.length) {
    failures.push(`undeclared proof row directories: ${undeclaredDirectories.join(', ')}`);
  }

  return {
    currentSha,
    proofRows,
    manifestRows,
    missing,
    manifestOnly,
    undeclaredDirectories,
    caseMismatches,
    duplicateManifestRows,
    failures,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { root } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
  const result = checkProofRowManifests(root);
  console.log(`Current corpus: PROOFS/${result.currentSha}`);
  console.log(`Proof rows: ${result.proofRows.length}`);
  console.log(`Manifest entries: ${result.manifestRows.length}`);
  console.log(result.missing.length ? `Missing manifests: ${result.missing.join(', ')}` : 'Missing manifests: 0');
  if (result.manifestOnly.length) {
    console.log(
      `Manifest-only (catalog but not yet on proof board): ${result.manifestOnly.map((row) => row.rowId).join(', ')}`,
    );
  } else {
    console.log('Manifest-only rows: 0');
  }
  console.log(
    result.undeclaredDirectories.length
      ? `Undeclared row directories: ${result.undeclaredDirectories.join(', ')}`
      : 'Undeclared row directories: 0',
  );

  if (result.failures.length) {
    console.error('\nProof row manifest coverage check failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Proof row manifest coverage check passed.');
  }
}
