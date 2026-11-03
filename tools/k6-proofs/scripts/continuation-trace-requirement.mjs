#!/usr/bin/env node
/**
 * Print one row manifest's trace requirement as JSON (karmaterminal-openclaw-docs#600).
 *
 * run-proofs.sh reads this instead of restating the predicate in jq. The
 * predicate itself is owned by lib/continuation-trace-requirement.mjs.
 *
 *   node scripts/continuation-trace-requirement.mjs --manifest <row-manifest.json>
 *   -> {"required":true,"continuation":true,"reasons":[...],"tool":"...",
 *       "correlationReceipt":"...","receipts":["tempo-trace-json","..."]}
 */
import { readFile } from 'node:fs/promises';
import { traceRequirement } from '../lib/continuation-trace-requirement.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg !== '--manifest') throw new Error(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    args.manifest = value;
    i += 1;
  }
  if (!args.manifest) throw new Error('Usage: node continuation-trace-requirement.mjs --manifest <row-manifest.json>');
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
  process.stdout.write(`${JSON.stringify(traceRequirement(manifest))}\n`);
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
