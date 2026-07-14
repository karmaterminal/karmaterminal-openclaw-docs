#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  issueRcd2LifecycleReceipt,
} from '../lib/r-cd-2-lifecycle-receipt.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--') || !argv[i + 1]) throw new Error('usage: --run-dir <dir> --evidence <private-evidence.json> [--correlation <private-correlation.json>]');
    out[argv[i].slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

export function resolveRcd2LifecycleReceipt({ evidence, correlation, signingKey }) {
  return issueRcd2LifecycleReceipt({ evidence, correlation, signingKey });
}

async function main() {
  const args = parseArgs(process.argv);
  const runDir = path.resolve(args['run-dir']);
  let evidence = null;
  let correlation = null;
  try { evidence = JSON.parse(await readFile(args.evidence, 'utf8')); } catch {}
  try { correlation = JSON.parse(await readFile(args.correlation || path.join(runDir, 'continuation-trace-correlation.json'), 'utf8')); } catch {}
  const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation, signingKey: process.env.OPENCLAW_GATEWAY_TOKEN });
  await writeFile(path.join(runDir, 'r-cd-2-lifecycle-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(() => { process.stderr.write('R-CD-2 lifecycle receipt failed\n'); process.exitCode = 1; });
}
