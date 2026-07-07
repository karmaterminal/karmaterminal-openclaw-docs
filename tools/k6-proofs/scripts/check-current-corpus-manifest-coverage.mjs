#!/usr/bin/env node
/**
 * Verify that every row in PROOFS/INDEX.json's current manual corpus has a
 * tools/k6-proofs manifest entry. This is intentionally broader than the
 * unattended k6 live suite: construct-only manifests count as catalog coverage.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd().endsWith('/tools/k6-proofs') ? join(process.cwd(), '..', '..') : process.cwd();
const index = JSON.parse(readFileSync(join(root, 'PROOFS', 'INDEX.json'), 'utf8'));
const corpus = JSON.parse(readFileSync(join(root, index.manifest_path), 'utf8'));
const normalize = (row) => row === 'R-CONFIG-defaults' ? 'R-CONFIG-DEFAULTS' : row;
const corpusRows = [...new Set(corpus.rows.map((row) => normalize(row.row)))].sort();
const manifestRows = readdirSync(join(root, 'tools', 'k6-proofs', 'manifests'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(join(root, 'tools', 'k6-proofs', 'manifests', name), 'utf8')).rowId)
  .map(normalize);
const manifestSet = new Set(manifestRows);
const missing = corpusRows.filter((row) => !manifestSet.has(row));
const extra = [...new Set(manifestRows)].filter((row) => row !== 'preflight' && !corpusRows.includes(row)).sort();
const result = {
  currentSha: index.current_sha,
  corpusRows: corpusRows.length,
  manifestRows: manifestRows.length,
  coveredCorpusRows: corpusRows.length - missing.length,
  missing,
  extraNonCorpusRows: extra,
  ok: missing.length === 0,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
