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
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const DEFAULT_CAP = 100;
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/scheduler.ts',
  'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts',
  'package.json',
  'pnpm-lock.yaml',
];
const TOOL_SURFACE_TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/r-cw-5/cost-cap-tool-surface.test.ts',
);

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

function fileSha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function requireCandidatePackageManager(worktreeDir) {
  const packageJson = JSON.parse(readFileSync(path.join(worktreeDir, 'package.json'), 'utf8'));
  const packageManager = packageJson?.packageManager;
  const match = typeof packageManager === 'string' && /^pnpm@(\d+\.\d+\.\d+)(?:\+sha512\.[a-f0-9]+)?$/u.exec(packageManager);
  if (!match) throw new Error('candidate package.json must pin pnpm with an exact packageManager version');
  return { packageManager, pnpmVersion: match[1] };
}

// The fixture must not let a caller-provided PATH substitute its package
// manager.  pnpm is installed alongside this Node runtime in our supported
// runner image; invoke that immutable script through process.execPath and
// compare its version with the candidate's committed packageManager pin.
export function resolvePinnedPnpm(worktreeDir) {
  const { packageManager, pnpmVersion } = requireCandidatePackageManager(worktreeDir);
  const nodePrefix = path.resolve(path.dirname(process.execPath), '..');
  const pnpmScript = path.join(nodePrefix, 'lib', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');
  if (!existsSync(pnpmScript) || !lstatSync(pnpmScript).isFile() || lstatSync(pnpmScript).isSymbolicLink()) {
    throw new Error('runner has no real Node-local pnpm script for the candidate packageManager pin');
  }
  const resolvedPnpmScript = realpathSync(pnpmScript);
  const versionResult = run(process.execPath, [resolvedPnpmScript, '--version'], { cwd: worktreeDir });
  if (!versionResult.ok) throw new Error(`cannot execute Node-local pnpm for candidate packageManager pin: ${versionResult.stderr.trim()}`);
  const version = versionResult.stdout.trim();
  if (version !== pnpmVersion) {
    throw new Error(`runner pnpm version ${version || '<missing>'} does not match candidate pin ${pnpmVersion}`);
  }
  return { packageManager, pnpmVersion, pnpmScript: resolvedPnpmScript };
}

function resolveCandidateLocalExecutable(worktreeDir, name) {
  const nodeModules = realpathSync(path.join(worktreeDir, 'node_modules'));
  const bin = path.join(worktreeDir, 'node_modules', '.bin', name);
  if (!existsSync(bin)) throw new Error(`candidate-local ${name} executable is missing after frozen install`);
  const executable = realpathSync(bin);
  if (!isInside(executable, nodeModules)) {
    throw new Error(`candidate-local ${name} executable resolves outside disposable node_modules`);
  }
  return executable;
}

function trackedSourceStatus(sourceDir) {
  const result = run('git', ['-C', sourceDir, 'status', '--porcelain', '--untracked-files=no'], {});
  if (!result.ok) throw new Error(`cannot inspect tracked source state: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function assertTrackedSourceClean(sourceDir, phase) {
  const status = trackedSourceStatus(sourceDir);
  if (status) {
    throw new Error(
      `candidate source has tracked staged or unstaged changes before ${phase}; refusing exact-source certification`,
    );
  }
}

export function assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, phase) {
  const head = gitHead(worktreeDir);
  if (head !== candidateSha) {
    throw new Error(`disposable candidate HEAD changed before ${phase}: expected ${candidateSha}, found ${head}`);
  }
  assertTrackedSourceClean(worktreeDir, phase);
  const candidateFiles = ['package.json', 'pnpm-lock.yaml'];
  const fileHashes = {};
  for (const file of candidateFiles) {
    const actual = fileSha256(path.join(worktreeDir, file));
    const committed = run('git', ['-C', worktreeDir, 'show', `${candidateSha}:${file}`], {});
    if (!committed.ok) throw new Error(`cannot read committed ${file} from candidate ${candidateSha}`);
    const expected = createHash('sha256').update(committed.stdout).digest('hex');
    if (actual !== expected) throw new Error(`disposable candidate ${file} differs from committed ${candidateSha} before ${phase}`);
    fileHashes[file] = actual;
  }
  return { head, trackedClean: true, candidateFileSha256: fileHashes };
}

export function assertSource(sourceDir, candidateSha) {
  const resolved = path.resolve(sourceDir);
  for (const marker of SOURCE_MARKERS) {
    if (!existsSync(path.join(resolved, marker))) throw new Error(`source dir is missing ${marker}`);
  }
  const lockfile = path.join(resolved, 'pnpm-lock.yaml');
  if (!lstatSync(lockfile).isFile() || lstatSync(lockfile).isSymbolicLink()) {
    throw new Error('candidate pnpm-lock.yaml must be a real regular file');
  }
  const head = gitHead(resolved);
  if (head !== candidateSha) throw new Error(`candidate/source mismatch: requested ${candidateSha}, source is ${head}`);
  assertTrackedSourceClean(resolved, 'fixture execution');
  return { resolved, head, lockfileSha256: fileSha256(lockfile) };
}

export function renderToolSurfaceTemplate(template, cap) {
  if (!Number.isInteger(cap) || cap < 2) throw new Error('tool-surface cap must be an integer of at least 2');
  const overCap = cap + 1;
  if (!template.includes('__RCW5_CAP__') || !template.includes('__RCW5_OVER_CAP__')) {
    throw new Error('tool-surface template is missing required cap placeholders');
  }
  return template
    .replaceAll('__RCW5_CAP__', String(cap))
    .replaceAll('__RCW5_OVER_CAP__', String(overCap));
}

export function buildReadiness({ candidateSha, head, cap, lockfileSha256 }) {
  return {
    schema: 'openclaw.project81.r-cw-5.fixture-readiness.v1',
    candidateSha,
    sourceHeadMatchesCandidate: head === candidateSha,
    sourceTrackedCleanBefore: true,
    productionConfigTouched: false,
    productionStateTouched: false,
    fixtureKind: 'source-only-production-module-plus-dispatch-boundary-suite',
    lockfileSha256,
    dependencyTree: 'fresh-disposable-pnpm-install-frozen-lockfile; source node_modules never trusted',
    cap,
  };
}

export function prepareArtifactDir(input) {
  const artifactDir = path.resolve(input);
  // `mkdir({ recursive: true })` follows a symlink in an existing ancestor.
  // Checking only an existing final directory would therefore let a caller
  // place a fresh receipt under a symlinked parent. Walk every existing path
  // component before making the directory so the private receipt boundary
  // cannot be redirected through an indirect path.
  const parsed = path.parse(artifactDir);
  let componentPath = parsed.root;
  for (const component of path.relative(parsed.root, artifactDir).split(path.sep)) {
    if (!component) continue;
    componentPath = path.join(componentPath, component);
    if (!existsSync(componentPath)) break;
    if (lstatSync(componentPath).isSymbolicLink()) {
      throw new Error('artifact dir path must not contain a symlink component');
    }
  }
  if (existsSync(artifactDir)) {
    const stats = lstatSync(artifactDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('artifact dir must be a real directory, not a file or symlink');
    }
    if ((stats.mode & 0o077) !== 0) {
      throw new Error('artifact dir must not be group/world accessible (mode 0700 required)');
    }
    if (readdirSync(artifactDir).length !== 0) {
      throw new Error('artifact dir must be empty; refusing to overwrite an earlier receipt');
    }
  } else {
    mkdirSync(artifactDir, { recursive: true, mode: 0o700 });
  }
  return artifactDir;
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

function runToolSurface({ worktreeDir, cap, vitestExecutable }) {
  if (!existsSync(TOOL_SURFACE_TEMPLATE)) {
    throw new Error(`tool-surface template missing: ${TOOL_SURFACE_TEMPLATE}`);
  }
  const testDir = path.join(worktreeDir, 'test', 'r-cw-5-fixture');
  mkdirSync(testDir, { recursive: true, mode: 0o700 });
  writeFileSync(
    path.join(testDir, 'cost-cap-tool-surface.test.ts'),
    renderToolSurfaceTemplate(readFileSync(TOOL_SURFACE_TEMPLATE, 'utf8'), cap),
    { mode: 0o600 },
  );
  const test = run(
    process.execPath,
    [vitestExecutable, 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', '--dir', 'test/r-cw-5-fixture', '--reporter=verbose'],
    { cwd: worktreeDir },
  );
  return {
    passed: test.ok && /1 passed/u.test(test.stdout),
    exitCode: test.exitCode,
    asserted: {
      typedToolCaptured: /disposable typed tool surface/u.test(test.stdout),
      overCapRejected: /rejects exhausted typed-tool elections/u.test(test.stdout),
      rejectedHopNoDurableWork: /1 passed/u.test(test.stdout),
    },
  };
}

function runVerifiedCandidateWorktree({ sourceDir, candidateSha, artifactDir, cap, sourceLockfileSha256 }) {
  const worktreeDir = path.join(artifactDir, `.r-cw-5-verified-${process.pid}-${Date.now()}`);
  const cleanup = { disposableWorktreeCreated: false, disposableWorktreeRemoved: false };
  const add = run('git', ['-C', sourceDir, 'worktree', 'add', '--detach', worktreeDir, candidateSha], {});
  if (!add.ok) throw new Error(`cannot create disposable candidate worktree: ${add.stderr.trim()}`);
  cleanup.disposableWorktreeCreated = true;
  try {
    const beforeInstall = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'dependency install');
    const lockfileSha256 = beforeInstall.candidateFileSha256['pnpm-lock.yaml'];
    if (lockfileSha256 !== sourceLockfileSha256) {
      throw new Error('disposable candidate lockfile does not match the verified source lockfile');
    }
    const packageManager = resolvePinnedPnpm(worktreeDir);
    const install = run(
      process.execPath,
      [packageManager.pnpmScript, 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'],
      { cwd: worktreeDir },
    );
    if (!install.ok) throw new Error(`frozen-lockfile install failed: ${install.stderr.trim()}`);
    const dependencyDir = path.join(worktreeDir, 'node_modules');
    if (!existsSync(dependencyDir) || !lstatSync(dependencyDir).isDirectory() || lstatSync(dependencyDir).isSymbolicLink()) {
      throw new Error('frozen-lockfile install did not create a real disposable node_modules directory');
    }
    const virtualStoreLock = path.join(worktreeDir, 'node_modules', '.pnpm', 'lock.yaml');
    if (!existsSync(virtualStoreLock) || fileSha256(virtualStoreLock) !== lockfileSha256) {
      throw new Error('disposable pnpm virtual-store lock does not byte-match the committed candidate lockfile');
    }
    const afterInstall = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'proof execution after install');
    const tsxExecutable = resolveCandidateLocalExecutable(worktreeDir, 'tsx');
    const vitestExecutable = resolveCandidateLocalExecutable(worktreeDir, 'vitest');
    const matrixRun = run(process.execPath, [tsxExecutable, '--eval', matrixEval(cap)], { cwd: worktreeDir });
    const matrix = matrixRun.ok ? parseLastJson(matrixRun.stdout, 'boundary matrix') : null;
    const dispatchRun = run(
      process.execPath,
      [
        vitestExecutable, 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
        'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose',
      ],
      { cwd: worktreeDir },
    );
    const afterExecution = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'final receipt emission');
    return {
      matrixRun,
      matrix,
      dispatchRun,
      toolSurface: runToolSurface({ worktreeDir, cap, vitestExecutable }),
      dependency: {
        packageManager: packageManager.packageManager,
        pnpmVersion: packageManager.pnpmVersion,
        installCommand: ['node', '<node-local-pnpm>', 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'],
        lockfileSha256,
        virtualStoreLockSha256: fileSha256(virtualStoreLock),
        frozenLockfileVerified: true,
        sourceNodeModulesTrusted: false,
        executionWorktreeIntegrity: { beforeInstall, afterInstall, afterExecution },
        cleanup,
      },
    };
  } finally {
    const remove = run('git', ['-C', sourceDir, 'worktree', 'remove', '--force', worktreeDir], {});
    if (!remove.ok) throw new Error(`cannot remove disposable candidate worktree: ${remove.stderr.trim()}`);
    if (existsSync(worktreeDir)) throw new Error('disposable candidate worktree still exists after cleanup');
    cleanup.disposableWorktreeRemoved = true;
  }
}

export function runFixture(args) {
  assertArgs(args);
  const { resolved: sourceDir, head, lockfileSha256 } = assertSource(args.sourceDir, args.candidateSha);
  const artifactDir = prepareArtifactDir(args.artifactDir);

  const readiness = buildReadiness({ candidateSha: args.candidateSha, head, cap: args.cap, lockfileSha256 });
  writeJson(path.join(artifactDir, 'fixture-readiness.json'), readiness);

  const verified = runVerifiedCandidateWorktree({
    sourceDir,
    candidateSha: args.candidateSha,
    artifactDir,
    cap: args.cap,
    sourceLockfileSha256: lockfileSha256,
  });
  const { matrixRun, matrix, dispatchRun, toolSurface } = verified;
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
    command: ['node', '<candidate-local-tsx>', '--eval', '<production-module-eval>'],
    exitCode: matrixRun.exitCode,
    dependency: verified.dependency,
  });

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
    command: ['node', '<candidate-local-vitest>', 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose'],
    // Test names, not raw logs, are public-safe and pin the no-spawn/cascade
    // assertion without copying arbitrary candidate output into the corpus.
    asserted: dispatchAssertions,
    dependency: verified.dependency,
  });

  const toolSurfacePassed = toolSurface.passed && Object.values(toolSurface.asserted).every(Boolean);
  writeJson(path.join(artifactDir, 'typed-tool-surface.json'), {
    schema: 'openclaw.project81.r-cw-5.typed-tool-surface.v1',
    passed: toolSurfacePassed,
    cap: args.cap,
    fixtureKind: 'frozen-lockfile-verified-disposable-exact-candidate-worktree-with-real-attempt-execution-and-typed-tool-capture',
    productionConfigTouched: false,
    productionStateTouched: false,
    sourceDirMutated: false,
    disposableWorktreeCreated: true,
    disposableWorktreeRemoved: true,
    dependency: verified.dependency,
    ...toolSurface,
  });

  // The production-module matrix and dispatcher suite execute against
  // sourceDir. A matching HEAD is not enough if tracked files were altered
  // while they ran, so refuse to emit a final exact-source receipt unless the
  // candidate is still clean after every production-surface check.
  const finalSource = assertSource(sourceDir, args.candidateSha);

  const verdict = matrixPassed && dispatchPassed && toolSurfacePassed ? 'PASS-candidate' : 'FAIL-fixture';
  const result = {
    schema: 'openclaw.project81.r-cw-5.fixture-result.v1',
    verdict,
    candidateSha: args.candidateSha,
    cap: args.cap,
    receipts: {
      fixtureReadiness: 'fixture-readiness.json',
      boundaryMatrix: 'boundary-matrix.json',
      dispatchBoundarySuite: 'dispatch-boundary-suite.json',
      typedToolSurface: 'typed-tool-surface.json',
      cleanup: 'cleanup.json',
    },
    checks: { matrixPassed, dispatchPassed, toolSurfacePassed, noRejectedHopSpawn: dispatchPassed && toolSurfacePassed },
  };
  writeJson(path.join(artifactDir, 'cleanup.json'), {
    schema: 'openclaw.project81.r-cw-5.cleanup.v1',
    productionConfigTouched: false,
    productionStateTouched: false,
    sourceMutated: false,
    sourceHeadMatchesCandidateAfter: finalSource.head === args.candidateSha,
    sourceTrackedCleanAfter: true,
    executionWorktreeIntegrity: verified.dependency.executionWorktreeIntegrity,
    disposableWorktreeRemoved: verified.dependency.cleanup.disposableWorktreeRemoved,
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
