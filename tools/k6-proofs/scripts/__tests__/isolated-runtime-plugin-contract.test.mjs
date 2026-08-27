import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyIsolatedRuntimePlugins,
  evaluateIsolatedRuntimePlugin,
  observePluginRegistration,
  publicRuntimePluginReceipt,
  readPrimaryModelRef,
  resolveRequiredRuntimePlugin,
} from '../../lib/isolated-runtime-plugin-contract.mjs';
import { sanitizeEvidenceRecords } from '../sanitize-k6-artifacts.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const provisioner = path.join(repoRoot, 'tools/k6-proofs/scripts/provision-isolated-proof-config.mjs');
const preFix = JSON.parse(await readFile(
  new URL('../../tests/fixtures/isolated-codex-runtime-missing.json', import.meta.url),
  'utf8',
));

function continuationDefaults(model) {
  return {
    ...(model ? { model } : {}),
    continuation: {
      enabled: true,
      maxChainLength: 200,
      maxDelegatesPerTurn: 500,
      costCapTokens: 500000,
    },
    subagents: { maxSpawnDepth: 5 },
  };
}

async function withTmp(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'p81-runtime-plugin-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('pre-fix isolated openai model with missing Codex plugin stays non-PASS', () => {
  assert.equal(preFix.openaiAuthProfileCount, 1);
  assert.equal(preFix.authMigration.kind, 'auth:openai');
  assert.equal(preFix.authMigration.planned, 1);
  assert.equal(preFix.authMigration.applied, 1);
  assert.equal(readPrimaryModelRef(preFix.targetConfig), 'openai/gpt-5.6-sol');
  assert.equal(observePluginRegistration(preFix.targetConfig, 'codex').enabled, false);
  const evaluation = evaluateIsolatedRuntimePlugin({
    config: preFix.targetConfig,
    ambientRegistry: { agentHarnesses: [{ harness: { id: 'codex' } }] },
  });
  assert.equal(evaluation.required, true);
  assert.equal(evaluation.runtime, 'codex');
  assert.equal(evaluation.pluginId, 'codex');
  assert.equal(evaluation.sufficient, false);
  assert.equal(evaluation.reason, 'runtime-plugin-unregistered');
  assert.equal(evaluation.source, 'isolated-target-config');
  assert.doesNotMatch(JSON.stringify(preFix), /sk-[A-Za-z0-9]|Bearer |BEGIN /);
});

test('reviewed Codex plugin registration makes the same model sufficient', () => {
  const registered = applyIsolatedRuntimePlugins(preFix.targetConfig);
  const evaluation = evaluateIsolatedRuntimePlugin({ config: registered });
  assert.equal(registered.plugins.entries.codex.enabled, true);
  assert.equal(evaluation.sufficient, true);
  assert.equal(evaluation.enabled, true);
  assert.equal(evaluation.reason, 'runtime-plugin-observed');
  assert.deepEqual(publicRuntimePluginReceipt(evaluation), {
    required: true,
    runtime: 'codex',
    pluginId: 'codex',
    registered: true,
    allowListed: null,
    sufficient: true,
    source: 'isolated-target-config',
    reason: 'runtime-plugin-observed',
  });
});

test('missing, wrong-runtime, wrong-plugin, and ambient-only controls fail closed', () => {
  const missing = evaluateIsolatedRuntimePlugin({
    config: { agents: { defaults: continuationDefaults('openai/gpt-5.6-sol') } },
  });
  assert.equal(missing.reason, 'runtime-plugin-unregistered');

  const wrongRuntime = evaluateIsolatedRuntimePlugin({
    config: {
      agents: {
        defaults: {
          ...continuationDefaults('openai/gpt-5.6-sol'),
          agentRuntime: { id: 'codex' },
        },
      },
      plugins: { entries: { 'claude-cli': { enabled: true } } },
    },
  });
  assert.equal(wrongRuntime.required, true);
  assert.equal(wrongRuntime.runtime, 'codex');
  assert.equal(wrongRuntime.enabled, false);
  assert.equal(wrongRuntime.sufficient, false);

  const wrongPlugin = evaluateIsolatedRuntimePlugin({
    config: {
      agents: { defaults: continuationDefaults('openai/gpt-5.6-sol') },
      plugins: { entries: { codex: { enabled: false } } },
    },
  });
  assert.equal(wrongPlugin.present, true);
  assert.equal(wrongPlugin.reason, 'runtime-plugin-disabled');
  assert.equal(wrongPlugin.sufficient, false);

  const allowMismatch = evaluateIsolatedRuntimePlugin({
    config: {
      agents: { defaults: continuationDefaults('openai/gpt-5.6-sol') },
      plugins: {
        allow: ['openai'],
        entries: { codex: { enabled: true } },
      },
    },
  });
  assert.equal(allowMismatch.reason, 'runtime-plugin-not-allowlisted');
  assert.equal(allowMismatch.sufficient, false);

  const ambientOnly = evaluateIsolatedRuntimePlugin({
    config: { agents: { defaults: continuationDefaults('openai/gpt-5.6-sol') } },
    ambientRegistry: { agentHarnesses: [{ harness: { id: 'codex' } }] },
  });
  assert.equal(ambientOnly.sufficient, false);
  assert.equal(ambientOnly.source, 'isolated-target-config');
});

test('explicit openclaw runtime does not require the Codex plugin', () => {
  const evaluation = evaluateIsolatedRuntimePlugin({
    config: {
      agents: {
        defaults: {
          ...continuationDefaults('openai/gpt-5.6-sol'),
          agentRuntime: { id: 'openclaw' },
        },
      },
    },
  });
  assert.equal(evaluation.required, false);
  assert.equal(evaluation.sufficient, true);
  assert.equal(resolveRequiredRuntimePlugin({
    agents: { defaults: continuationDefaults() },
  }).required, false);
});

test('isolated provisioner registers Codex for a selected openai model without leaking auth', async () => {
  await withTmp(async (root) => {
    const base = path.join(root, 'base.json');
    const output = path.join(root, 'openclaw.json');
    const receipt = path.join(root, 'receipt.json');
    const privateToken = 'PRIVATE-GATEWAY-TOKEN-MUST-NOT-REACH-RECEIPT';
    await writeFile(base, `${JSON.stringify({
      gateway: { auth: { token: privateToken } },
      agents: { defaults: continuationDefaults('openai/gpt-5.6-sol') },
    }, null, 2)}\n`);
    const run = spawnSync(process.execPath, [
      provisioner,
      '--base-config', base,
      '--output', output,
      '--receipt', receipt,
      '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const generated = JSON.parse(await readFile(output, 'utf8'));
    const publicReceipt = JSON.parse(await readFile(receipt, 'utf8'));
    assert.equal(generated.plugins.entries.codex.enabled, true);
    assert.equal(generated.agents.defaults.subagents.maxSpawnDepth, 5);
    assert.equal(generated.gateway.auth.token, privateToken);
    assert.equal(publicReceipt.runtimePlugin.required, true);
    assert.equal(publicReceipt.runtimePlugin.runtime, 'codex');
    assert.equal(publicReceipt.runtimePlugin.registered, true);
    assert.equal(publicReceipt.runtimePlugin.sufficient, true);
    assert.doesNotMatch(await readFile(receipt, 'utf8'), new RegExp(privateToken));
    const { sanitized } = sanitizeEvidenceRecords([publicReceipt]);
    assert.doesNotMatch(JSON.stringify(sanitized), new RegExp(privateToken));
    assert.equal(sanitized[0].runtimePlugin.pluginId, 'codex');
  });
});

test('denied Codex plugin cannot be force-registered by the isolated provisioner', async () => {
  await withTmp(async (root) => {
    const base = path.join(root, 'base.json');
    const output = path.join(root, 'openclaw.json');
    const receipt = path.join(root, 'receipt.json');
    await writeFile(base, `${JSON.stringify({
      agents: { defaults: continuationDefaults('openai/gpt-5.6-sol') },
      plugins: { deny: ['codex'] },
    })}\n`);
    const run = spawnSync(process.execPath, [
      provisioner,
      '--base-config', base,
      '--output', output,
      '--receipt', receipt,
      '--rows', 'R-CD-2',
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /runtime plugin 'codex': denied/);
  });
});
