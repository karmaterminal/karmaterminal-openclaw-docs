#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  readAncillaryRuntimeContract,
  validateAncillaryRuntimeProvenance,
} from '../lib/ancillary-runtime-provenance.mjs';

async function main() {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
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
  const receipt = validateAncillaryRuntimeProvenance({
    contract: readAncillaryRuntimeContract(args.contract),
    sourceDir: args['source-dir'],
    row: args.row,
    canonicalSha: args['candidate-sha'],
    runtimeSha: args['runtime-sha'],
  });
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
