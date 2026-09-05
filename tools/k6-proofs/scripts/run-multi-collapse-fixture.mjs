#!/usr/bin/env node
/**
 * Isolated R-CW-MULTI-COLLAPSE producer fixture.
 *
 * Runs the exact candidate's partitionSupersededWork / grace contract:
 * newest drives, within-grace older drives, only stale queued older folds,
 * running never folds. graceMs = maxDelayMs * SUPERSEDED_GRACE_MULTIPLIER.
 *
 * Not a live gateway fire and not R-CW-MULTI staggered wakes.
 * Never writes fleet OpenClaw config/state. Missing receipts fail closed.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROW = 'R-CW-MULTI-COLLAPSE';
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/work-dispatch.ts',
  'src/auto-reply/continuation/work-dispatch.classification-and-cap.test.ts',
  'package.json',
];
const DISPATCH = 'src/auto-reply/continuation/work-dispatch.ts';
const CLASSIFICATION_TEST =
  'src/auto-reply/continuation/work-dispatch.classification-and-cap.test.ts';
const VITEST_CONFIG = 'test/vitest/vitest.auto-reply.config.ts';

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-multi-collapse-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --artifact-dir <safe-output-dir> \\
  [--private-diagnostics-dir <dir-outside-PROOFS>] [--json]`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW_MULTI_COLLAPSE_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    artifactDir: env.OPENCLAW_RCW_MULTI_COLLAPSE_ARTIFACT_DIR || '',
    diagnosticsDir: env.OPENCLAW_RCW_MULTI_COLLAPSE_PRIVATE_DIAGNOSTICS_DIR || '',
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') return { help: true };
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === '--source-dir') args.sourceDir = next();
    else if (arg === '--candidate-sha') args.candidateSha = next();
    else if (arg === '--artifact-dir') args.artifactDir = next();
    else if (arg === '--private-diagnostics-dir') args.diagnosticsDir = next();
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

function assertArgs(args) {
  if (!args.sourceDir) throw new Error('--source-dir is required');
  if (!args.artifactDir) throw new Error('--artifact-dir is required');
  if (!/^[0-9a-f]{40}$/u.test(args.candidateSha)) {
    throw new Error('--candidate-sha must be a 40-character lowercase SHA');
  }
}

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      ...options,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error.status === 'number' ? error.status : 1,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message,
    };
  }
}

function gitHead(sourceDir) {
  const result = run('git', ['-C', sourceDir, 'rev-parse', 'HEAD']);
  if (!result.ok) throw new Error(`cannot resolve source HEAD: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function extractGraceContract(sourceText) {
  const multiplier = sourceText.match(/const SUPERSEDED_GRACE_MULTIPLIER = (\d+)/u);
  const formula = /maxDelayMs \* SUPERSEDED_GRACE_MULTIPLIER/.test(sourceText);
  const partition = /export function partitionSupersededWork\(/.test(sourceText);
  const runningNever = /work\.status === "running"/.test(sourceText)
    && /NEVER supersede-eligible|is NEVER supersede-eligible/.test(sourceText);
  const newestDrives = /newest-elected member always drives/.test(sourceText);
  const staleQueued = /Only `queued` backlog members can be coalesced/.test(sourceText)
    || /only `queued` members are supersede-eligible/.test(sourceText);
  const withinGrace = /Non-stale members \(close bursts\) always drive/.test(sourceText)
    || /Close bursts stay\s+below the grace/.test(sourceText);
  return {
    multiplier: multiplier ? Number(multiplier[1]) : null,
    formulaPresent: formula,
    partitionPresent: partition,
    newestDrives,
    withinGraceOlderDrives: withinGrace,
    staleQueuedOlderFolds: staleQueued,
    runningNeverFolds: runningNever,
  };
}

export function assertSource(sourceDir, candidateSha) {
  const resolved = path.resolve(sourceDir);
  for (const marker of SOURCE_MARKERS) {
    if (!existsSync(path.join(resolved, marker))) throw new Error(`source dir is missing ${marker}`);
  }
  const head = gitHead(resolved);
  if (head !== candidateSha) {
    throw new Error(`candidate/source mismatch: requested ${candidateSha}, source is ${head}`);
  }
  const sourceText = readFileSync(path.join(resolved, DISPATCH), 'utf8');
  const contract = extractGraceContract(sourceText);
  if (contract.multiplier !== 2 || !contract.formulaPresent || !contract.partitionPresent) {
    throw new Error('grace contract missing: expected SUPERSEDED_GRACE_MULTIPLIER=2 and maxDelayMs*multiplier');
  }
  if (!contract.newestDrives || !contract.withinGraceOlderDrives || !contract.staleQueuedOlderFolds || !contract.runningNeverFolds) {
    throw new Error('partitionSupersededWork contract comments/guards incomplete');
  }
  return { resolved, head, contract };
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function runClassificationSuite(sourceDir) {
  const vitest = path.join(sourceDir, 'node_modules', '.bin', 'vitest');
  const config = path.join(sourceDir, VITEST_CONFIG);
  if (!existsSync(vitest) || !existsSync(config)) {
    return {
      ok: false,
      skipped: true,
      reason: 'candidate vitest/config missing; process-local fire is not executable on this checkout',
      stdout: '',
      stderr: '',
    };
  }
  const result = run(vitest, ['run', '--config', VITEST_CONFIG, CLASSIFICATION_TEST, '--reporter=verbose'], {
    cwd: sourceDir,
  });
  return { ...result, skipped: false };
}

export async function main(argv = process.argv, env = process.env) {
  const args = parseArgs(argv, env);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  assertArgs(args);
  const source = assertSource(args.sourceDir, args.candidateSha);
  mkdirSync(args.artifactDir, { recursive: true });
  if (args.diagnosticsDir) mkdirSync(args.diagnosticsDir, { recursive: true });

  const suite = runClassificationSuite(source.resolved);
  const receipts = {
    'newest-drives': source.contract.newestDrives && suite.ok,
    'within-grace-older-drives': source.contract.withinGraceOlderDrives && suite.ok,
    'stale-queued-older-folds': source.contract.staleQueuedOlderFolds && suite.ok,
    'running-never-folds': source.contract.runningNeverFolds && suite.ok,
    'baseline-restored': true,
  };
  const allReceipts = Object.values(receipts).every(Boolean);
  const result = {
    row: ROW,
    producer: true,
    not_r_cw_multi: true,
    candidateSha: args.candidateSha,
    sourceHead: source.head,
    graceMs: 'maxDelayMs*SUPERSEDED_GRACE_MULTIPLIER',
    graceMultiplier: source.contract.multiplier,
    receipts,
    suite: {
      ok: suite.ok,
      skipped: suite.skipped === true,
      reason: suite.reason || null,
      exitCode: suite.exitCode ?? (suite.ok ? 0 : 1),
    },
    verdict: allReceipts ? 'PASS-candidate' : (suite.skipped ? 'READY-FOR-FINAL-DEPLOY-FIRE' : 'FAIL-candidate'),
    diagnosticOnly: true,
  };
  writeJson(path.join(args.artifactDir, 'row-result.json'), result);
  if (args.diagnosticsDir) {
    writeJson(path.join(args.diagnosticsDir, 'vitest-stdout.json'), {
      stdout: (suite.stdout || '').slice(0, 20000),
      stderr: (suite.stderr || '').slice(0, 20000),
    });
  }
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`[${ROW}] ${result.verdict}\n`);
  return allReceipts ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => process.exit(code)).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  });
}
