#!/usr/bin/env node
/**
 * Isolated R-CW-5 cost-cap fixture.
 *
 * This fixture deliberately does not write OpenClaw config, state, or a
 * workspace.  It runs the exact candidate's production continuation module
 * plus the dispatch boundary suite from a source-only worktree.  That gives
 * the proof harness a deterministic below/equal/over boundary and a
 * no-spawn assertion without changing a fleet gateway.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const DEFAULT_CAP = 100;
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/scheduler.ts',
  'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts',
  'package.json',
];

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --artifact-dir <safe-output-dir> [--cap <positive-int>] [--json]`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW5_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    artifactDir: env.OPENCLAW_RCW5_ARTIFACT_DIR || '',
    cap: Number(env.OPENCLAW_RCW5_CAP || DEFAULT_CAP),
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
    else if (arg === '--cap') args.cap = Number(next());
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

function assertArgs(args) {
  if (!args.sourceDir) throw new Error('--source-dir or OPENCLAW_RCW5_SOURCE_DIR is required');
  if (!args.artifactDir) throw new Error('--artifact-dir or OPENCLAW_RCW5_ARTIFACT_DIR is required');
  if (!/^[0-9a-f]{40}$/u.test(args.candidateSha)) {
    throw new Error('--candidate-sha or OPENCLAW_CANDIDATE_SHA must be a 40-character lowercase SHA');
  }
  if (!Number.isInteger(args.cap) || args.cap < 2) throw new Error('--cap must be an integer of at least 2');
}

function run(command, args, options) {
  try {
    const stdout = execFileSync(command, args, { ...options, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function gitHead(sourceDir) {
  const result = run('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {});
  if (!result.ok) throw new Error(`cannot resolve source HEAD: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function assertSource(sourceDir, candidateSha) {
  const resolved = path.resolve(sourceDir);
  for (const marker of SOURCE_MARKERS) {
    if (!existsSync(path.join(resolved, marker))) throw new Error(`source dir is missing ${marker}`);
  }
  if (!existsSync(path.join(resolved, 'node_modules'))) {
    throw new Error('source dir has no node_modules; fixture refuses to install dependencies or mutate the candidate worktree');
  }
  const head = gitHead(resolved);
  if (head !== candidateSha) throw new Error(`candidate/source mismatch: requested ${candidateSha}, source is ${head}`);
  return { resolved, head };
}

function matrixEval(cap) {
  // JSON only: the fixture invokes the exact production TypeScript module via
  // tsx, so this string is not a second implementation of the cap policy.
  return [
    'import { checkContinuationBudget } from "./src/auto-reply/continuation/scheduler.ts";',
    `const cap = ${cap};`,
    'const config = { enabled: true, minDelayMs: 1, maxDelayMs: 60_000, maxChainLength: 4, maxDelegatesPerTurn: 4, maxPendingWork: 32, crossSessionTargeting: "enabled", costCapTokens: cap };',
    'const cases = [cap - 1, cap, cap + 1].map((accumulatedChainTokens) => ({ accumulatedChainTokens, outcome: checkContinuationBudget({ chainState: { currentChainCount: 0, chainStartedAt: 0, accumulatedChainTokens }, config, sessionKey: "r-cw-5-isolated" }) }));',
    'console.log(JSON.stringify({ cap, cases }));',
  ].join('\n');
}

function parseLastJson(stdout, label) {
  const line = stdout.trim().split('\n').findLast((entry) => entry.trim().startsWith('{'));
  if (!line) throw new Error(`${label} emitted no JSON receipt`);
  return JSON.parse(line);
}

export function runFixture(args) {
  assertArgs(args);
  const { resolved: sourceDir, head } = assertSource(args.sourceDir, args.candidateSha);
  const artifactDir = path.resolve(args.artifactDir);
  mkdirSync(artifactDir, { recursive: true, mode: 0o700 });

  const readiness = {
    schema: 'openclaw.project81.r-cw-5.fixture-readiness.v1',
    candidateSha: args.candidateSha,
    sourceHead: head,
    sourceDir,
    productionConfigTouched: false,
    productionStateTouched: false,
    fixtureKind: 'source-only-production-module-plus-dispatch-boundary-suite',
    cap: args.cap,
  };
  writeJson(path.join(artifactDir, 'fixture-readiness.json'), readiness);

  const matrixRun = run('pnpm', ['exec', 'tsx', '--eval', matrixEval(args.cap)], { cwd: sourceDir });
  const matrix = matrixRun.ok ? parseLastJson(matrixRun.stdout, 'boundary matrix') : null;
  const matrixPassed = Boolean(
    matrix?.cases?.length === 3 &&
    matrix.cases[0]?.outcome === null &&
    matrix.cases[1]?.outcome === null &&
    matrix.cases[2]?.outcome === 'cost-capped',
  );
  writeJson(path.join(artifactDir, 'boundary-matrix.json'), {
    schema: 'openclaw.project81.r-cw-5.boundary-matrix.v1',
    cap: args.cap,
    passed: matrixPassed,
    ...(matrix || {}),
    command: ['pnpm', 'exec', 'tsx', '--eval', '<production-module-eval>'],
    exitCode: matrixRun.exitCode,
  });

  const dispatchRun = run(
    'pnpm',
    [
      'vitest', 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
      'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose',
    ],
    { cwd: sourceDir },
  );
  const dispatchAssertions = {
    belowCapAllowsSpawn: /allows dispatch when accumulatedChainTokens is 1 below costCapTokens/u.test(dispatchRun.stdout),
    exactCapAllowsSpawn: /rejects at exact boundary \(accumulatedChainTokens === costCapTokens is NOT over\)/u.test(dispatchRun.stdout),
    overCapRejectsSpawn: /rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1/u.test(dispatchRun.stdout),
    overCapMarksFlowFailed: /marks TaskFlow records as failed for cost-cap-rejected delegates/u.test(dispatchRun.stdout),
  };
  // A green process alone is insufficient: this fixture must keep pinning the
  // four observable contract points, especially the rejected-hop no-spawn
  // behavior and durable failed-flow side effect.
  const dispatchPassed = dispatchRun.ok && Object.values(dispatchAssertions).every(Boolean);
  writeJson(path.join(artifactDir, 'dispatch-boundary-suite.json'), {
    schema: 'openclaw.project81.r-cw-5.dispatch-boundary-suite.v1',
    passed: dispatchPassed,
    exitCode: dispatchRun.exitCode,
    command: ['pnpm', 'vitest', 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose'],
    // Test names, not raw logs, are public-safe and pin the no-spawn/cascade
    // assertion without copying arbitrary candidate output into the corpus.
    asserted: dispatchAssertions,
  });

  const verdict = matrixPassed && dispatchPassed ? 'PASS-candidate' : 'FAIL-fixture';
  const result = {
    schema: 'openclaw.project81.r-cw-5.fixture-result.v1',
    verdict,
    candidateSha: args.candidateSha,
    cap: args.cap,
    receipts: {
      fixtureReadiness: 'fixture-readiness.json',
      boundaryMatrix: 'boundary-matrix.json',
      dispatchBoundarySuite: 'dispatch-boundary-suite.json',
      cleanup: 'cleanup.json',
    },
    checks: { matrixPassed, dispatchPassed, noRejectedHopSpawn: dispatchPassed },
  };
  writeJson(path.join(artifactDir, 'cleanup.json'), {
    schema: 'openclaw.project81.r-cw-5.cleanup.v1',
    productionConfigTouched: false,
    productionStateTouched: false,
    sourceMutated: false,
    cleanupRequired: false,
    result: 'source-only fixture left no gateway/config/state process to restore',
  });
  writeJson(path.join(artifactDir, 'fixture-result.json'), result);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) try {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
  } else {
    const result = runFixture(args);
    if (args.json) console.log(JSON.stringify(result));
    else console.log(`R-CW-5 fixture: ${result.verdict} (${result.candidateSha})`);
    process.exitCode = result.verdict === 'PASS-candidate' ? 0 : 1;
  }
} catch (error) {
  console.error(`R-CW-5 fixture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
