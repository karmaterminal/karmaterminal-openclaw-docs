#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { extractEvidenceData } from '../lib/k6-log-evidence.mjs';

function usage() {
  console.error('Usage: node extract-k6-evidence.mjs --input <k6.log> --out <evidence.jsonl> [--lines-out <evidence-lines.log>]');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!['--input', '--out', '--lines-out'].includes(arg)) throw new Error(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return out;
}

export function extractEvidence(logText) {
  return extractEvidenceData(logText).records;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.out) {
    usage();
    process.exitCode = 2;
    return;
  }
  const { records, lines } = extractEvidenceData(await readFile(args.input, 'utf8'));
  if (records.length === 0) throw new Error('no evidence JSON found in k6 output');
  await writeFile(args.out, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  if (args.linesOut) await writeFile(args.linesOut, lines.join('\n') + '\n');
  console.log(JSON.stringify({ records: records.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
