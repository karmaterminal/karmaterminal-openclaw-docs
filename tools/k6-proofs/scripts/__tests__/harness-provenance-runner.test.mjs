/**
 * harness-provenance-runner.test.mjs — #495 / #496.
 *
 * The 2026-08-01 Project 86 matrix fired from a detached July harness commit
 * while docs `main` had moved on, recorded no docs ref in any
 * `runner-metadata.json`, and turned a catalog root-resolution error into
 * per-row product failures.
 *
 * These tests pin the repaired runner contract:
 *   - catalog preflight and harness identity are checked before any row runs;
 *   - a missing, malformed, mismatched, dirty, or unrecorded harness fails once
 *     as infrastructure and leaves exactly one control receipt;
 *   - an approved run freezes the docs ref and records the exact manifest and
 *     scenario digests it fired.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildHarnessCheckout, HARNESS_REPOSITORY } from './helpers/harness-checkout.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const run = promisify(execFile);
const candidateSha = 'a'.repeat(40);
const HARNESS_INFRA_EXIT = 78;

async function withRunner(fn, { mutate = null } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'p86-harness-provenance-'));
  const out = path.join(root, 'out');
  await mkdir(out, { recursive: true });
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));
  if (mutate) await mutate(harness);
  try {
    return await fn({ ...harness, out, root });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function invokeRunner(harness, { rows = 'R-CD-2', args = [], env = {} } = {}) {
  try {
    const result = await run(
      'bash',
      ['scripts/run-proofs.sh', '--live', '--out-dir', harness.out, ...args, rows, candidateSha],
      {
        cwd: harness.proofsDir,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          OPENCLAW_PROOFS_DOCS_REF: '',
          OPENCLAW_GATEWAY_TOKEN: 'harness-provenance-test-token',
          OPENCLAW_SESSION_KEY: 'main',
          OPENCLAW_SEAT_NAME: 'contract-seat',
          OPENCLAW_CANDIDATE_SHA: candidateSha,
          OPENCLAW_RUNTIME_BUILD_SHA: candidateSha,
          ...env,
        },
      },
    );
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout || '', stderr: error.stderr || '' };
  }
}

async function controlReceipt(harness) {
  return JSON.parse(await readFile(path.join(harness.out, 'harness-control-receipt.json'), 'utf8'));
}

/** No candidate run directory may exist when the harness failed closed. */
async function assertNoRowsExecuted(harness) {
  const entries = await readdir(harness.out, { withFileTypes: true });
  const rowDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual(rowDirs, [], `harness failure must not create candidate run directories: ${rowDirs.join(', ')}`);
  await assert.rejects(readFile(path.join(harness.out, 'harness-provenance.json'), 'utf8'), /ENOENT/);
}

async function assertInfrastructureFailure(harness, result, { stage, check }) {
  assert.equal(result.code, HARNESS_INFRA_EXIT, `expected harness infrastructure exit ${HARNESS_INFRA_EXIT}: ${result.stderr}`);
  const receipt = await controlReceipt(harness);
  assert.equal(receipt.schema, 'openclaw.k6.harness-control-receipt.v1');
  assert.equal(receipt.classification, 'harness-infrastructure');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.stage, stage);
  assert.equal(receipt.rowsExecuted, 0);
  assert.equal(receipt.rowVerdictsSynthesized, false);
  assert.equal(receipt.productVerdict, null);
  assert.equal(receipt.exitCode, HARNESS_INFRA_EXIT);
  if (check) assert.equal(receipt.detail.check, check);
  await assertNoRowsExecuted(harness);
  return receipt;
}

test('a live matrix refuses to fire without an approved docs ref', async () => {
  await withRunner(async (harness) => {
    const result = await invokeRunner(harness);
    const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'docs-ref-shape' });
    assert.equal(receipt.docsRef, null);
    assert.equal(receipt.docsRefRequested, null);
    assert.match(result.stderr, /requires an approved docs\/harness ref/);
    assert.deepEqual(receipt.rowSelection, ['R-CD-2']);
  });
});

test('a malformed docs ref is rejected before any row runs', async (t) => {
  for (const malformed of ['not-a-sha', 'A'.repeat(40), 'abc123', `${'a'.repeat(39)}`]) {
    await t.test(`rejects ${malformed.slice(0, 12)}`, async () => {
      await withRunner(async (harness) => {
        const result = await invokeRunner(harness, { args: ['--docs-ref', malformed] });
        const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'docs-ref-shape' });
        // A public receipt records only that the input was malformed; it never
        // echoes an arbitrary operator-supplied string.
        assert.equal(receipt.docsRefRequested, 'malformed');
        assert.equal(receipt.detail.provided, 'malformed');
        assert.equal(receipt.docsRef, null);
      });
    });
  }
});

test('a docs ref that is not the current checkout fails closed as stale or mixed', async () => {
  await withRunner(async (harness) => {
    const stale = 'f'.repeat(40);
    const result = await invokeRunner(harness, { args: ['--docs-ref', stale] });
    const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'head-equals-docs-ref' });
    assert.equal(receipt.detail.approved, stale);
    assert.equal(receipt.detail.head, harness.docsRef);
    assert.match(result.stderr, /stale or mixed harness/);
  });
});

test('the docs ref may be supplied through the named environment variable', async () => {
  await withRunner(async (harness) => {
    const stale = 'f'.repeat(40);
    const result = await invokeRunner(harness, { env: { OPENCLAW_PROOFS_DOCS_REF: stale } });
    const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'head-equals-docs-ref' });
    assert.equal(receipt.detail.approved, stale);
  });
});

test('mutated tracked harness bytes fail closed before any row runs', async () => {
  await withRunner(
    async (harness) => {
      const result = await invokeRunner(harness, { args: ['--docs-ref', harness.docsRef] });
      const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'harness-tree-clean' });
      assert.ok(receipt.detail.dirtyEntries >= 1);
      assert.match(result.stderr, /dirty harness cannot certify/);
    },
    {
      mutate: async (harness) => {
        const scenario = path.join(harness.proofsDir, 'scenarios/r-cd-2-silent-wake.js');
        await writeFile(scenario, `${await readFile(scenario, 'utf8')}\n// local edit after the approved commit\n`);
      },
    },
  );
});

test('a row whose contract is untracked at the approved ref fails closed', async () => {
  await withRunner(
    async (harness) => {
      const result = await invokeRunner(harness, { rows: 'R-UNRECORDED', args: ['--docs-ref', harness.docsRef] });
      const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'tracked-at-docs-ref' });
      assert.equal(receipt.detail.row, 'R-UNRECORDED');
      assert.match(receipt.detail.path, /^tools\/k6-proofs\//);
      assert.match(result.stderr, /not tracked at the approved docs ref/);
    },
    {
      // Untracked-but-present bytes: `git status` on tracked files stays clean,
      // so only the tracked-at-commit check can catch this.
      mutate: async (harness) => {
        await writeFile(path.join(harness.proofsDir, 'scenarios/r-unrecorded.js'), 'export default function () {}\n');
        await writeFile(path.join(harness.proofsDir, 'manifests/r-unrecorded.json'), `${JSON.stringify({
          schema: 'openclaw.k6.proof-row-manifest.v1',
          rowId: 'R-UNRECORDED',
          scenario: { status: 'runnable', name: 'r-unrecorded', file: 'r-unrecorded.js' },
          liveRunSafety: {
            classification: 'k6-runnable',
            expectedArtifactClass: 'PASS-candidate',
            foldRequiresReview: true,
            requiresCandidateSha: true,
            requiredReceipts: ['seat-readiness'],
          },
        }, null, 2)}\n`);
      },
    },
  );
});

test('a catalog preflight failure stops the matrix as harness infrastructure', async () => {
  await withRunner(
    async (harness) => {
      const result = await invokeRunner(harness, { args: ['--docs-ref', harness.docsRef] });
      const receipt = await assertInfrastructureFailure(harness, result, { stage: 'catalog-preflight' });
      assert.equal(receipt.detail.failedCheck, 'check-scenario-alignment.mjs');
      assert.equal(receipt.detail.log, 'catalog-preflight.log');
      const log = await readFile(path.join(harness.out, 'catalog-preflight.log'), 'utf8');
      assert.match(log, /k6-proof\.yml/);
      assert.match(result.stderr, /catalog validator .* failed/);
      assert.doesNotMatch(log, /tools\/k6-proofs\/tools\/k6-proofs/);
    },
    {
      // Break the catalog outside tools/k6-proofs so the harness identity gate,
      // which now runs first, still passes and the preflight is what fails.
      mutate: async (harness) => {
        await rm(path.join(harness.checkout, '.github/workflows/k6-proof.yml'));
      },
    },
  );
});

test('catalog validators run with no inherited environment at all', async () => {
  // A validator is executed by the runner, so it must be unable to observe any
  // ambient credential even if it tries.
  const probe = [
    '#!/bin/sh',
    'case "$*" in',
    '  *check-manifest-scenarios.mjs*)',
    '    printf \'PROBE TOKEN_SEEN=%s HOME_SEEN=%s\\n\' "${OPENCLAW_GATEWAY_TOKEN:-<absent>}" "${HOME:-<absent>}"',
    '    ;;',
    'esac',
    `exec ${process.execPath} "$@"`,
    '',
  ].join('\n');

  await withApprovedMatrix(
    async (harness) => {
      const result = await harness.invoke();
      assert.equal(result.code, 0, result.stderr);
      const log = await readFile(path.join(harness.out, 'catalog-preflight.log'), 'utf8');
      assert.match(log, /PROBE TOKEN_SEEN=<absent> HOME_SEEN=<absent>/);
      assert.doesNotMatch(log, new RegExp(APPROVED_TOKEN));
    },
    { nodeShim: probe },
  );
});

test('the runner resolves its own harness root regardless of the caller working directory', async () => {
  await withRunner(async (harness) => {
    const dryRun = async (cwd, script) => {
      const out = await mkdtemp(path.join(harness.root, 'dry-'));
      const result = await run('bash', [script, '--dry-run', '--out-dir', out, 'R-CD-2,R-CW-1', candidateSha], {
        cwd,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          OPENCLAW_PROOFS_DOCS_REF: '',
          OPENCLAW_SESSION_KEY: 'main',
          OPENCLAW_SEAT_NAME: 'contract-seat',
          OPENCLAW_CANDIDATE_SHA: candidateSha,
        },
      });
      const provenance = JSON.parse(await readFile(path.join(out, 'harness-provenance.json'), 'utf8'));
      return { provenance, stdout: result.stdout };
    };

    const fromToolDir = await dryRun(harness.proofsDir, 'scripts/run-proofs.sh');
    const fromRepoRoot = await dryRun(harness.checkout, './tools/k6-proofs/scripts/run-proofs.sh');

    const expectedRunnerDigest = createHash('sha256')
      .update(await readFile(path.join(harness.proofsDir, 'scripts/run-proofs.sh')))
      .digest('hex');
    for (const invocation of [fromToolDir, fromRepoRoot]) {
      assert.deepEqual(invocation.provenance.rowSelection, ['R-CD-2', 'R-CW-1']);
      assert.equal(invocation.provenance.mode, 'dry-run');
      assert.equal(invocation.provenance.harnessIdentityVerified, false);
      assert.equal(invocation.provenance.runnerScriptSha256, expectedRunnerDigest);
      assert.match(invocation.stdout, /\[R-CD-2\] DRY RUN/);
      assert.match(invocation.stdout, /CATALOG PREFLIGHT/);
    }
    assert.deepEqual(fromRepoRoot.provenance.rows, fromToolDir.provenance.rows);
  });
});

const APPROVED_TOKEN = 'harness-provenance-test-token-do-not-log';

/**
 * Drive the runner all the way through the identity gate, seat readiness, and
 * provenance emission with stubbed tooling. R-CW-5A is runnable but
 * static-preflight-only, so no live k6 row is dispatched.
 */
async function withApprovedMatrix(fn, { afterCommit = null, rows = 'R-CW-5A', nodeShim = null, nodeShimFor = null, journalShimFor = null, envFor = null } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'p86-harness-provenance-ok-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  await Promise.all([mkdir(bin, { recursive: true }), mkdir(out, { recursive: true })]);
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));
  if (afterCommit) await afterCommit(harness);

  const gateway = createServer((req, res) => res.writeHead(req.url.startsWith('/health') || req.url.startsWith('/status') ? 200 : 404).end('{}'));
  await new Promise((resolve) => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayPort = gateway.address().port;

  const executable = async (name, source) => {
    const file = path.join(bin, name);
    await writeFile(file, source, { mode: 0o755 });
    await chmod(file, 0o755);
  };

  try {
    await executable('k6', "#!/bin/sh\nif [ \"${1:-}\" = version ]; then printf '%s\\n' 'k6 v2.0.0'; exit 0; fi\nexit 0\n");
    await executable('openclaw', '#!/bin/sh\nprintf \'%s\\n\' \'{"enabled":true,"maxChainLength":3,"maxDelegatesPerTurn":3,"costCapTokens":3}\'\n');
    await executable('hostname', "#!/bin/sh\nprintf '%s\\n' contract-seat\n");
    const shimSource = nodeShimFor ? nodeShimFor(harness) : nodeShim;
    if (shimSource) await executable('node', shimSource);
    if (journalShimFor) await executable('journalctl', journalShimFor(harness));

    const invoke = async () => {
      try {
        const ok = await run(
          'bash',
          ['scripts/run-proofs.sh', '--live', '--out-dir', out, '--docs-ref', harness.docsRef, rows, candidateSha],
          {
            cwd: harness.proofsDir,
            encoding: 'utf8',
            timeout: 60_000,
            env: {
              ...process.env,
              PATH: `${bin}:${process.env.PATH}`,
              K6_BIN: path.join(bin, 'k6'),
              OPENCLAW_GATEWAY_TOKEN: APPROVED_TOKEN,
              OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${gatewayPort}`,
              OPENCLAW_SESSION_KEY: 'main',
              OPENCLAW_SEAT_NAME: 'contract-seat',
              OPENCLAW_CANDIDATE_SHA: candidateSha,
              OPENCLAW_RUNTIME_BUILD_SHA: candidateSha,
              ...(envFor ? envFor(harness) : {}),
            },
          },
        );
        return { code: 0, stdout: ok.stdout, stderr: ok.stderr };
      } catch (error) {
        return { code: error.code, stdout: error.stdout || '', stderr: error.stderr || '' };
      }
    };

    return await fn({ ...harness, out, root, invoke });
  } finally {
    await new Promise((resolve) => gateway.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

test('the catalog preflight log is public-safe: no credentials, no local paths', async () => {
  await withApprovedMatrix(async (harness) => {
    const result = await harness.invoke();
    assert.equal(result.code, 0, result.stderr);
    const log = await readFile(path.join(harness.out, 'catalog-preflight.log'), 'utf8');
    assert.doesNotMatch(log, new RegExp(APPROVED_TOKEN));
    assert.ok(!log.includes(harness.checkout), 'the checkout path must not reach a public log');
    assert.ok(!log.includes(harness.out), 'the artifact root path must not reach a public log');
  });

  // Force a validator to print an absolute path and require it to be scrubbed.
  await withApprovedMatrix(
    async (harness) => {
      const result = await harness.invoke();
      assert.equal(result.code, HARNESS_INFRA_EXIT);
      const log = await readFile(path.join(harness.out, 'catalog-preflight.log'), 'utf8');
      assert.match(log, /<repo-root>\/PROOFS\/INDEX\.json/);
      assert.ok(!log.includes(harness.checkout), 'the checkout path must not reach a public log');
      assert.doesNotMatch(log, new RegExp(APPROVED_TOKEN));
    },
    { afterCommit: async (harness) => rm(path.join(harness.checkout, 'PROOFS/INDEX.json')) },
  );
});

test('harness bytes mutated after the gate froze them fail closed before capture', async () => {
  // The shim mutates a selected scenario while seat readiness runs, i.e. after
  // the identity gate froze its digest but before the row is captured.
  const shimFor = (harness) => [
    '#!/bin/sh',
    'case "$*" in',
    '  *seat-readiness-preflight.mjs*)',
    `    printf '\\n// mutated after the approved ref was frozen\\n' >> ${path.join(harness.proofsDir, 'scenarios/r-cd-2-silent-wake.js')}`,
    '    ;;',
    'esac',
    `exec ${process.execPath} "$@"`,
    '',
  ].join('\n');

  await withApprovedMatrix(
    async (harness) => {
      const result = await harness.invoke();
      assert.equal(result.code, HARNESS_INFRA_EXIT, result.stderr);
      const receipt = JSON.parse(await readFile(path.join(harness.out, 'harness-control-receipt.json'), 'utf8'));
      assert.equal(receipt.stage, 'harness-identity');
      assert.equal(receipt.detail.check, 'frozen-bytes-still-current');
      assert.equal(receipt.detail.phase, 'pre-capture');
      assert.equal(receipt.detail.scenarioChanged, true);
      assert.equal(receipt.rowsExecuted, 0);
      assert.equal(receipt.rowVerdictsSynthesized, false);
      assert.match(result.stderr, /refusing to execute unapproved source/);
      await assert.rejects(readFile(path.join(harness.out, candidateSha, 'R-CD-2'), 'utf8'), /ENOENT/);
    },
    { rows: 'R-CD-2', nodeShimFor: shimFor },
  );
});

test('a mutation caught after capture removes the provisional run directory', async () => {
  // journalctl is invoked after the run directory exists but before k6 starts,
  // so mutating there exercises the pre-k6-execution assertion with a partially
  // written row on disk. That directory holds no candidate evidence and must not
  // survive as one.
  const journalFor = (harness) => [
    '#!/bin/sh',
    'case " $* " in',
    '  *" --show-cursor "*)',
    `    printf '\\n// mutated between capture and execution\\n' >> ${path.join(harness.proofsDir, 'scenarios/r-cd-2-silent-wake.js')}`,
    "    printf '%s\\n' '-- cursor: provisional-purge'",
    '    ;;',
    'esac',
    '',
  ].join('\n');

  await withApprovedMatrix(
    async (harness) => {
      const result = await harness.invoke();
      assert.equal(result.code, HARNESS_INFRA_EXIT, result.stderr);
      const receipt = JSON.parse(await readFile(path.join(harness.out, 'harness-control-receipt.json'), 'utf8'));
      assert.equal(receipt.stage, 'harness-identity');
      assert.equal(receipt.detail.check, 'frozen-bytes-still-current');
      assert.equal(receipt.detail.phase, 'pre-k6-execution');
      assert.equal(receipt.rowsExecuted, 0);
      assert.equal(receipt.rowVerdictsSynthesized, false);
      const seatDir = path.join(harness.out, candidateSha, 'R-CD-2', 'contract-seat');
      assert.deepEqual(
        await readdir(seatDir),
        [],
        'a provisional run directory must not survive a pre-execution infrastructure failure',
      );
    },
    { rows: 'R-CD-2', journalShimFor: journalFor },
  );
});

test('an approved live run tolerates a git replacement object without trusting it', async () => {
  // `git replace` rewrites what plain `git show`/`cat-file` return. The identity
  // gate must read the true object store, so the run still verifies clean.
  await withApprovedMatrix(
    async (harness) => {
      const result = await harness.invoke();
      assert.equal(result.code, 0, result.stderr);
      const provenance = JSON.parse(await readFile(path.join(harness.out, 'harness-provenance.json'), 'utf8'));
      assert.equal(provenance.harnessIdentityVerified, true);
      assert.equal(provenance.docsRef, harness.docsRef);
      await assert.rejects(readFile(path.join(harness.out, 'harness-control-receipt.json'), 'utf8'), /ENOENT/);
    },
    {
      afterCommit: async (harness) => {
        const git = (...args) => run('git', ['-C', harness.checkout, ...args], { encoding: 'utf8' });
        const scenario = path.join(harness.proofsDir, 'scenarios/static-corpus-row-validator.js');
        const original = await readFile(scenario, 'utf8');
        await writeFile(scenario, `${original}\n// decoy commit content\n`);
        await git('add', '--all');
        await git('commit', '--quiet', '--message', 'decoy');
        const { stdout } = await git('rev-parse', 'HEAD');
        const decoy = stdout.trim();
        await git('checkout', '--quiet', harness.docsRef);
        await git('replace', harness.docsRef, decoy);
      },
    },
  );
});

test('an approved live run freezes the docs ref and records the exact harness digests', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'p86-harness-provenance-ok-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  await Promise.all([mkdir(bin, { recursive: true }), mkdir(out, { recursive: true })]);
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));

  const gateway = createServer((req, res) => res.writeHead(req.url.startsWith('/health') || req.url.startsWith('/status') ? 200 : 404).end('{}'));
  await new Promise((resolve) => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayPort = gateway.address().port;

  const executable = async (name, source) => {
    const file = path.join(bin, name);
    await writeFile(file, source, { mode: 0o755 });
    await chmod(file, 0o755);
  };

  try {
    await executable('k6', "#!/bin/sh\nif [ \"${1:-}\" = version ]; then printf '%s\\n' 'k6 v2.0.0'; exit 0; fi\nexit 0\n");
    await executable('openclaw', '#!/bin/sh\nprintf \'%s\\n\' \'{"enabled":true,"maxChainLength":3,"maxDelegatesPerTurn":3,"costCapTokens":3}\'\n');
    await executable('hostname', "#!/bin/sh\nprintf '%s\\n' contract-seat\n");

    // R-CW-5A is runnable but static-preflight-only, so the identity gate and
    // provenance receipt are exercised without dispatching a live k6 row.
    const result = await run(
      'bash',
      ['scripts/run-proofs.sh', '--live', '--out-dir', out, '--docs-ref', harness.docsRef, 'R-CW-5A', candidateSha],
      {
        cwd: harness.proofsDir,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          K6_BIN: path.join(bin, 'k6'),
          OPENCLAW_GATEWAY_TOKEN: 'harness-provenance-test-token',
          OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${gatewayPort}`,
          OPENCLAW_SESSION_KEY: 'main',
          OPENCLAW_SEAT_NAME: 'contract-seat',
          OPENCLAW_CANDIDATE_SHA: candidateSha,
          OPENCLAW_RUNTIME_BUILD_SHA: candidateSha,
        },
      },
    );

    await assert.rejects(readFile(path.join(out, 'harness-control-receipt.json'), 'utf8'), /ENOENT/);
    const provenance = JSON.parse(await readFile(path.join(out, 'harness-provenance.json'), 'utf8'));
    assert.equal(provenance.schema, 'openclaw.k6.harness-provenance.v1');
    assert.equal(provenance.mode, 'live');
    assert.equal(provenance.docsRef, harness.docsRef);
    assert.equal(provenance.docsRefSource, 'approved-input');
    assert.equal(provenance.harnessIdentityVerified, true);
    assert.equal(provenance.repository, HARNESS_REPOSITORY);
    assert.equal(provenance.candidateSha, candidateSha);
    assert.equal(provenance.runtimeIdentity.runtimeBuildSha, candidateSha);
    assert.equal(provenance.runtimeIdentity.candidateMatchesRuntime, true);
    assert.equal(provenance.runtimeIdentity.seatReadinessReceipt, 'seat-readiness.json');
    assert.match(provenance.runtimeIdentity.seatReadinessSha256, /^[a-f0-9]{64}$/);
    assert.equal(provenance.runnerScript, 'tools/k6-proofs/scripts/run-proofs.sh');
    assert.match(provenance.runnerScriptSha256, /^[a-f0-9]{64}$/);
    assert.equal(provenance.candidateOnly, true);
    assert.equal(provenance.foldRequiresReview, true);
    assert.match(provenance.startedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.deepEqual(provenance.rowSelection, ['R-CW-5A']);

    const sha256 = async (relative) => createHash('sha256')
      .update(await readFile(path.join(harness.checkout, relative)))
      .digest('hex');
    assert.deepEqual(provenance.rows, [{
      rowId: 'R-CW-5A',
      manifestPath: 'tools/k6-proofs/manifests/r-cw-5a-static.json',
      manifestSha256: await sha256('tools/k6-proofs/manifests/r-cw-5a-static.json'),
      scenarioPath: 'tools/k6-proofs/scenarios/static-corpus-row-validator.js',
      scenarioSha256: await sha256('tools/k6-proofs/scenarios/static-corpus-row-validator.js'),
    }]);

    // The runner script digest is a real digest of the script it just ran.
    assert.equal(provenance.runnerScriptSha256, await sha256('tools/k6-proofs/scripts/run-proofs.sh'));
    assert.match(result.stdout, /Approved docs ref: [0-9a-f]{40}/);
    assert.match(result.stdout, /Harness identity: verified clean and tracked/);
    assert.match(result.stdout, /\[R-CW-5A\] SKIPPED: liveRunSafety classification/);

    const receipt = JSON.stringify(provenance);
    assert.doesNotMatch(receipt, /harness-provenance-test-token/);
    assert.doesNotMatch(receipt, new RegExp(root.replaceAll('/', '\\/')));
  } finally {
    await new Promise((resolve) => gateway.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
