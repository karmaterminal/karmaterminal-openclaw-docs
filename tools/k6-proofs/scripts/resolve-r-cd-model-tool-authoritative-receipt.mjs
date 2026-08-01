#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  resolveRcdModelToolAuthoritativeReceipt,
  validateRcdModelToolAuthoritativeReceipt,
} from '../lib/r-cd-model-tool-authoritative-receipt.mjs';

function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) {
      throw new Error(
        'usage: --run-dir <dir> --evidence <private-json> [--correlation <private-json>] [--metadata <runner-metadata.json>]',
      );
    }
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out['run-dir'] || !out.evidence) throw new Error('run-dir and evidence are required');
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
  const metadata = await readJson(
    input.metadata || path.join(runDir, 'runner-metadata.json'),
  );
  const runId = path.basename(runDir);
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
    evidence,
    correlation,
    metadata,
    runId,
    signingKey: process.env.OPENCLAW_GATEWAY_TOKEN,
  });
  // The resolver refuses to emit a receipt it cannot itself re-validate against
  // the independent runner envelope, so no unverifiable authority is ever
  // written next to the run artifacts.
  const validation = validateRcdModelToolAuthoritativeReceipt(
    receipt,
    process.env.OPENCLAW_GATEWAY_TOKEN,
    { metadata, runId },
  );
  if (!validation.valid) {
    throw new Error(`resolved receipt failed self-validation: ${validation.reason}`);
  }
  const target = path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json');
  await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory,
    authorityValidated: validation.valid,
    receipt: path.basename(target),
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`R-CD-MODEL-TOOL authoritative receipt failed: ${error.message}\n`);
  process.exitCode = 1;
});
