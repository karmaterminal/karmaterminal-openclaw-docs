#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProducerRegistry,
  expandProducerArgv,
  loadProducerCatalog,
} from '../lib/producer-catalog.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const proofsDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(proofsDir, '../..');

function parseArgs(argv) {
  const args = { prerequisite: false };
  for (let index = 2; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--prerequisite') {
      args.prerequisite = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    if (name === '--row') args.row = value.toUpperCase();
    else if (name === '--product-dir') args.productDir = value;
    else if (name === '--candidate-sha') args.candidateSha = value;
    else if (name === '--artifact-dir') args.artifactDir = value;
    else throw new Error(`unexpected argument: ${name}`);
    index += 1;
  }
  return args;
}

try {
  const args = parseArgs(process.argv);
  for (const required of ['row', 'productDir', 'candidateSha', 'artifactDir']) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  const registry = buildProducerRegistry({
    proofsDir,
    catalog: loadProducerCatalog(proofsDir),
  });
  if (registry.failures.length) {
    throw new Error(`producer catalog is invalid: ${registry.failures.map((item) => item.message).join('; ')}`);
  }
  const row = registry.rows[args.row];
  if (!row) throw new Error(`unknown producer row ${args.row}`);
  const commandSpec = args.prerequisite ? row.prerequisite : { argv: row.argv };
  if (!Array.isArray(commandSpec?.argv)) {
    throw new Error(`${args.row} has no ${args.prerequisite ? 'prerequisite' : 'process-local'} argv`);
  }
  const argv = expandProducerArgv(commandSpec.argv, args);
  if (argv.some((value) => value === '')) throw new Error('producer argv contains an unresolved required value');
  const productDir = path.resolve(args.productDir);
  const head = spawnSync('git', ['-C', productDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const status = spawnSync('git', ['-C', productDir, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  if (head.status !== 0 || head.stdout.trim() !== args.candidateSha) {
    throw new Error(`product checkout is not exact candidate ${args.candidateSha}`);
  }
  if (status.status !== 0 || status.stdout.trim()) {
    throw new Error('product checkout must be clean before process-local execution');
  }
  const [command, ...commandArgs] = argv;
  const childEnv = {};
  for (const name of [
    'CI',
    'FORCE_COLOR',
    'HOME',
    'LANG',
    'LC_ALL',
    'NO_COLOR',
    'NODE_ENV',
    'NODE_OPTIONS',
    'PATH',
    'PNPM_HOME',
    'TMPDIR',
    'TZ',
  ]) {
    if (process.env[name] !== undefined) childEnv[name] = process.env[name];
  }
  const run = spawnSync(command, commandArgs, {
    cwd: args.prerequisite ? productDir : repoRoot,
    env: childEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.error) throw run.error;
  const afterHead = spawnSync('git', ['-C', productDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const afterStatus = spawnSync('git', ['-C', productDir, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  if (afterHead.status !== 0 || afterHead.stdout.trim() !== args.candidateSha ||
      afterStatus.status !== 0 || afterStatus.stdout.trim()) {
    throw new Error('process-local producer changed the exact candidate checkout');
  }
  process.exitCode = run.status ?? 1;
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 2;
}
