#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProducerRegistry,
  expandProducerArgv,
  loadProducerCatalog,
} from '../lib/producer-catalog.mjs';
import {
  PROCESS_RECEIPT_SCHEMA, PROCESS_REQUIRED_CHECKS,
  REQUIRED_PRODUCT_SHA, sha256, signProducerReceipt, validateProcessReceipt,
} from '../lib/producer-receipt.mjs';
import {
  assertCanonicalGitCheckout,
  withoutGitControlVariables,
} from '../lib/git-execution-environment.mjs';
import { runAuthenticatedVitest } from '../lib/authenticated-product-tests.mjs';

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
    if (name === '--verify-only') { args.verifyOnly = true; continue; }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    if (name === '--row') args.row = value.toUpperCase();
    else if (name === '--product-dir') args.productDir = value;
    else if (name === '--candidate-sha') args.candidateSha = value;
    else if (name === '--artifact-dir') args.artifactDir = value;
    else if (name === '--docs-sha') args.docsSha = value;
    else throw new Error(`unexpected argument: ${name}`);
    index += 1;
  }
  return args;
}

try {
  const args = parseArgs(process.argv);
  for (const required of ['row', 'productDir', 'candidateSha', 'artifactDir', 'docsSha']) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  if (args.candidateSha !== REQUIRED_PRODUCT_SHA) throw new Error('required product SHA mismatch');
  if (!/^[a-f0-9]{40}$/u.test(args.docsSha) || !process.env.OPENCLAW_PROCESS_RECEIPT_KEY) {
    throw new Error('docs SHA and process observer signing key required');
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
  const gitEnv = withoutGitControlVariables();
  const git = (directory, commandArgs) => {
    const result = spawnSync('git', ['-C', directory, ...commandArgs], {
      encoding: 'utf8',
      env: gitEnv,
    });
    if (result.status !== 0) throw new Error('product Git identity command failed');
    return result.stdout.trim();
  };
  const productDir = assertCanonicalGitCheckout(args.productDir, git);
  const head = spawnSync('git', ['-C', productDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8', env: gitEnv,
  });
  const status = spawnSync('git', ['-C', productDir, 'status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8', env: gitEnv,
  });
  if (head.status !== 0 || head.stdout.trim() !== args.candidateSha) {
    throw new Error(`product checkout is not exact candidate ${args.candidateSha}`);
  }
  if (status.status !== 0 || status.stdout.trim()) {
    throw new Error('product checkout must be clean before process-local execution');
  }
  const tree = spawnSync('git', ['-C', productDir, 'rev-parse', 'HEAD^{tree}'], {
    encoding: 'utf8', env: gitEnv,
  });
  const bindings = {
    rowId: args.row, candidateSha: args.candidateSha, docsSha: args.docsSha,
    candidateTree: tree.stdout.trim(), runId: args.prerequisite
      ? path.basename(path.dirname(path.resolve(args.artifactDir))) : path.basename(path.resolve(args.artifactDir)),
    argvSha256: sha256(JSON.stringify(argv)),
    scriptSha256: sha256(readFileSync(path.resolve(repoRoot, argv[1]))),
    trustedIssuers: { 'catalog-process-observer': process.env.OPENCLAW_PROCESS_RECEIPT_KEY },
  };
  const terminalPath = path.join(args.artifactDir, 'process-terminal-receipt.json');
  if (args.verifyOnly) {
    const bytes = readFileSync(terminalPath);
    const receipt = JSON.parse(bytes);
    if (!validateProcessReceipt(receipt, bindings)) throw new Error('invalid process terminal receipt');
    for (const [file, digest] of Object.entries(receipt.artifactDigests)) {
      if (sha256(readFileSync(path.join(args.artifactDir, file))) !== digest) {
        throw new Error('process artifact digest mismatch');
      }
    }
    console.log(JSON.stringify({ validated: true, sha256: sha256(bytes) }));
    process.exit(0);
  }
  if (existsSync(terminalPath)) throw new Error('process receipt cannot be replayed');
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
    'PATH',
    'PNPM_HOME',
    'TMPDIR',
    'TZ',
  ]) {
    if (process.env[name] !== undefined) childEnv[name] = process.env[name];
  }
  const run = args.prerequisite
    ? runAuthenticatedVitest({
        sourceDir: productDir,
        candidateSha: args.candidateSha,
        testArgs: commandArgs.slice(1),
        artifactDir: args.artifactDir,
        env: childEnv,
      })
    : spawnSync(command, commandArgs, {
        cwd: repoRoot,
        env: childEnv,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.error) throw run.error;
  const afterHead = spawnSync('git', ['-C', productDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8', env: gitEnv,
  });
  const afterStatus = spawnSync('git', ['-C', productDir, 'status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8', env: gitEnv,
  });
  if (afterHead.status !== 0 || afterHead.stdout.trim() !== args.candidateSha ||
      afterStatus.status !== 0 || afterStatus.stdout.trim()) {
    throw new Error('process-local producer changed the exact candidate checkout');
  }
  if (run.status !== 0) throw new Error('process suite failed');
  let checks;
  let artifactDigests;
  if (args.prerequisite) {
    checks = { propagationSuite: true, 'baseline-restored': true };
    const file = 'process-suite-digests.json';
    writeFileSync(path.join(args.artifactDir, file), JSON.stringify({
      stdoutSha256: sha256(run.stdout || ''), stderrSha256: sha256(run.stderr || ''),
      suiteExitCode: run.status,
      runtime: run.attestation,
    }), { flag: 'wx', mode: 0o600 });
    artifactDigests = { [file]: sha256(readFileSync(path.join(args.artifactDir, file))) };
  } else {
    const file = args.row === 'R-CW-MULTI-COLLAPSE' ? 'row-result.json' : 'fixture-result.json';
    const bytes = readFileSync(path.join(args.artifactDir, file));
    const fixture = JSON.parse(bytes);
    const expectedSchema = args.row === 'R-CW-MULTI-COLLAPSE'
      ? 'openclaw.k6.process-local-result.v1'
      : `openclaw.project81.${args.row.toLowerCase()}.fixture-result.v1`;
    if (fixture.schema !== expectedSchema || fixture.candidateSha !== args.candidateSha ||
        fixture.verdict !== 'PASS-candidate') throw new Error('invalid process fixture result');
    checks = fixture.checks || fixture.receipts;
    if (args.row === 'R-CW-MULTI-COLLAPSE' &&
        (fixture.rowId !== args.row || fixture.sourceTree !== bindings.candidateTree ||
         fixture.suite?.exitCode !== 0 || fixture.suite?.ok !== true ||
         ['newestDrives', 'withinGraceOlderDrives', 'staleQueuedOlderFolds', 'runningNeverFolds']
           .some((key) => fixture.suite.requiredCases?.[key] !== true))) {
      throw new Error('invalid collapse suite identity or required assertions');
    }
    if (!PROCESS_REQUIRED_CHECKS[args.row]?.every((name) => checks?.[name] === true)) {
      throw new Error('missing required process checks');
    }
    artifactDigests = { [file]: sha256(bytes) };
  }
  const now = Date.now();
  const receipt = signProducerReceipt({
    schema: PROCESS_RECEIPT_SCHEMA, issuer: 'catalog-process-observer',
    receiptId: randomUUID(), rowId: args.row, verdict: 'PASS',
    candidateSha: args.candidateSha, runtimeSha: args.candidateSha, docsSha: args.docsSha,
    candidateTree: bindings.candidateTree, runId: bindings.runId,
    argvSha256: bindings.argvSha256, scriptSha256: bindings.scriptSha256,
    suiteExitCode: run.status, checks, producerEvidenceId: randomUUID(), artifactDigests,
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
  }, process.env.OPENCLAW_PROCESS_RECEIPT_KEY);
  if (!validateProcessReceipt(receipt, bindings)) throw new Error('process observer sealing failed');
  writeFileSync(terminalPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  process.exitCode = 0;
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 2;
}
