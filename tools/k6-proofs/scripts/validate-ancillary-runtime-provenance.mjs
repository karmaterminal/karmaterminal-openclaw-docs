#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  validateAncillaryRuntimeProvenance,
} from '../lib/ancillary-runtime-provenance.mjs';
import {
  resolveRepositoryFile,
  resolveRepositoryRoot,
} from '../lib/repo-root.mjs';

async function main() {
  const { root: repoRoot, rest } = resolveRepositoryRoot({
    argv: process.argv.slice(2),
  });
  const args = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || !value) {
      throw new Error(
        'usage: --contract <json> --source-dir <git> --row <id> --candidate-sha <sha> --runtime-sha <sha> --out <json>',
      );
    }
    args[key.slice(2)] = value;
  }
  for (const required of ['contract', 'source-dir', 'row', 'candidate-sha', 'runtime-sha', 'out']) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  const contractPath = resolveRepositoryFile(repoRoot, args.contract, {
    label: '--contract',
  });
  const contractBytes = await readFile(contractPath);
  const contract = JSON.parse(contractBytes.toString('utf8'));
  const receipt = validateAncillaryRuntimeProvenance({
    contract,
    sourceDir: args['source-dir'],
    row: args.row,
    canonicalSha: args['candidate-sha'],
    runtimeSha: args['runtime-sha'],
  });
  const revalidatedPath = resolveRepositoryFile(repoRoot, args.contract, {
    label: '--contract',
  });
  const revalidatedBytes = await readFile(revalidatedPath);
  if (revalidatedPath !== contractPath || !revalidatedBytes.equals(contractBytes)) {
    throw new Error('--contract changed during ancillary provenance validation');
  }
  await writeFile(args.out, `${JSON.stringify(receipt, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
  process.stdout.write(
    `${JSON.stringify({ valid: true, receipt: path.basename(args.out) })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`ancillary runtime provenance failed: ${error.message}\n`);
  process.exitCode = 1;
});
