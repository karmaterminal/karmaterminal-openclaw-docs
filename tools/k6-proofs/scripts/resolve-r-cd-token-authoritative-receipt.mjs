#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveRcdTokenAuthoritativeReceipt } from '../lib/r-cd-token-authoritative-receipt.mjs';

function argsOf(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) {
      throw new Error('usage: --run-dir <dir> --evidence <json> [--correlation <json>]');
    }
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return null; }
}

const args = argsOf(process.argv);
if (!args['run-dir'] || !args.evidence) throw new Error('run-dir and evidence are required');
const runDir = path.resolve(args['run-dir']);
const [evidence, attemptState, metadata, correlation, ancillaryRuntime] = await Promise.all([
  readJson(args.evidence),
  readJson(path.join(runDir, 'attempt-state.json')),
  readJson(path.join(runDir, 'runner-metadata.json')),
  readJson(args.correlation || path.join(runDir, 'continuation-trace-correlation.json')),
  readJson(path.join(runDir, 'ancillary-runtime-provenance.json')),
]);
const receipt = resolveRcdTokenAuthoritativeReceipt({
  evidence,
  correlation,
  attemptState,
  metadata,
  ancillaryRuntime,
  signingKey: process.env.OPENCLAW_GATEWAY_TOKEN,
});
const target = path.join(runDir, 'r-cd-token-authoritative-receipt.json');
await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ verdict: receipt.verdict, receipt: path.basename(target) })}\n`);
