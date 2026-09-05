#!/usr/bin/env node
import {
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
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
    else throw new Error(`unexpected argument: ${name}`);
    index += 1;
  }
  return args;
}

const RECEIPT_STORE = path.join(
  os.userInfo().homedir,
  '.local',
  'state',
  'openclaw-k6-proofs',
  'consumed-producer-receipts',
);
const LOCK_LEASE_MS = 30_000;

function durableReceiptStore() {
  return RECEIPT_STORE;
}

function lockOwner(token, now) {
  return `${JSON.stringify({
    schema: 'openclaw.k6.receipt-store-lock.v1',
    token,
    pid: process.pid,
    host: os.hostname(),
    acquiredAt: new Date(now).toISOString(),
    leaseExpiresAt: new Date(now + LOCK_LEASE_MS).toISOString(),
  }, null, 2)}\n`;
}

function acquireStoreLock(lock) {
  const token = randomUUID();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pending = `${lock}.${token}.pending`;
    try {
      writeFileSync(pending, lockOwner(token, Date.now()), { flag: 'wx', mode: 0o600 });
      linkSync(pending, lock);
      rmSync(pending);
      return token;
    } catch (error) {
      rmSync(pending, { force: true });
      if (error.code !== 'EEXIST') {
        throw error;
      }
      let owner;
      try {
        owner = JSON.parse(readFileSync(lock, 'utf8'));
      } catch {
        owner = null;
      }
      const expiresAt = Date.parse(owner?.leaseExpiresAt || '');
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        throw new Error(`receipt store is leased by ${owner.host || 'unknown'}:${owner.pid || 'unknown'}`);
      }
      if (!Number.isFinite(expiresAt)) {
        throw new Error('receipt store has an unreadable active lease');
      }
      const stale = `${lock}.stale-${token}`;
      try {
        renameSync(lock, stale);
        rmSync(stale, { force: true });
      } catch (staleError) {
        if (staleError.code !== 'ENOENT') throw staleError;
      }
    }
  }
  throw new Error('could not recover stale receipt-store lock');
}

function releaseStoreLock(lock, token) {
  try {
    const owner = JSON.parse(readFileSync(lock, 'utf8'));
    if (owner.token === token) rmSync(lock);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
  const lockToken = acquireStoreLock(lock);
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
    releaseStoreLock(lock, lockToken);
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
