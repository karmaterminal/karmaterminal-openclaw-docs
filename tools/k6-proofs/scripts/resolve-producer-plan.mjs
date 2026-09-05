#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProducerRegistry,
  loadProducerCatalog,
  resolveProducerPlan,
} from '../lib/producer-catalog.mjs';
import { sha256 } from '../lib/producer-receipt.mjs';
import { withoutGitControlVariables } from '../lib/git-execution-environment.mjs';

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
    else throw new Error(`unexpected argument: ${name}`);
    index += 1;
  }
  return args;
}

function durableReceiptStore() {
  if (process.env.OPENCLAW_PRODUCER_RECEIPT_STORE) {
    return path.resolve(process.env.OPENCLAW_PRODUCER_RECEIPT_STORE);
  }
  const git = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
    env: withoutGitControlVariables(),
  });
  if (git.status !== 0 || !git.stdout.trim()) {
    throw new Error('cannot resolve verifier-controlled receipt store');
  }
  return path.join(git.stdout.trim(), 'k6-proofs-consumed-receipts');
}

function receiptIdentities(receipts) {
  return receipts.flatMap((receipt) => [
    receipt.integrity.signature,
    sha256(`${receipt.issuer}:receipt:${receipt.receiptId}`),
    sha256(`${receipt.issuer}:evidence:${receipt.producerEvidenceId}`),
  ]);
}

function consumeReceiptBundle(receipts, runId) {
  const store = durableReceiptStore();
  const identities = receiptIdentities(receipts);
  if (new Set(identities).size !== identities.length) {
    throw new Error('receipt bundle contains duplicate identities');
  }
  mkdirSync(store, { recursive: true, mode: 0o700 });
  const lock = `${store}.lock`;
  mkdirSync(lock, { mode: 0o700 });
  try {
    const consumed = new Set();
    for (const name of readdirSync(store)) {
      if (!name.endsWith('.json')) continue;
      const bundle = JSON.parse(readFileSync(path.join(store, name), 'utf8'));
      for (const identity of bundle.identities || []) consumed.add(identity);
    }
    if (identities.some((identity) => consumed.has(identity))) {
      throw new Error('receipt identity already consumed');
    }
    const body = `${JSON.stringify({
      schema: 'openclaw.k6.producer-receipt-consumption.v1',
      runId,
      identities,
      consumedAt: new Date().toISOString(),
    }, null, 2)}\n`;
    const pending = path.join(store, `.${randomUUID()}.pending`);
    const target = path.join(store, `${sha256(body)}.json`);
    writeFileSync(pending, body, { flag: 'wx', mode: 0o600 });
    renameSync(pending, target);
  } finally {
    rmSync(lock, { recursive: true });
  }
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
    consumeReceiptBundle(receipts, args.runId);
  }
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (plan.failures.length > 0) process.exitCode = 2;
} catch {
  console.error('producer plan validation or one-shot receipt consumption failed');
  process.exitCode = 2;
}
