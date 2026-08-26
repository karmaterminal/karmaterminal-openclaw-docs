#!/usr/bin/env node
import {
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  analyzeContinuationAcceptanceManifest,
  buildContinuationAcceptanceManifest,
} from './lib/continuation-acceptance-matrix.mjs';

function usage() {
  console.error(
    'Usage: node generate-continuation-acceptance-matrix.mjs ' +
    '--input <proofs-manifest.json> --allocation-from <proofs-manifest.json> ' +
    '--honest-limit-receipt R-RC-2=<repo-relative-run-result.json> ' +
    '[--output <proofs-manifest.json>] [--summary]',
  );
}

function parseArgs(argv) {
  const args = { receipts: {}, summary: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--summary') {
      args.summary = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (!['--input', '--allocation-from', '--honest-limit-receipt', '--output'].includes(arg)) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    if (arg === '--honest-limit-receipt') {
      const separator = value.indexOf('=');
      if (separator < 1 || separator === value.length - 1) {
        throw new Error('--honest-limit-receipt must use ROW=repo-relative-path');
      }
      args.receipts[value.slice(0, separator)] = value.slice(separator + 1);
    } else {
      args[arg.slice(2).replaceAll('-', '')] = value;
    }
    index += 1;
  }
  return args;
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is unreadable or invalid JSON: ${error.message}`);
  }
}

function atomicWrite(file, body) {
  const target = path.resolve(file);
  const temporary = `${target}.tmp-${process.pid}`;
  writeFileSync(temporary, body, { flag: 'wx' });
  renameSync(temporary, target);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.input || !args.allocationfrom) {
    usage();
    throw new Error('--input and --allocation-from are required');
  }
  const root = process.cwd();
  const source = readJson(path.resolve(args.input), 'input manifest');
  const allocation = readJson(path.resolve(args.allocationfrom), 'allocation manifest');
  const manifest = buildContinuationAcceptanceManifest(source, {
    allocationManifest: allocation,
    honestLimitReceipts: args.receipts,
    root,
  });
  const analysis = analyzeContinuationAcceptanceManifest(manifest, { root });
  if (!analysis.valid) {
    throw new Error(`generated matrix is invalid: ${analysis.failures.join('; ')}`);
  }
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  if (args.output) atomicWrite(args.output, body);
  if (args.summary) {
    process.stdout.write(`${JSON.stringify({
      required_rows: analysis.requiredRows.length,
      supplemental_rows: analysis.supplementalRows,
      required_rollup: analysis.requiredRollup,
      supplemental_rollup: analysis.supplementalRollup,
      acceptance_complete: analysis.acceptance.complete,
      blocking_required_rows: analysis.acceptance.blockers,
    }, null, 2)}\n`);
  } else if (!args.output) {
    process.stdout.write(body);
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
