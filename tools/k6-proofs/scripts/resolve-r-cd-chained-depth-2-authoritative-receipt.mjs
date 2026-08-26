#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  resolveRcdChainAuthoritativeReceipt,
} from '../lib/r-cd-chained-depth-2-authoritative-receipt.mjs';

function args(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || !argv[index + 1]) {
      throw new Error('usage: --run-dir <dir> --evidence <private-json> [--correlation <json>]');
    }
    out[argv[index].slice(2)] = argv[index + 1];
  }
  if (!out['run-dir'] || !out.evidence) {
    throw new Error('run-dir and evidence are required');
  }
  return out;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const input = args(process.argv);
  const runDir = path.resolve(input['run-dir']);
  const evidence = await readJson(input.evidence);
  const correlation = await readJson(
    input.correlation || path.join(runDir, 'continuation-trace-correlation.json'),
  );
  const receipt = resolveRcdChainAuthoritativeReceipt({
    evidence,
    correlation,
    signingKey: process.env.OPENCLAW_GATEWAY_TOKEN,
  });
  const target = path.join(
    runDir,
    'r-cd-chained-depth-2-authoritative-receipt.json',
  );
  await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    verdict: receipt.verdict,
    receipt: path.basename(target),
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `R-CD-CHAINED-DEPTH-2 authoritative receipt failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
