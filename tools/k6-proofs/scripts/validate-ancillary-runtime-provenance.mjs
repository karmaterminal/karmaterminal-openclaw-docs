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

async function readContractSnapshot(repoRoot, contract) {
  const contractPath = resolveRepositoryFile(repoRoot, contract, {
    label: '--contract',
  });
  return {
    path: contractPath,
    bytes: await readFile(contractPath),
  };
}

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
  const contractSnapshot = await readContractSnapshot(repoRoot, args.contract);
  const contract = JSON.parse(contractSnapshot.bytes.toString('utf8'));
  const receipt = validateAncillaryRuntimeProvenance({
    contract,
    sourceDir: args['source-dir'],
    row: args.row,
    canonicalSha: args['candidate-sha'],
    runtimeSha: args['runtime-sha'],
  });
  const revalidatedSnapshot = await readContractSnapshot(repoRoot, args.contract);
  if (
    revalidatedSnapshot.path !== contractSnapshot.path ||
    !revalidatedSnapshot.bytes.equals(contractSnapshot.bytes)
  ) {
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
