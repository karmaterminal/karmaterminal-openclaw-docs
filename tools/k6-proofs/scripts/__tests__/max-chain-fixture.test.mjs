import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

async function writeDependencyFixture(source, lock = 'lockfileVersion: 9.0\n') {
  await mkdir(path.join(source, 'node_modules', '.pnpm'), { recursive: true });
  await mkdir(path.join(source, 'node_modules', '.bin'), { recursive: true });
  await writeFile(path.join(source, 'pnpm-lock.yaml'), lock);
  await writeFile(path.join(source, 'node_modules', '.pnpm', 'lock.yaml'), lock);
  await writeFile(
    path.join(source, 'node_modules', '.modules.yaml'),
    JSON.stringify({ layoutVersion: 5, virtualStoreDir: '.pnpm' }),
  );
  await writeFile(path.join(source, 'node_modules', '.bin', 'tsx'), '#!/bin/sh\n');
  await writeFile(path.join(source, 'node_modules', '.bin', 'vitest'), '#!/bin/sh\n');
}

import {
  assertPublicArtifactSafe,
  assertSource,
  assertTrackedSourceClean,
  buildReadiness,
  parseArgs,
  prepareArtifactDir,
  renderToolSurfaceTemplate,
} from '../run-max-chain-fixture.mjs';

test('R-CW-6 fixture accepts an explicit isolated source contract', () => {
  const parsed = parseArgs([
    'node',
    'run-max-chain-fixture.mjs',
    '--source-dir',
    '/tmp/exact-openclaw',
    '--candidate-sha',
    '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    '--artifact-dir',
    '/tmp/rcw6-artifacts',
    '--max-chain-length',
    '3',
    '--json',
  ], {});
  assert.deepEqual(parsed, {
    sourceDir: '/tmp/exact-openclaw',
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    artifactDir: '/tmp/rcw6-artifacts',
    maxChainLength: 3,
    json: true,
  });
});

test('R-CW-6 fixture refuses unknown or live-mutation arguments', () => {
  assert.throws(
    () => parseArgs(['node', 'run-max-chain-fixture.mjs', '--restart-gateway'], {}),
    /unexpected argument: --restart-gateway/,
  );
  assert.throws(
    () => parseArgs(['node', 'run-max-chain-fixture.mjs', '--config-patch', '1'], {}),
    /unexpected argument: --config-patch/,
  );
});

test('R-CW-6 fixture refuses to overwrite or expose an artifact directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-artifact-test-'));
  const nonEmpty = path.join(root, 'existing');
  await mkdir(nonEmpty, { mode: 0o700 });
  await writeFile(path.join(nonEmpty, 'old-receipt.json'), '{}');
  assert.throws(() => prepareArtifactDir(nonEmpty), /must be empty/);

  const fresh = path.join(root, 'fresh');
  assert.equal(prepareArtifactDir(fresh), fresh);

  const privateParent = path.join(root, 'private-parent');
  const linkedParent = path.join(root, 'linked-parent');
  await mkdir(privateParent, { mode: 0o700 });
  await symlink(privateParent, linkedParent);
  assert.throws(
    () => prepareArtifactDir(path.join(linkedParent, 'new-artifacts')),
    /must not contain a symlink component/,
  );
});

test('R-CW-6 fixture refuses staged or unstaged tracked candidate changes', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-dirty-source-'));
  await mkdir(path.join(source, 'src/auto-reply/continuation'), { recursive: true });
  await mkdir(path.join(source, 'src/agents/command'), { recursive: true });
  await writeDependencyFixture(source);
  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = true;\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/work-dispatch.ts'), '// marker\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts'), '// marker\n');
  await writeFile(path.join(source, 'src/agents/command/attempt-execution.ts'), '// marker\n');
  await writeFile(path.join(source, 'package.json'), '{"name":"r-cw-6-test","packageManager":"pnpm@11.2.2"}\n');
  execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'R-CW-6 fixture test'], { cwd: source });
  execFileSync('git', ['add', 'src', 'package.json', 'pnpm-lock.yaml'], { cwd: source });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();

  assert.doesNotThrow(() => assertSource(source, candidateSha));

  await writeFile(path.join(source, 'node_modules', '.pnpm', 'lock.yaml'), 'lockfileVersion: 8.0\n');
  assert.throws(() => assertSource(source, candidateSha), /installed dependency lockfile does not match/);
  await writeFile(path.join(source, 'node_modules', '.pnpm', 'lock.yaml'), 'lockfileVersion: 9.0\n');

  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = false;\n');
  assert.throws(() => assertSource(source, candidateSha), /tracked staged or unstaged changes/);

  execFileSync('git', ['add', 'src/auto-reply/continuation/scheduler.ts'], { cwd: source });
  assert.throws(() => assertSource(source, candidateSha), /tracked staged or unstaged changes/);
  assert.throws(
    () => assertTrackedSourceClean(source, 'final cleanup/result receipt'),
    /before final cleanup\/result receipt/,
  );
});

test('R-CW-6 runtime template proves the real budget and durable recovery path', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /scheduleContinuationWorkBatch/);
  assert.match(template, /scheduleContinuationWork/);
  assert.match(template, /checkContinuationBudget/);
  assert.match(template, /persistContinuationChainState/);
  assert.match(template, /loadSessionStore/);
  assert.match(template, /reason:\s*structuredReason/);
  assert.match(template, /flowCountBeforeRejectedHop/);
  assert.match(template, /flowCountAfterRejectedHop/);
  assert.match(template, /recoveredAttemptScheduled/);
});

test('R-CW-6 typed template enters runAgentAttempt and omits the rejected flow', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /runAgentAttempt/);
  assert.match(template, /createOpenClawContinuationTools/);
  assert.match(template, /tool\.name === "continue_work"/);
  assert.match(template, /continueWorkTool\.execute/);
  assert.match(template, /continueWorkOpts/);
  assert.match(template, /typed first-over-limit/);
  assert.match(template, /firstOverLimitFlowPresent:\s*false/);
  assert.match(template, /capNoticeObserved/);
});

test('R-CW-6 delegate template uses the selected maximum and proves reject-before-spawn', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-delegate-boundary.test.ts', import.meta.url)),
    'utf8',
  );
  const rendered = renderToolSurfaceTemplate(template, 7);
  assert.match(rendered, /const maxChainLength = 7/);
  assert.match(rendered, /currentChainCount: maxChainLength - 1/);
  assert.match(rendered, /rejectedBeforeSecondSpawn/);
  assert.match(rendered, /rejectedFlowStatus/);
  assert.match(rendered, /chainCappedNoticeObserved/);
  assert.doesNotMatch(rendered, /__RCW6_MAX_CHAIN_LENGTH__/);
});

test('R-CW-6 renders every runtime layer at the selected max chain length', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  const rendered = renderToolSurfaceTemplate(template, 7);
  assert.match(rendered, /const maxChainLength = 7/);
  assert.doesNotMatch(rendered, /__RCW6_MAX_CHAIN_LENGTH__/);
});

test('R-CW-6 public readiness has no private source path or fleet mutation claim', () => {
  const privatePath = '/home/figs/flesh_beast_tmp/openclaw';
  const readiness = buildReadiness({
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    head: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    dependencyProvenance: {
      model: 'preinstalled-pnpm-virtual-store-lockfile-aligned',
      lockfileMatchesCandidate: true,
    },
    maxChainLength: 7,
  });
  assert.equal(readiness.sourceHeadMatchesCandidate, true);
  assert.equal(readiness.productionConfigTouched, false);
  assert.equal(readiness.productionStateTouched, false);
  assert.equal(readiness.gatewayStarted, false);
  assert.equal(readiness.dependencyProvenance.lockfileMatchesCandidate, true);
  assert.doesNotMatch(JSON.stringify(readiness), new RegExp(privatePath.replaceAll('/', '\\/')));
});

test('R-CW-6 public artifact guard rejects private paths and sensitive fields', () => {
  assert.doesNotThrow(() =>
    assertPublicArtifactSafe(
      { schema: 'safe.v1', candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d' },
      { label: 'safe.json', privatePaths: ['/private/source'] },
    ),
  );
  assert.throws(
    () =>
      assertPublicArtifactSafe(
        { schema: 'unsafe.v1', detail: '/private/source/src/index.ts' },
        { label: 'unsafe-path.json', privatePaths: ['/private/source'] },
      ),
    /contains a private filesystem path/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', sessionKey: 'agent:main:private' }),
    /forbidden public-artifact key sessionKey/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', gatewayToken: 'do-not-publish' }),
    /forbidden public-artifact key gatewayToken/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', detail: '/tmp/other-private-artifact/trace.txt' }),
    /contains an absolute filesystem path/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', session_id: 'agent:main:private' }),
    /forbidden public-artifact key session_id/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', environment: { SAFE: 'not-safe-to-publish' } }),
    /forbidden public-artifact key environment/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', process_output: 'raw child stdout' }),
    /forbidden public-artifact key process_output/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', detail: 'agent:main:private' }),
    /contains a session identifier/,
  );
  const recursiveAliases = [
    ['windows backslash path', { nested: { detail: 'C:\\Windows\\System32' } }, /absolute filesystem path/],
    ['windows forward path', { nested: { detail: 'C:/Windows/System32' } }, /absolute filesystem path/],
    ['UNC path', { nested: { detail: '\\\\server\\share\\private.txt' } }, /absolute filesystem path/],
    ['file URL', { nested: { detail: 'file:///tmp/private.txt' } }, /absolute filesystem path/],
    ['home path', { nested: { detail: '~/.ssh/id_private' } }, /absolute filesystem path/],
    ['env', { nested: { env: { PATH: 'x' } } }, /forbidden public-artifact key env/],
    ['environmentVariables', { nested: { environmentVariables: { PATH: 'x' } } }, /forbidden public-artifact key environmentVariables/],
    ['envVars', { nested: { envVars: { PATH: 'x' } } }, /forbidden public-artifact key envVars/],
    ['errorMessage', { nested: { errorMessage: 'raw' } }, /forbidden public-artifact key errorMessage/],
    ['errorDetail', { nested: { errorDetail: 'raw' } }, /forbidden public-artifact key errorDetail/],
    ['stack', { nested: { stack: 'raw' } }, /forbidden public-artifact key stack/],
    ['exception', { nested: { exception: 'raw' } }, /forbidden public-artifact key exception/],
    ['apiKey', { nested: { apiKey: 'secret' } }, /forbidden public-artifact key apiKey/],
    ['accessKey', { nested: { accessKey: 'secret' } }, /forbidden public-artifact key accessKey/],
    ['privateKey', { nested: { privateKey: 'secret' } }, /forbidden public-artifact key privateKey/],
    ['bearerToken', { nested: { bearerToken: 'secret' } }, /forbidden public-artifact key bearerToken/],
    ['cookie', { nested: { cookie: 'secret' } }, /forbidden public-artifact key cookie/],
    ['setCookie', { nested: { setCookie: 'secret' } }, /forbidden public-artifact key setCookie/],
  ];
  for (const [name, value, expected] of recursiveAliases) {
    assert.throws(
      () => assertPublicArtifactSafe(value, { label: `${name}.json` }),
      expected,
      `${name} unexpectedly passed the public-artifact guard`,
    );
  }
});

test('R-CW-6 manifest and method fail closed instead of patching a shared gateway', async () => {
  const manifestPath = fileURLToPath(new URL('../../manifests/r-cw-6.json', import.meta.url));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const methodDoc = await readFile(
    fileURLToPath(new URL('../../docs/R-CW-6-ISOLATED-MAX-CHAIN.md', import.meta.url)),
    'utf8',
  );
  assert.equal(manifest.transport, 'process-local');
  assert.equal(manifest.mutates, false);
  assert.equal(manifest.scenario.status, 'scaffold');
  assert.deepEqual(manifest.scenario.methods, [
    'scheduleContinuationWorkBatch',
    'scheduleContinuationWork',
    'runAgentAttempt',
    'TaskFlow.assert-no-rejected-row',
  ]);
  assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes('public-artifact-safety'));
  assert.match(methodDoc, /does not patch or restart a gateway/);
  assert.match(methodDoc, /manual-only\s+component fixture/);
  assert.match(methodDoc, /Any missing or failed receipt is `FAIL-fixture`, never a PASS/);
});

test('R-CW-6 canonical guidance uses the process-local fixture, not live cap mutation', async () => {
  const corpusMethod = await readFile(
    fileURLToPath(new URL('../../../../RUNBOOKS/PROOF-CORPUS-METHOD.md', import.meta.url)),
    'utf8',
  );
  const skill = await readFile(
    fileURLToPath(new URL('../../skill/SKILL.md', import.meta.url)),
    'utf8',
  );
  for (const guidance of [corpusMethod, skill]) {
    assert.match(guidance, /run-max-chain-fixture\.mjs/);
    assert.match(guidance, /process-local/);
  }
  assert.doesNotMatch(
    skill,
    /For rows that test cap exhaustion \(R-CW-5, R-CW-6\):\s*1\. Lower caps in `openclaw\.json`/u,
  );
});
