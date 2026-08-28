#!/usr/bin/env node
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseReturnCovenantEvidenceLog,
  resolveReturnCovenantAuthoritativeReceipt,
  validateReturnCovenantAuthoritativeReceipt,
} from '../lib/return-covenant-authoritative-receipt.mjs';

function parseArgs(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(
        'usage: --plan <json> --k6-log <file> --runtime-config <json> ' +
        '--cleanup <json> --out <json>',
      );
    }
    values[flag.slice(2)] = value;
  }
  for (const name of ['plan', 'k6-log', 'runtime-config', 'cleanup', 'out']) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  return values;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJsonAtomic(file, value) {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.tmp`,
  );
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const [plan, log, runtimeConfig, cleanup] = await Promise.all([
    readJson(args.plan),
    readFile(args['k6-log'], 'utf8'),
    readJson(args['runtime-config']),
    readJson(args.cleanup),
  ]);
  const evidence = parseReturnCovenantEvidenceLog(log);
  const signingKey = process.env.OPENCLAW_GATEWAY_TOKEN;
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    observations: evidence.observations,
    cleanup,
    runtimeConfig,
    signingKey,
  });
  const validation = validateReturnCovenantAuthoritativeReceipt(receipt, signingKey);
  if (!validation.valid) {
    throw new Error(`generated observer receipt is invalid: ${validation.reason}`);
  }
  await writeJsonAtomic(args.out, receipt);
  process.stdout.write(`${JSON.stringify({
    verdict: receipt.verdict,
    receipt: path.basename(args.out),
  })}\n`);
  if (receipt.verdict !== 'PASS-candidate') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`return covenant observer failed: ${error.message}\n`);
  process.exitCode = 1;
});
