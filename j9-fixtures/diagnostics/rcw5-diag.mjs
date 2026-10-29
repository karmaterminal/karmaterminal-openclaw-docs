#!/usr/bin/env node
// Lane-private diagnostic for R-CW-5 FAIL-fixture at 293c977f62.
// Reproduces run-cost-cap-fixture.mjs's install and proof-command steps,
// importing the fixture's own exported functions unchanged, but keeps the
// child stdout/stderr that the fixture deliberately drops from receipts.
// Usage: node rcw5-diag.mjs <docs-checkout> <openclaw-clone> <scratch-parent> <candidate-sha>
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [docsDir, cloneDir, scratchParent, candidateSha] = process.argv.slice(2);
const fixture = await import(
  pathToFileURL(path.join(docsDir, 'tools/k6-proofs/scripts/run-cost-cap-fixture.mjs')).href
);

function run(command, args, options) {
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

const tail = (text, lines = 25) => text.trim().split('\n').slice(-lines).join('\n');
const report = (label, result) => {
  console.log(`\n=== ${label}: exit ${result.exitCode}`);
  console.log(`--- stdout (tail)\n${tail(result.stdout)}`);
  console.log(`--- stderr (tail)\n${tail(result.stderr)}`);
};

mkdirSync(scratchParent, { recursive: true, mode: 0o700 });
const worktreeDir = path.join(scratchParent, `wt-${process.pid}`);
const add = run('/usr/bin/git', ['-C', cloneDir, 'worktree', 'add', '--detach', worktreeDir, candidateSha], {});
if (!add.ok) throw new Error(add.stderr);
try {
  fixture.assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'diag install');
  const candidateLockfile = readFileSync(path.join(worktreeDir, 'pnpm-lock.yaml'));
  const pm = fixture.resolvePinnedPnpm(worktreeDir, candidateLockfile);
  const store = path.join(worktreeDir, '.r-cw-5-pnpm-store');
  mkdirSync(store, { mode: 0o700 });
  const install = run(
    pm.pnpmInterpreter,
    [pm.pnpmScript, 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts', '--ignore-pnpmfile',
      '--store-dir', store, '--virtual-store-dir', 'node_modules/.pnpm'],
    { cwd: worktreeDir, env: pm.packageManagerEnv },
  );
  report('pnpm install', install);
  console.log(JSON.stringify(fixture.assertVirtualStoreLockMatchesCandidate(worktreeDir, candidateLockfile)));

  for (const name of ['tsx', 'vitest']) {
    const bin = path.join(worktreeDir, 'node_modules', '.bin', name);
    const stats = lstatSync(bin);
    const real = realpathSync(bin);
    const head = readFileSync(real).subarray(0, 200).toString('utf8');
    console.log(`\n=== .bin/${name}: symlink=${stats.isSymbolicLink()}${stats.isSymbolicLink() ? ` -> ${readlinkSync(bin)}` : ''}`);
    console.log(`realpath relative to worktree: ${path.relative(worktreeDir, real)}`);
    console.log(`first bytes:\n${head.split('\n').slice(0, 6).join('\n')}`);
  }

  // The fixture's own invocation shape: process.execPath <realpath(.bin/x)> ...
  const tsxReal = realpathSync(path.join(worktreeDir, 'node_modules', '.bin', 'tsx'));
  const vitestReal = realpathSync(path.join(worktreeDir, 'node_modules', '.bin', 'vitest'));
  report('fixture-shape tsx --eval', run(process.execPath, [tsxReal, '--eval', 'console.log(JSON.stringify({ok:1}))'], { cwd: worktreeDir }));
  report('fixture-shape vitest dispatch suite', run(process.execPath, [
    vitestReal, 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
    'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose',
  ], { cwd: worktreeDir }));

  // Control: the same proof commands through the pnpm .bin entries as executables
  // (the shape R-CW-6 uses), to separate invocation shape from product behaviour.
  report('control .bin/tsx --eval (as executable)', run(path.join(worktreeDir, 'node_modules', '.bin', 'tsx'),
    ['--eval', 'import { checkContinuationBudget } from "./src/auto-reply/continuation/scheduler.ts"; console.log(typeof checkContinuationBudget)'],
    { cwd: worktreeDir }));
  report('control .bin/vitest dispatch suite (as executable)', run(path.join(worktreeDir, 'node_modules', '.bin', 'vitest'), [
    'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
    'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose',
  ], { cwd: worktreeDir }));
} finally {
  const remove = run('/usr/bin/git', ['-C', cloneDir, 'worktree', 'remove', '--force', worktreeDir], {});
  console.log(`\n=== scratch worktree removed: ${remove.ok}`);
}
