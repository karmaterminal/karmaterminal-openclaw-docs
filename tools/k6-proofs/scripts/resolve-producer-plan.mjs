#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProducerRegistry,
  loadProducerCatalog,
  resolveProducerPlan,
} from '../lib/producer-catalog.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const proofsDir = path.resolve(scriptDir, '..');

function parseArgs(argv) {
  const args = {
    selection: 'all',
    candidateSha: '',
    docsSha: '',
    receipts: null,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    if (name === '--selection') args.selection = value;
    else if (name === '--candidate-sha') args.candidateSha = value;
    else if (name === '--docs-sha') args.docsSha = value;
    else if (name === '--receipts') args.receipts = value;
    else throw new Error(`unexpected argument: ${name}`);
    index += 1;
  }
  return args;
}

try {
  const args = parseArgs(process.argv);
  const catalog = loadProducerCatalog(proofsDir);
  const registry = buildProducerRegistry({ proofsDir, catalog });
  const receipts = args.receipts
    ? JSON.parse(readFileSync(path.resolve(args.receipts), 'utf8'))
    : [];
  if (!Array.isArray(receipts)) throw new Error('--receipts must contain a JSON array');
  const plan = resolveProducerPlan({
    selection: args.selection,
    registry,
    receipts,
    candidateSha: args.candidateSha,
    docsSha: args.docsSha,
  });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (plan.failures.length > 0) process.exitCode = 2;
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 2;
}
