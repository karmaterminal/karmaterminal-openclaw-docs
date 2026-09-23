#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createReturnCovenantRuntimeArtifact,
} from '../lib/return-covenant-runtime-artifact.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDocsDir = path.resolve(scriptDir, '../../..');

function parseArgs(argv) {
  const values = {};
  const allowed = new Set([
    'source-dir',
    'output-dir',
    'run-id',
    'row-id',
    'docs-harness-sha',
    'package-manager-command',
  ]);
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error('runtime artifact arguments must be flag/value pairs');
    }
    const name = flag.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown argument: ${flag}`);
    values[name] = value;
  }
  for (const name of [
    'source-dir',
    'output-dir',
    'run-id',
    'docs-harness-sha',
    'package-manager-command',
  ]) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  return values;
}

async function gitHead(directory) {
  const { execFile } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', directory, 'rev-parse', 'HEAD'],
      { encoding: 'utf8' },
      (error, stdout) => error ? reject(error) : resolve(stdout.trim()),
    );
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const docsDir = await realpath(defaultDocsDir);
  if (await gitHead(docsDir) !== args['docs-harness-sha']) {
    throw new Error('executing docs harness HEAD differs from --docs-harness-sha');
  }
  let packageManagerCommand;
  try {
    packageManagerCommand = JSON.parse(args['package-manager-command']);
  } catch (error) {
    throw new Error(`--package-manager-command is invalid JSON: ${error.message}`);
  }
  const result = await createReturnCovenantRuntimeArtifact({
    sourceDir: args['source-dir'],
    outputDir: args['output-dir'],
    runId: args['run-id'],
    rowId:
      args['row-id'] || 'R-CD-RETURN-COVENANT-AUTHORITY',
    docsHarnessSha: args['docs-harness-sha'],
    packageManagerCommand,
  });
  process.stdout.write(`${JSON.stringify({
    status: 'created',
    artifact: result.binding,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`return covenant runtime artifact build failed: ${error.message}\n`);
  process.exitCode = 1;
});
