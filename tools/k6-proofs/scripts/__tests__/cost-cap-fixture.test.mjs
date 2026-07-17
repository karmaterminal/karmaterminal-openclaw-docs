import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSource,
  assertTrackedSourceClean,
  buildReadiness,
  parseArgs,
  prepareArtifactDir,
  renderToolSurfaceTemplate,
} from '../run-cost-cap-fixture.mjs';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

test('R-CW-5 fixture accepts an explicit isolated source contract', () => {
  const parsed = parseArgs([
    'node',
    'run-cost-cap-fixture.mjs',
    '--source-dir',
    '/tmp/exact-openclaw',
    '--candidate-sha',
    '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    '--artifact-dir',
    '/tmp/rcw5-artifacts',
    '--cap',
    '100',
    '--json',
  ], {});
  assert.deepEqual(parsed, {
    sourceDir: '/tmp/exact-openclaw',
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    artifactDir: '/tmp/rcw5-artifacts',
    cap: 100,
    json: true,
  });
});

test('R-CW-5 fixture refuses unknown arguments', () => {
  assert.throws(
    () => parseArgs(['node', 'run-cost-cap-fixture.mjs', '--mutate-live-config'], {}),
    /unexpected argument: --mutate-live-config/,
  );
});

test('R-CW-5 fixture refuses to overwrite or expose an artifact directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-artifact-test-'));
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

test('R-CW-5 fixture refuses staged or unstaged tracked candidate changes', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-dirty-source-'));
  await mkdir(path.join(source, 'src/auto-reply/continuation'), { recursive: true });
  await mkdir(path.join(source, 'node_modules'));
  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = true;\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts'), '// marker\n');
  await writeFile(path.join(source, 'package.json'), '{"name":"r-cw-5-test"}\n');
  execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'R-CW-5 fixture test'], { cwd: source });
  execFileSync('git', ['add', 'src', 'package.json'], { cwd: source });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();

  assert.doesNotThrow(() => assertSource(source, candidateSha));

  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = false;\n');
  assert.throws(
    () => assertSource(source, candidateSha),
    /tracked staged or unstaged changes/,
  );

  execFileSync('git', ['add', 'src/auto-reply/continuation/scheduler.ts'], { cwd: source });
  assert.throws(
    () => assertSource(source, candidateSha),
    /tracked staged or unstaged changes/,
  );
  assert.throws(
    () => assertTrackedSourceClean(source, 'final cleanup/result receipt'),
    /before final cleanup\/result receipt/,
  );
});

test('R-CW-5 typed tool-surface template asserts no durable work after exhausted elections', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /runAgentAttempt/);
  assert.match(template, /continueWorkOpts/);
  assert.match(template, /continuationChainTokens:\s*__RCW5_OVER_CAP__/);
  assert.match(template, /listTaskFlowsForOwnerKey\(sessionKey\)\)\.toHaveLength\(0\)/);
  assert.match(template, /2 of 2 continue_work elections were not scheduled/);
});

test('R-CW-5 renders the typed tool surface at the selected cap', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  const rendered = renderToolSurfaceTemplate(template, 200);
  assert.match(rendered, /costCapTokens:\s*200/);
  assert.match(rendered, /continuationChainTokens:\s*201/);
  assert.doesNotMatch(rendered, /__RCW5_(?:CAP|OVER_CAP)__/);
});

test('R-CW-5 public readiness has no private source path', () => {
  const privatePath = '/home/figs/flesh_beast_tmp/openclaw';
  const readiness = buildReadiness({
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    head: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    cap: 200,
  });
  assert.equal(readiness.sourceHeadMatchesCandidate, true);
  assert.doesNotMatch(JSON.stringify(readiness), new RegExp(privatePath.replaceAll('/', '\\/')));
});

test('R-CW-5 fails closed instead of pretending the internal tool is websocket-invocable', async () => {
  const manifestPath = fileURLToPath(new URL('../../manifests/r-cw-5.json', import.meta.url));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const methodDoc = await readFile(
    fileURLToPath(new URL('../../docs/R-CW-5-ISOLATED-TOOL-SURFACE.md', import.meta.url)),
    'utf8',
  );
  assert.equal(manifest.transport, 'process-local');
  assert.equal(manifest.scenario.status, 'scaffold');
  assert.deepEqual(manifest.scenario.methods, [
    'runAgentAttempt',
    'continueWorkOpts.requestContinuation',
    'TaskFlow.assert-no-row',
  ]);
  assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
  assert.match(methodDoc, /not\s+externally invocable through the gateway loopback/);
  assert.match(methodDoc, /Any missing or failed receipt is `FAIL-fixture`, never a PASS/);
});
