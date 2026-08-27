#!/usr/bin/env node
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyIsolatedProofProfile,
  evaluateContinuationDepth,
  inspectConfiguredMaxSpawnDepth,
  PROOF_PROFILE_MAX_SPAWN_DEPTH,
  resolveContinuationDepthRequirements,
} from '../lib/continuation-depth-contract.mjs';
import {
  applyIsolatedRuntimePlugins,
  evaluateIsolatedRuntimePlugin,
  publicRuntimePluginReceipt,
} from '../lib/isolated-runtime-plugin-contract.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const defaultManifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base-config') args.baseConfig = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--receipt') args.receipt = argv[++index];
    else if (arg === '--rows') args.rows = argv[++index];
    else if (arg === '--manifests-dir') args.manifestsDir = argv[++index];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown arg: ${arg}`);
  }
  return args;
}

function usage() {
  console.log(
    'Usage: node tools/k6-proofs/scripts/provision-isolated-proof-config.mjs ' +
    '--base-config <template.json> --output <private-openclaw.json> ' +
    '--receipt <public-receipt.json> --rows <ROW[,ROW...]>',
  );
}

async function writeJsonAtomic(file, value, mode) {
  const resolved = path.resolve(file);
  await mkdir(path.dirname(resolved), { recursive: true, mode: 0o700 });
  const temporary = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.tmp`,
  );
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode, flag: 'wx' });
    await chmod(temporary, mode);
    await rename(temporary, resolved);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  for (const name of ['baseConfig', 'output', 'receipt', 'rows']) {
    if (!args[name]) throw new Error(`--${name.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  if (path.resolve(args.baseConfig) === path.resolve(args.output)) {
    throw new Error('--output must differ from --base-config; never rewrite a source or live config in place');
  }

  const baseConfig = JSON.parse(await readFile(args.baseConfig, 'utf8'));
  const baseDepth = inspectConfiguredMaxSpawnDepth(baseConfig);
  if (!baseDepth.valid) {
    throw new Error('base config has a malformed agents.defaults.subagents.maxSpawnDepth');
  }
  const requirements = resolveContinuationDepthRequirements({
    rows: args.rows,
    manifestsDir: path.resolve(args.manifestsDir || defaultManifestsDir),
  });
  const generatedConfig = applyIsolatedRuntimePlugins(applyIsolatedProofProfile(baseConfig));
  const depth = evaluateContinuationDepth({
    config: generatedConfig,
    requirements,
    expectedMaxSpawnDepth: PROOF_PROFILE_MAX_SPAWN_DEPTH,
  });
  if (!depth.sufficient) {
    throw new Error(`isolated proof profile depth validation failed: ${depth.reason}`);
  }
  const runtimePlugin = evaluateIsolatedRuntimePlugin({
    config: generatedConfig,
    configAvailable: true,
  });
  if (!runtimePlugin.sufficient) {
    throw new Error(`isolated proof profile runtime plugin validation failed: ${runtimePlugin.reason}`);
  }

  const receipt = {
    schema: 'openclaw.k6.isolated-proof-config.v1',
    generatedAt: new Date().toISOString(),
    outcome: 'PASS-candidate',
    profile: 'project81-isolated',
    selectedRows: depth.selectedRows,
    nestedRows: depth.nestedRows,
    baseConfiguredMaxSpawnDepth: baseDepth.configuredMaxSpawnDepth,
    configuredMaxSpawnDepth: depth.configuredMaxSpawnDepth,
    effectiveMaxSpawnDepth: depth.effectiveMaxSpawnDepth,
    requiredMaxSpawnDepth: depth.requiredMaxSpawnDepth,
    proofProfileMaxSpawnDepth: depth.proofProfileMaxSpawnDepth,
    explicitProfileApplied: depth.source === 'explicit',
    runtimePlugin: publicRuntimePluginReceipt(runtimePlugin),
    publicSafe: true,
  };

  await writeJsonAtomic(args.output, generatedConfig, 0o600);
  await writeJsonAtomic(args.receipt, receipt, 0o644);
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
