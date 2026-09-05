#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProducerRegistry,
  loadProducerCatalog,
  resolveProducerPlan,
} from '../lib/producer-catalog.mjs';
import { sha256 } from '../lib/producer-receipt.mjs';

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
    else if (name === '--run-id') args.runId = value;
    else if (name === '--consumption-dir') args.consumptionDir = value;
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
    runId: args.runId,
    trustedIssuers: process.env.OPENCLAW_PRODUCER_TRUST_FILE
      ? JSON.parse(readFileSync(process.env.OPENCLAW_PRODUCER_TRUST_FILE, 'utf8')) : {},
  });
  if (receipts.length && !plan.failures.length) {
    if (!args.consumptionDir) throw new Error('receipt consumption ledger is required');
    mkdirSync(args.consumptionDir, { recursive: true, mode: 0o700 });
    for (const receipt of receipts) {
      for (const identity of [receipt.integrity.signature,
        sha256(`${receipt.issuer}:receipt:${receipt.receiptId}`),
        sha256(`${receipt.issuer}:evidence:${receipt.producerEvidenceId}`)]) {
        writeFileSync(path.join(args.consumptionDir, identity), args.runId, {
          flag: 'wx', mode: 0o600,
        });
      }
    }
  }
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (plan.failures.length > 0) process.exitCode = 2;
} catch {
  console.error('producer plan validation or one-shot receipt consumption failed');
  process.exitCode = 2;
}
