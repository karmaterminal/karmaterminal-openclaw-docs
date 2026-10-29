#!/usr/bin/env node
// Lane-private diagnostic for R-CW-6 FAIL-fixture at 293c977f62.
// Reproduces run-max-chain-fixture.mjs's install and its three vitest
// invocations, importing the fixture's own exported functions and templates
// unchanged, but keeps the child output the fixture deliberately drops.
// Adds a control: the candidate's own dispatch suites under their owning
// config (vitest.infra.config.ts). Run it inside the lane's network namespace.
// Usage: node rcw6-diag.mjs <docs-checkout> <openclaw-clone> <scratch-parent> <candidate-sha> <max>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [docsDir, cloneDir, scratchParent, candidateSha, maxArg] = process.argv.slice(2);
const maxChainLength = Number(maxArg);
const fixture = await import(
  pathToFileURL(path.join(docsDir, 'tools/k6-proofs/scripts/run-max-chain-fixture.mjs')).href
);
const templates = path.join(docsDir, 'tools/k6-proofs/fixtures/r-cw-6');

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      ...options,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
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

const SIGNAL = /(?:Error|FAIL|✓|✗|×|Cannot find|No test files|Test Files|Tests |does not provide|is not a function|not defined|ECONN|ENETUNREACH)/u;
const report = (label, result) => {
  const all = `${result.stdout}\n${result.stderr}`.split('\n');
  console.log(`\n=== ${label}: exit ${result.exitCode}`);
  console.log(all.filter((line) => SIGNAL.test(line)).slice(0, 40).join('\n'));
};

mkdirSync(scratchParent, { recursive: true, mode: 0o700 });
const worktreeDir = path.join(scratchParent, `wt-${process.pid}`);
const add = run('git', ['-C', cloneDir, 'worktree', 'add', '--detach', worktreeDir, candidateSha]);
if (!add.ok) throw new Error(add.stderr);
try {
  const before = fixture.assertCandidateWorktree(worktreeDir, candidateSha, 'diag install');
  const installation = fixture.installCandidateDependencies(worktreeDir, before.candidatePackageManager);
  const verified = fixture.verifyInstalledCandidateDependencies(worktreeDir, before.candidatePackageManager);
  console.log(`install ok, pnpm ${installation.executingPackageManagerVersion}, lock ${verified.dependencyProvenance.installedLockfileSha256}`);

  const runtimeDir = path.join(worktreeDir, 'test', 'r-cw-6-runtime-fixture');
  const delegateDir = path.join(worktreeDir, 'test', 'r-cw-6-delegate-fixture');
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  mkdirSync(delegateDir, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(runtimeDir, 'max-chain-tool-surface.test.ts'),
    fixture.renderToolSurfaceTemplate(readFileSync(path.join(templates, 'max-chain-tool-surface.test.ts'), 'utf8'), maxChainLength));
  writeFileSync(path.join(delegateDir, 'max-chain-delegate-boundary.test.ts'),
    fixture.renderToolSurfaceTemplate(readFileSync(path.join(templates, 'max-chain-delegate-boundary.test.ts'), 'utf8'), maxChainLength));
  const stateDir = path.join(worktreeDir, '.rcw6-state');
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const env = {
    ...process.env,
    OPENCLAW_STATE_DIR: stateDir,
    RCW6_DELEGATE_RECEIPT_PATH: path.join(scratchParent, 'delegate.raw.json'),
    RCW6_RUNTIME_RECEIPT_PATH: path.join(scratchParent, 'runtime.raw.json'),
    RCW6_TYPED_RECEIPT_PATH: path.join(scratchParent, 'typed.raw.json'),
  };
  const vitest = verified.executables.vitest;
  const opts = { cwd: worktreeDir, env };

  report('fixture-shape candidate regression suite (auto-reply config)', run(vitest, [
    'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
    'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts', '--reporter=verbose'], opts));
  report('fixture-shape selected delegate boundary (docs#516 template)', run(vitest, [
    'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', '--dir', 'test/r-cw-6-delegate-fixture', '--reporter=verbose'], opts));
  report('fixture-shape runtime + typed surface template', run(vitest, [
    'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', '--dir', 'test/r-cw-6-runtime-fixture', '--reporter=verbose'], opts));

  // Control, not a fixture receipt: the candidate's own suites under the
  // config that owns them at this SHA, through the repository runner.
  for (const suite of [
    'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts',
    'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts',
  ]) {
    report(`control ${path.basename(suite)} (infra config, run-vitest, 1 worker)`, run(process.execPath, [
      'scripts/run-vitest.mjs', 'run', '--config', 'test/vitest/vitest.infra.config.ts', '--maxWorkers=1', suite, '--reporter=verbose'], opts));
  }
} finally {
  const remove = run('git', ['-C', cloneDir, 'worktree', 'remove', '--force', worktreeDir]);
  console.log(`\n=== scratch worktree removed: ${remove.ok}`);
}
