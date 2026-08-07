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
import { fileURLToPath } from 'node:url';

const SUPPORT_DIRS = new Set(['artifacts', 'gates']);

export function inspectCorpusRows(corpusDir, proofManifest) {
  const declaredRows = (proofManifest.rows || []).map((entry) => ({
    rowId: entry.row,
    directory: path.basename(String(entry.dir || '').replace(/\/+$/, '')),
  })).filter((entry) => entry.rowId && entry.directory);
  const declaredDirectories = new Set(declaredRows.map((entry) => entry.directory));
  const onDiskDirectories = readdirSync(corpusDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !SUPPORT_DIRS.has(name) && !name.startsWith('_'))
    .sort();

  return {
    declaredRows,
    undeclaredDirectories: onDiskDirectories.filter((name) => !declaredDirectories.has(name)),
  };
}

export function checkProofRowManifests(root = process.cwd()) {
  const indexPath = path.join(root, 'PROOFS', 'INDEX.json');
  const manifestsDir = path.join(root, 'tools', 'k6-proofs', 'manifests');
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
    if (!currentSha || !existsSync(corpusDir)) {
      failures.push(`current PROOFS corpus missing: ${corpusDir}`);
    } else {
      const proofManifestPath = path.join(corpusDir, 'proofs-manifest.json');
      if (!existsSync(proofManifestPath)) {
        failures.push(`missing ${proofManifestPath}`);
      } else {
        const { declaredRows, undeclaredDirectories: undeclared } = inspectCorpusRows(
          corpusDir,
          JSON.parse(readFileSync(proofManifestPath, 'utf8')),
        );
        proofRows = declaredRows.map((row) => row.rowId);
        undeclaredDirectories = undeclared;
      }
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

// Manifest-only rows: in the live-suite manifest catalog but not yet in the canonical proof
// board corpus (e.g. model-override rows, R-CW-4, R-OBS-status). These are k6-runnable
// candidates pending a canonical fold — they are intentional, not gaps.
  const manifestOnly = manifestRows.filter(
    (row) => row.rowId !== 'preflight' && !proofRowUpperSet.has(row.rowId.toUpperCase()),
  );

  if (missing.length) {
    failures.push(`proof rows missing manifest entries: ${missing.join(', ')}`);
  }
  if (undeclaredDirectories.length) {
    failures.push(`undeclared proof row directories: ${undeclaredDirectories.join(', ')}`);
  }

  return { currentSha, proofRows, manifestRows, missing, manifestOnly, undeclaredDirectories, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { currentSha, proofRows, manifestRows, missing, manifestOnly, undeclaredDirectories, failures } = checkProofRowManifests();
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
  if (undeclaredDirectories.length) console.log(`Undeclared row directories: ${undeclaredDirectories.join(', ')}`);
  else console.log('Undeclared row directories: 0');

  if (failures.length) {
    console.error('\nProof row manifest coverage check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Proof row manifest coverage check passed.');
  }
}
