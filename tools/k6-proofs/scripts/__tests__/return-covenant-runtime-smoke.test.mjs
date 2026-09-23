import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../lib/canonical-json.mjs';
import {
  childTerminationReason,
} from '../../lib/return-covenant-candidate-io.mjs';
import {
  inspectProcessLoopbackListeners,
} from '../../lib/return-covenant-driver-attestation.mjs';
import {
  waitForTrackedGatewayListeners,
} from '../../lib/return-covenant-gateway-listener.mjs';
import {
  verifyPublishedReturnCovenantRuntimeConfig,
} from '../../lib/return-covenant-runtime-config.mjs';

const PRODUCT_SHA = '0ed59cb64f31971e8659b417fe3fd2ba6a1730c3';
const PRODUCT_TREE_SHA = '52b6141c80e575813f94241635ce02007b50d140';
const root = path.resolve(import.meta.dirname, '../..');
const repoRoot = path.resolve(root, '../..');
const fixtureDir = path.join(
  root,
  'tests/fixtures/return-covenant-authority',
);
const runtimeConfigPath = path.join(
  fixtureDir,
  'runtime-config.valid.json',
);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function git(directory, args) {
  const result = spawnSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

async function spawnCaptured(source) {
  const child = spawn(process.execPath, ['-e', source], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  return {
    child,
    exit,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

async function stopCaptured(captured) {
  if (!childTerminationReason(captured.child)) {
    captured.child.kill('SIGTERM');
  }
  await captured.exit;
}

function eacces() {
  return Object.assign(new Error('deterministic proc observer denial'), {
    code: 'EACCES',
  });
}

test('listener inspection retries transient EACCES and binds the real child socket', async () => {
  const captured = await spawnCaptured(
    "require('node:net').createServer().listen(0, '127.0.0.1');",
  );
  let attempts = 0;
  try {
    const listeners = await waitForTrackedGatewayListeners({
      child: captured.child,
      inspect: async (pid) => {
        attempts += 1;
        if (attempts <= 2) throw eacces();
        return inspectProcessLoopbackListeners(pid);
      },
      stdout: captured.stdout,
      stderr: captured.stderr,
      timeoutMs: 2_000,
      retryDelayMs: 5,
    });
    assert.ok(attempts > 2);
    assert.ok(listeners.length > 0);
    assert.ok(
      listeners.every((entry) =>
        entry.endpoint.startsWith('http://127.0.0.1:')),
    );
  } finally {
    await stopCaptured(captured);
  }
});

test('listener inspection rejects a persistently inaccessible live child', async () => {
  const captured = await spawnCaptured(
    "require('node:net').createServer().listen(0, '127.0.0.1');",
  );
  try {
    await assert.rejects(
      waitForTrackedGatewayListeners({
        child: captured.child,
        inspect: async () => {
          throw eacces();
        },
        stdout: captured.stdout,
        stderr: captured.stderr,
        timeoutMs: 150,
        retryDelayMs: 5,
      }),
      /remained inaccessible through bounded listener inspection \(EACCES\)/,
    );
    assert.equal(childTerminationReason(captured.child), null);
  } finally {
    await stopCaptured(captured);
  }
});

test('listener inspection surfaces child exit and stderr through EACCES', async () => {
  const underlying = 'UNDERLYING_GATEWAY_CONFIG_FAILURE';
  const captured = await spawnCaptured(
    `setTimeout(() => { console.error('${underlying}'); process.exit(78); }, 30);`,
  );
  try {
    await assert.rejects(
      waitForTrackedGatewayListeners({
        child: captured.child,
        inspect: async () => {
          throw eacces();
        },
        stdout: captured.stdout,
        stderr: captured.stderr,
        timeoutMs: 2_000,
        retryDelayMs: 5,
      }),
      (error) => {
        assert.match(error.message, /tracked gateway exited before listening \(exit 78\)/);
        assert.match(error.message, new RegExp(underlying));
        assert.doesNotMatch(error.message, /deterministic proc observer denial/);
        return true;
      },
    );
    await captured.exit;
  } finally {
    if (!childTerminationReason(captured.child)) await stopCaptured(captured);
  }
});

test('published runtime config is bootable authority and private copies are rejected', async () => {
  const plan = JSON.parse(
    await readFile(path.join(fixtureDir, 'plan.valid.json'), 'utf8'),
  );
  const docsHarnessSha = git(repoRoot, ['rev-parse', 'HEAD']);
  const verified = await verifyPublishedReturnCovenantRuntimeConfig({
    docsDir: repoRoot,
    docsHarnessSha,
    runtimeConfigPath,
    expected: {
      relativePath: plan.target.runtimeConfigRelativePath,
      gitBlob: plan.target.runtimeConfigGitBlob,
      sha256: plan.target.runtimeConfigSha256,
    },
  });
  assert.equal(verified.config.gateway.mode, 'local');
  assert.deepEqual(verified.authority, {
    relativePath: plan.target.runtimeConfigRelativePath,
    gitBlob: plan.target.runtimeConfigGitBlob,
    sha256: plan.target.runtimeConfigSha256,
  });

  const privateDir = await mkdtemp(
    path.join(tmpdir(), 'return-covenant-private-config-'),
  );
  try {
    const privateConfig = path.join(privateDir, 'openclaw.json');
    await copyFile(runtimeConfigPath, privateConfig);
    await assert.rejects(
      verifyPublishedReturnCovenantRuntimeConfig({
        docsDir: repoRoot,
        docsHarnessSha,
        runtimeConfigPath: privateConfig,
        expected: {
          relativePath: plan.target.runtimeConfigRelativePath,
          gitBlob: plan.target.runtimeConfigGitBlob,
          sha256: plan.target.runtimeConfigSha256,
        },
      }),
      /must be the published tracked runtime config fixture/,
    );
  } finally {
    await rm(privateDir, { recursive: true, force: true });
  }
});

const productDir = process.env.OPENCLAW_PRODUCT_AUTHORITY_REPO;
const runtimeArtifactDir =
  process.env.OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT;
const realSmokeSkip = !productDir || !runtimeArtifactDir
  ? 'exact product checkout and runtime artifact are required'
  : false;

test(
  'published runtime config boots the real tracked gateway with immutable artifact mounts',
  { skip: realSmokeSkip },
  async () => {
    assert.equal(git(productDir, ['rev-parse', 'HEAD']), PRODUCT_SHA);
    assert.equal(
      git(productDir, ['rev-parse', 'HEAD^{tree}']),
      PRODUCT_TREE_SHA,
    );
    assert.equal(
      git(productDir, ['status', '--porcelain=v1', '--untracked-files=no']),
      '',
    );
    const docsHarnessSha = git(repoRoot, ['rev-parse', 'HEAD']);
    const [plan, manifest, gatewayBytes] = await Promise.all([
      readFile(path.join(fixtureDir, 'plan.valid.json'), 'utf8').then(JSON.parse),
      readFile(path.join(runtimeArtifactDir, 'manifest.json'), 'utf8')
        .then(JSON.parse),
      readFile(path.join(productDir, 'openclaw.mjs')),
    ]);
    assert.equal(manifest.product.commitSha, PRODUCT_SHA);
    assert.equal(manifest.product.treeSha, PRODUCT_TREE_SHA);
    assert.equal(manifest.docsHarnessSha, docsHarnessSha);
    const oldRunId = plan.runId;
    plan.runId = manifest.runId;
    plan.syntheticChannelKey =
      plan.syntheticChannelKey.replace(oldRunId, plan.runId);
    for (const entry of plan.cases) {
      entry.logicalSessionKey =
        entry.logicalSessionKey.replace(oldRunId, plan.runId);
    }
    plan.target.candidateSha = PRODUCT_SHA;
    plan.target.productTreeSha = PRODUCT_TREE_SHA;
    plan.target.runtimeBuildSha = PRODUCT_SHA;
    plan.target.docsHarnessSha = docsHarnessSha;
    plan.target.runtimeArtifactManifestSha256 =
      sha256(canonicalJson(manifest));
    plan.driver.fixtureCommand = { status: 'missing-product-seam' };
    plan.driver.gatewayCommand = {
      relativePath: 'openclaw.mjs',
      sha256: sha256(gatewayBytes),
      args: ['gateway'],
    };

    const privateDir = await mkdtemp(
      path.join(tmpdir(), 'return-covenant-real-smoke-test-'),
    );
    try {
      const planPath = path.join(privateDir, 'plan.json');
      const receiptPath = path.join(privateDir, 'receipt.json');
      await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, {
        mode: 0o600,
        flag: 'wx',
      });
      const result = spawnSync(process.execPath, [
        path.join(root, 'scripts/smoke-return-covenant-runtime-artifact.mjs'),
        '--plan', planPath,
        '--source-dir', productDir,
        '--runtime-config', runtimeConfigPath,
        '--runtime-artifact', runtimeArtifactDir,
        '--receipt', receiptPath,
      ], {
        encoding: 'utf8',
        timeout: 300_000,
      });
      assert.equal(
        result.status,
        0,
        JSON.stringify({
          signal: result.signal,
          stdout: result.stdout,
          stderr: result.stderr,
        }),
      );
      const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
      assert.equal(receipt.verdict, 'PASS');
      assert.deepEqual(receipt.runtimeConfig, {
        relativePath: plan.target.runtimeConfigRelativePath,
        gitBlob: plan.target.runtimeConfigGitBlob,
        sha256: plan.target.runtimeConfigSha256,
      });
      assert.equal(receipt.isolation.writableIsolatedConfig, true);
      assert.equal(
        receipt.isolation.runtimeConfigWriteObservation.lockObserved,
        true,
      );
      assert.equal(
        receipt.isolation.runtimeConfigWriteObservation.lockReleased,
        true,
      );
      assert.ok(
        receipt.isolation.runtimeConfigWriteObservation.finalArtifacts
          .includes('openclaw.json.bak'),
      );
      const mountProbes =
        receipt.isolation.runtimeMountObservation.mounts.flatMap((mount) => [
          mount.directoryChmodErrno,
          mount.fileChmodErrno,
          mount.createErrno,
        ]);
      assert.equal(mountProbes.length, 6);
      assert.ok(mountProbes.every((errno) => errno === 'EROFS'));
      assert.ok(
        receipt.isolation.mounts.every((mount) => mount.readOnly === true),
      );
      assert.deepEqual(receipt.cleanup, {
        gatewayStopped: true,
        sandboxStopped: true,
        configLockReleased: true,
        runtimeArtifactRemoved: true,
        runRootRemoved: true,
      });
    } finally {
      await rm(privateDir, { recursive: true, force: true });
    }
  },
);
