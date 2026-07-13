#!/usr/bin/env node
/**
 * R-CD-2 receives raw gateway, k6, and Tempo material only long enough to
 * derive its lifecycle receipt. This projector turns that private acquisition
 * directory into the public proof artifact: a safe manifest plus the validated
 * receipt. It deliberately does not extend the collector or runtime surface.
 */
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRcd2PublicLifecycleReceipt, validateRcd2LifecycleReceipt } from '../lib/r-cd-2-lifecycle-receipt.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--run-dir', '--receipt', '--correlation'].includes(flag) || !value) {
      throw new Error('usage: --run-dir <dir> --receipt <safe-receipt> [--correlation <private-receipt>]');
    }
    out[flag.slice(2)] = value;
    i += 1;
  }
  if (!out['run-dir'] || !out.receipt) throw new Error('run-dir and receipt are required');
  return out;
}

async function jsonOrNull(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

function strings(value, into = new Set()) {
  if (typeof value === 'string' && value.length >= 6) into.add(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, into));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => strings(item, into));
  return into;
}

function safeManifest(manifest) {
  return {
    schema: manifest?.schema || 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-CD-2',
    candidateSha: manifest?.candidateSha || null,
    seat: manifest?.seat || null,
    transport: manifest?.transport || 'websocket',
    toolSurface: manifest?.toolSurface || 'typed-tool',
    scenario: { name: manifest?.scenario?.name || 'r-cd-2-silent-wake' },
    liveRunSafety: {
      classification: manifest?.liveRunSafety?.classification || 'k6-runnable',
      requiredReceipts: ['continuation-lifecycle-correlation', 'no-channel-delivery'],
      foldRequiresReview: true,
    },
    review: { candidateOnly: true, foldRequiresReview: true },
    publicArtifactProjection: 'r-cd-2-lifecycle-receipt-only',
  };
}

async function walkFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, next));
    else files.push(next);
  }
  return files;
}

export async function projectRcd2PublicArtifacts({ runDir, receiptPath, correlationPath }) {
  const receipt = await jsonOrNull(receiptPath);
  const validation = validateRcd2LifecycleReceipt(receipt);
  if (!validation.valid) throw new Error(`R-CD-2 lifecycle receipt rejected: ${validation.reason}`);
  const publicReceipt = projectRcd2PublicLifecycleReceipt(receipt);

  const manifestPath = path.join(runDir, 'row-manifest.json');
  const manifest = await jsonOrNull(manifestPath);
  const correlation = correlationPath ? await jsonOrNull(correlationPath) : null;
  const forbidden = strings({
    prompt: manifest?.invocation?.promptTemplate,
    sessionKey: manifest?.sessionKey,
    correlation: {
      traceId: correlation?.traceId,
      chainId: correlation?.chainId,
      dispatchSpanId: correlation?.dispatchSpanId,
      fireSpanId: correlation?.fireSpanId,
      query: correlation?.query,
    },
  });

  await writeFile(manifestPath, `${JSON.stringify(safeManifest(manifest), null, 2)}\n`);
  await writeFile(receiptPath, `${JSON.stringify(publicReceipt, null, 2)}\n`);
  const privateNames = [
    'continuation-trace-correlation.json',
    'continuation-trace-collector.json',
    'continuation-trace-collector.error.log',
    'gateway-journal-capture.json',
    'gateway-journal-redaction.json',
    'evidence-extraction.json',
    'evidence-redaction.json',
    'evidence-redaction.stdout.json',
    'verdict-reconciliation.json',
    'r-cd-2-lifecycle-resolver.json',
  ];
  await Promise.all(privateNames.map((name) => rm(path.join(runDir, name), { force: true })));
  const topLevel = await readdir(runDir);
  await Promise.all(topLevel
    .filter((name) => /(?:tempo-trace-.*\.json|tempo-trace-(?:receipt|error)\.log|.*summary\.json)$/i.test(name))
    .map((name) => rm(path.join(runDir, name), { force: true })));

  for (const relative of await walkFiles(runDir)) {
    const text = await readFile(path.join(runDir, relative), 'utf8').catch(() => '');
    for (const token of forbidden) {
      if (text.includes(token)) throw new Error(`R-CD-2 public artifact leaked private acquisition token in ${relative}`);
    }
  }
  return { receipt: publicReceipt, publicFiles: await walkFiles(runDir) };
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await projectRcd2PublicArtifacts({
    runDir: path.resolve(args['run-dir']),
    receiptPath: path.resolve(args.receipt),
    correlationPath: args.correlation ? path.resolve(args.correlation) : null,
  });
  process.stdout.write(`${JSON.stringify({ row: 'R-CD-2', receipt: 'validated', publicFiles: result.publicFiles.length })}\n`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
