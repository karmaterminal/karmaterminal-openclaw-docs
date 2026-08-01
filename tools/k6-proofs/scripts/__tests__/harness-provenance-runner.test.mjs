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

async function invokeRunner(harness, { rows = 'R-CD-2', args = [], env = {}, candidate = candidateSha } = {}) {
  try {
    const result = await run(
      'bash',
      ['scripts/run-proofs.sh', '--live', '--out-dir', harness.out, ...args, rows, candidate],
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
      assert.equal(receipt.detail.phase, 'startup');
      assert.ok(receipt.detail.trackedFiles > 1, 'the whole tracked tree must be verified, not one file');
      assert.match(result.stderr, /do not match the approved docs ref/);
    },
    {
      mutate: async (harness) => {
        const scenario = path.join(harness.proofsDir, 'scenarios/r-cd-2-silent-wake.js');
        await writeFile(scenario, `${await readFile(scenario, 'utf8')}\n// local edit after the approved commit\n`);
      },
    },
  );
});

test('an index-hidden mutation cannot pass as a clean harness', async (t) => {
  // `git status` consults the index, so assume-unchanged / skip-worktree hide a
  // modified file from it. The gate hashes working-tree bytes instead, which
  // cannot be suppressed that way.
  for (const flag of ['--assume-unchanged', '--skip-worktree']) {
    await t.test(`hidden with ${flag}`, async () => {
      await withRunner(
        async (harness) => {
          const status = await run(
            'git',
            ['-C', harness.checkout, 'status', '--porcelain', '--untracked-files=no', '--', 'tools/k6-proofs'],
            { encoding: 'utf8' },
          );
          assert.equal(status.stdout, '', 'the mutation must be invisible to git status for this test to mean anything');

          const result = await invokeRunner(harness, { args: ['--docs-ref', harness.docsRef] });
          const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'harness-tree-clean' });
          assert.ok(receipt.detail.trackedFiles > 1);
          assert.match(result.stderr, /do not match the approved docs ref/);
        },
        {
          mutate: async (harness) => {
            // A shared library a scenario imports, not the scenario itself.
            const library = 'tools/k6-proofs/lib/gateway-ws.js';
            await run('git', ['-C', harness.checkout, 'update-index', flag, '--', library], { encoding: 'utf8' });
            const file = path.join(harness.checkout, library);
            await writeFile(file, `${await readFile(file, 'utf8')}\n// hidden from the index\n`);
          },
        },
      );
    });
  }
});

test('a row whose contract is untracked at the approved ref fails closed', async () => {
  await withRunner(
    async (harness) => {
      const result = await invokeRunner(harness, { rows: 'R-UNRECORDED', args: ['--docs-ref', harness.docsRef] });
      const receipt = await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'row-recorded-at-docs-ref' });
      assert.equal(receipt.detail.row, 'R-UNRECORDED');
      assert.equal(receipt.detail.approved, harness.docsRef);
      assert.match(result.stderr, /unrecorded rows cannot be fired or counted/);
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
      assert.equal(receipt.detail.failedCheck, 'check-proof-row-manifests.mjs');
      assert.equal(receipt.detail.log, 'catalog-preflight.log');
      const log = await readFile(path.join(harness.out, 'catalog-preflight.log'), 'utf8');
      assert.match(log, /proof rows missing manifest entries: R-PHANTOM/);
      assert.match(result.stderr, /catalog validator .* failed/);
      assert.doesNotMatch(log, /tools\/k6-proofs\/tools\/k6-proofs/);
    },
    {
      // Every tracked tree is byte-verified before the preflight runs, so the
      // catalog is broken with an untracked stray corpus directory instead:
      // a real, tracked-byte-preserving way to reach a preflight failure.
      mutate: async (harness) => {
        const indexRaw = await readFile(path.join(harness.checkout, 'PROOFS/INDEX.json'), 'utf8');
        const currentSha = JSON.parse(indexRaw).current_sha;
        await mkdir(path.join(harness.checkout, 'PROOFS', currentSha, 'R-PHANTOM'), { recursive: true });
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
    '    printf \'PROBE TOKEN_SEEN=%s HOME_SEEN=%s CWD=%s\\n\' "${OPENCLAW_GATEWAY_TOKEN:-<absent>}" "${HOME:-<absent>}" "$(pwd)"',
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
      // The validator ran from the snapshot, and that private path is scrubbed
      // out of the published log.
      assert.match(log, /CWD=<harness>\/tools\/k6-proofs/);
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
async function withApprovedMatrix(fn, { afterCommit = null, rows = 'R-CW-5A', nodeShim = null, nodeShimFor = null, journalShimFor = null, k6ShimFor = null, envFor = null } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'p86-harness-provenance-ok-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  await Promise.all([mkdir(bin, { recursive: true }), mkdir(out, { recursive: true })]);
  const built = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));
  const harness = { ...built, root, out };
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
    await executable('k6', k6ShimFor ? k6ShimFor(harness) : "#!/bin/sh\nif [ \"${1:-}\" = version ]; then printf '%s\\n' 'k6 v2.0.0'; exit 0; fi\nexit 0\n");
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

    return await fn({ ...harness, invoke });
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

  // The failure path publishes validator output too, and must be just as safe.
  await withApprovedMatrix(
    async (harness) => {
      const result = await harness.invoke();
      assert.equal(result.code, HARNESS_INFRA_EXIT);
      const log = await readFile(path.join(harness.out, 'catalog-preflight.log'), 'utf8');
      assert.match(log, /proof rows missing manifest entries: R-PHANTOM/);
      assert.ok(!log.includes(harness.checkout), 'the checkout path must not reach a public log');
      assert.ok(!log.includes(harness.out), 'the artifact root path must not reach a public log');
      assert.doesNotMatch(log, new RegExp(APPROVED_TOKEN));
      assert.doesNotMatch(log, /\/tmp\/openclaw-k6-harness\./, 'the snapshot path must not reach a public log');
    },
    {
      afterCommit: async (harness) => {
        const indexRaw = await readFile(path.join(harness.checkout, 'PROOFS/INDEX.json'), 'utf8');
        const currentSha = JSON.parse(indexRaw).current_sha;
        await mkdir(path.join(harness.checkout, 'PROOFS', currentSha, 'R-PHANTOM'), { recursive: true });
      },
    },
  );
});

test('harness bytes mutated after the gate froze them fail closed before capture', async () => {
  // The shim mutates the operator's copy of a selected scenario while seat
  // readiness runs. The executed bytes live in the immutable snapshot, so this
  // cannot change what runs — but run-proofs.sh itself is read incrementally
  // from that same checkout, so a mid-matrix mutation must still fail closed.
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
      assert.equal(receipt.detail.check, 'harness-tree-still-current');
      assert.equal(receipt.detail.phase, 'pre-capture');
      assert.ok(receipt.detail.trackedFiles > 1);
      assert.equal(receipt.rowsExecuted, 0);
      assert.equal(receipt.rowVerdictsSynthesized, false);
      assert.match(result.stderr, /do not match the approved docs ref/);
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
      assert.equal(receipt.detail.check, 'harness-tree-still-current');
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

test('a live matrix refuses an unvalidated candidate SHA before creating artifacts', async () => {
  await withRunner(async (harness) => {
    const result = await invokeRunner(harness, {
      args: ['--docs-ref', harness.docsRef],
      candidate: '../../etc/passwd',
      env: { OPENCLAW_CANDIDATE_SHA: '' },
    });
    await assertInfrastructureFailure(harness, result, { stage: 'harness-identity', check: 'candidate-sha-shape' });
    const receipt = await controlReceipt(harness);
    // Rejected input must not survive anywhere in the public receipt.
    assert.equal(receipt.candidateSha, 'malformed');
    assert.ok(!JSON.stringify(receipt).includes('passwd'));
  });
});

test('rows execute from an immutable snapshot, not from the operator checkout', async () => {
  // Direct observation: the k6 process records where it was actually run from
  // and the bytes of the scenario it was handed.
  await withApprovedMatrix(
    async (harness) => {
      // The row's own verdict is irrelevant here; only where it executed is.
      await harness.invoke();
      const [cwd, scenarioDigest] = (await readFile(path.join(harness.root, 'k6-observed.txt'), 'utf8')).trim().split('\n');

      assert.ok(cwd, 'k6 must have run');
      assert.ok(
        !cwd.startsWith(harness.checkout),
        `k6 must not execute from the operator checkout, ran in ${cwd.startsWith(harness.checkout) ? '<checkout>' : '<snapshot>'}`,
      );
      const approved = (await run(
        'git',
        ['-C', harness.checkout, 'show', `${harness.docsRef}:tools/k6-proofs/scenarios/r-cd-2-silent-wake.js`],
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      )).stdout;
      assert.equal(
        scenarioDigest,
        createHash('sha256').update(approved).digest('hex'),
        'the executed scenario bytes must be the approved committed bytes',
      );
    },
    {
      rows: 'R-CD-2',
      k6ShimFor: (harness) => [
        '#!/bin/sh',
        'if [ "${1:-}" = version ]; then printf \'%s\\n\' \'k6 v2.0.0\'; exit 0; fi',
        `{ pwd; sha256sum "$2" | cut -d' ' -f1; } > ${path.join(harness.root, 'k6-observed.txt')}`,
        "printf '%s %s\\n' '=== K6-PROOF-EVIDENCE ===' '{\"row\":\"R-CD-2\"}'",
        'exit 0',
        '',
      ].join('\n'),
    },
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
  await withApprovedMatrix(async (harness) => {
    const result = await harness.invoke();
    assert.equal(result.code, 0, result.stderr);
    await assert.rejects(readFile(path.join(harness.out, 'harness-control-receipt.json'), 'utf8'), /ENOENT/);
      const provenance = JSON.parse(await readFile(path.join(harness.out, 'harness-provenance.json'), 'utf8'));
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
      assert.match(result.stdout, /Harness identity: every tracked byte under tools\/k6-proofs matches the approved docs ref/);
      assert.match(result.stdout, /Harness contract binding: frozen manifest\/scenario digests/);
      assert.match(result.stdout, /\[R-CW-5A\] SKIPPED: liveRunSafety classification/);

      const receipt = JSON.stringify(provenance);
      assert.doesNotMatch(receipt, /harness-provenance-test-token/);
      assert.doesNotMatch(receipt, new RegExp(harness.root.replaceAll('/', '\\/')));
  });
});
