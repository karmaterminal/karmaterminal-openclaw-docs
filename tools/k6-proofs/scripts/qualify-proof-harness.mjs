#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUALIFICATION_SCHEMA,
  classifyManagedFlows,
  runHostileControls,
  validateConsumerDependencies,
  validateEnvironmentReceipt,
  validateExactIdentities,
  isInside,
  validateProducerCatalog,
  validateTerminalRollup,
  validateWorkspace,
} from '../lib/proof-harness-qualification.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDir, '../../..');

function usage() {
  return `Usage: node tools/k6-proofs/scripts/qualify-proof-harness.mjs \\
  --product-dir <exact checkout> --product-sha <40-hex> --runtime-sha <40-hex> \\
  --docs-sha <40-hex> --corpus-sha <40-hex> --gateway-url <ws[s]://...> \\
  --gateway-id <public id> --seat <seat> --session-id <disposable session id> \\
  --agent-id <agent> --run-id <new proof run id> --out-dir <HOME-contained directory> \\
  --tempo-query-url <http[s]://...> --tempo-intake-url <http[s]://...> \\
  [--flow-inventory <tasks-flow-list.json>] [--producer-receipts <json>] \\
  [--producer-signing-key-file <private file>] [--terminal-rollup <json>]\n`;
}

function parseArgs(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--help' || name === '-h') return { help: true };
    if (!name.startsWith('--') || !argv[index + 1]) throw new Error(`invalid argument: ${name}`);
    out[name.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = argv[index + 1];
    index += 1;
  }
  return out;
}

function runGit(directory, args) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function addFailure(failures, code, message, detail = null) {
  failures.push({ code, message, detail });
}

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not readable JSON: ${error.message}`);
  }
}

function collectFlowInventory() {
  const output = execFileSync('openclaw', ['tasks', 'flow', 'list', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function runJson(command, args) {
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function runValidationGate(name, script, args, failures) {
  try {
    execFileSync(process.execPath, [path.join(docsRoot, script), ...args], {
      cwd: docsRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { name, passed: true };
  } catch {
    addFailure(failures, 'validation-gate.failed', `${name} validation failed`);
    return { name, passed: false };
  }
}

async function endpointReachable(value, query = false) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (query) {
      url.pathname = `${url.pathname.replace(/\/+$/u, '')}/api/search`;
      url.search = new URLSearchParams({ q: '{}', limit: '1' }).toString();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, {
        method: query ? 'GET' : 'POST',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(query ? {} : { 'content-type': 'application/json' }),
        },
        ...(query ? {} : { body: JSON.stringify({ resourceSpans: [] }) }),
      });
      return response.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

async function collectEnvironment(args) {
  const probe = runJson('openclaw', ['gateway', 'probe', '--json']);
  const active = probe?.targets?.find((target) => target?.active === true);
  const sessions = runJson('openclaw', ['sessions', '--json']);
  if (!Array.isArray(sessions?.sessions)) {
    throw new Error('session inventory did not return a sessions array');
  }
  if (sessions.sessions.some((session) => session?.key === args.sessionId)) {
    throw new Error('disposable session identity already exists');
  }
  let created = false;
  let cleaned = false;
  let createdSessionId = null;
  try {
    const creation = runJson('openclaw', [
      'gateway', 'call', 'sessions.create', '--json',
      '--params', JSON.stringify({ key: args.sessionId, agentId: args.agentId }),
    ]);
    createdSessionId = creation?.key || null;
    created = creation?.ok === true && createdSessionId === args.sessionId;
  } finally {
    if (createdSessionId) try {
      const cleanup = runJson('openclaw', [
        'gateway', 'call', 'sessions.delete', '--json',
        '--params', JSON.stringify({ key: createdSessionId || args.sessionId, agentId: args.agentId }),
      ]);
      cleaned = cleanup?.ok === true && cleanup?.deleted === true;
    } catch {
      cleaned = false;
    }
  }
  return {
    gateway: {
      url: active?.url || null,
      targetId: active?.id || null,
      instanceId: active?.self?.instanceId || null,
      reachable: active?.connect?.ok === true && active?.connect?.rpcOk === true,
      configValid: active?.config?.valid === true,
      runtimeExactMatches: typeof active?.server?.buildId === 'string' &&
        active.server.buildId.includes(args.runtimeSha),
    },
    observability: {
      diagnosticsOtelLoaded: active?.health?.plugins?.loaded?.includes('diagnostics-otel') === true,
      tempoQueryReachable: await endpointReachable(args.tempoQueryUrl, true),
      tempoIntakeReachable: await endpointReachable(args.tempoIntakeUrl, false),
    },
    disposableSession: { id: createdSessionId, created, cleaned },
  };
}

function reportText(receipt) {
  const lines = [
    `proof harness qualification: ${receipt.status}`,
    `product: ${receipt.identities.productSha}`,
    `runtime: ${receipt.identities.runtimeSha}`,
    `docs: ${receipt.identities.docsSha}`,
    `corpus: ${receipt.identities.corpusSha}`,
    `gateway/seat/run: ${receipt.identities.gatewayId} / ${receipt.identities.seat} / ${receipt.identities.runId}`,
    `required rows: ${receipt.rows.required}; producers resolved: ${receipt.rows.producersResolved}`,
    `managed proof flows: ${receipt.staleFlows.inventory.length}; contaminating: ${receipt.staleFlows.contaminating}`,
    `validation gates: ${receipt.validationGates.filter((gate) => gate.passed).length}/${receipt.validationGates.length}`,
    `hostile controls: ${receipt.hostileControls.passed}/${receipt.hostileControls.total}`,
  ];
  if (receipt.failures.length) {
    lines.push('', 'Non-PASS conditions:');
    for (const item of receipt.failures) lines.push(`- ${item.code}: ${item.message}`);
  }
  lines.push('', 'Next commands:');
  for (const command of receipt.nextCommands) lines.push(`- ${command}`);
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const required = [
    'productDir', 'productSha', 'runtimeSha', 'docsSha', 'corpusSha',
    'gatewayUrl', 'gatewayId', 'seat', 'sessionId', 'agentId', 'runId', 'outDir',
    'tempoQueryUrl', 'tempoIntakeUrl',
  ];
  for (const name of required) {
    if (!args[name]) throw new Error(`missing --${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  }

  const identities = {
    productSha: args.productSha,
    runtimeSha: args.runtimeSha,
    docsSha: args.docsSha,
    corpusSha: args.corpusSha,
    gatewayUrl: args.gatewayUrl,
    gatewayId: args.gatewayId,
    seat: args.seat,
    sessionId: args.sessionId,
    runId: args.runId,
  };
  const failures = validateExactIdentities(identities);
  const outputRoot = path.resolve(args.outDir);
  const homeRoot = realpathSync(path.resolve(process.env.HOME || ''));
  if (!isInside(outputRoot, homeRoot)) throw new Error('qualification output must be HOME-contained');
  if (existsSync(outputRoot)) throw new Error('qualification output directory must not already exist');
  let existingParent = path.dirname(outputRoot);
  while (!existsSync(existingParent)) {
    const next = path.dirname(existingParent);
    if (next === existingParent) throw new Error('qualification output has no existing parent');
    existingParent = next;
  }
  if (!lstatSync(existingParent).isDirectory() || lstatSync(existingParent).isSymbolicLink() ||
      !isInside(realpathSync(existingParent), homeRoot)) {
    throw new Error('qualification output ancestor must be a real HOME-contained directory');
  }
  let checked = homeRoot;
  for (const segment of path.relative(homeRoot, existingParent).split(path.sep).filter(Boolean)) {
    checked = path.join(checked, segment);
    if (lstatSync(checked).isSymbolicLink()) {
      throw new Error('qualification output path must not contain symlinks');
    }
  }
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  if (lstatSync(outputRoot).isSymbolicLink() || !isInside(realpathSync(outputRoot), homeRoot)) {
    throw new Error('qualification output escaped HOME during creation');
  }

  try {
    const docsHead = runGit(docsRoot, ['rev-parse', 'HEAD']);
    if (docsHead !== args.docsSha) addFailure(failures, 'docs.sha-mismatch', 'docs checkout does not match --docs-sha');
    if (runGit(docsRoot, ['status', '--porcelain', '--untracked-files=normal'])) {
      addFailure(failures, 'docs.dirty', 'docs checkout has tracked or untracked changes');
    }
    const productHead = runGit(args.productDir, ['rev-parse', 'HEAD']);
    if (productHead !== args.productSha) addFailure(failures, 'product.sha-mismatch', 'product checkout does not match --product-sha');
    if (runGit(args.productDir, ['status', '--porcelain', '--untracked-files=normal'])) {
      addFailure(failures, 'product.dirty', 'product checkout has tracked or untracked changes');
    }
  } catch (error) {
    addFailure(failures, 'git.identity', error.message || String(error));
  }

  let pnpmVersion = null;
  try {
    pnpmVersion = execFileSync('pnpm', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    addFailure(failures, 'workspace.pnpm-unavailable', 'pnpm executable is unavailable');
  }
  const workspace = validateWorkspace({ productDir: args.productDir, homeDir: homeRoot, pnpmVersion });
  failures.push(...workspace.failures);

  let environment = null;
  try {
    environment = await collectEnvironment(args);
    failures.push(...validateEnvironmentReceipt(environment, identities));
  } catch (error) {
    addFailure(failures, 'environment.unavailable', `environment qualification failed: ${error.message}`);
  }

  const index = await readJson(path.join(docsRoot, 'PROOFS/INDEX.json'), 'proof index');
  const corpusManifestPath = path.join(docsRoot, 'PROOFS', args.corpusSha, 'proofs-manifest.json');
  const corpusManifest = await readJson(corpusManifestPath, 'corpus manifest');
  if (index.current_sha !== args.corpusSha) addFailure(failures, 'corpus.index-mismatch', 'PROOFS index does not select --corpus-sha');
  if (corpusManifest.sha !== args.corpusSha) addFailure(failures, 'corpus.manifest-mismatch', 'corpus manifest does not match --corpus-sha');
  if (corpusManifest.ship_sha !== args.corpusSha || corpusManifest.capture_sha !== args.corpusSha) {
    addFailure(failures, 'corpus.identity-mismatch', 'corpus capture/ship identities do not match --corpus-sha');
  }
  const validationGates = [
    runValidationGate('manifest scenarios', 'tools/k6-proofs/scripts/check-manifest-scenarios.mjs', [], failures),
    runValidationGate('scenario alignment', 'tools/k6-proofs/scripts/check-scenario-alignment.mjs', [], failures),
    runValidationGate('proof row manifests', 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs', [], failures),
    runValidationGate('telemetry contracts', 'tools/k6-proofs/scripts/check-telemetry-contracts.mjs', [], failures),
    runValidationGate('current corpus', 'tools/k6-proofs/scripts/validate-corpus.mjs', ['--current'], failures),
    runValidationGate('closure ledger', 'tools/k6-proofs/scripts/check-final-proof-closure-ledger.mjs', [
      '--ledger', path.join(docsRoot, 'PROOFS', args.corpusSha, 'CLOSURE-WAVE-LEDGER.json'),
      '--index', path.join(docsRoot, 'PROOFS/INDEX.json'),
      '--manifest', corpusManifestPath,
    ], failures),
  ];

  const manifestDir = path.join(docsRoot, 'tools/k6-proofs/manifests');
  const manifestFiles = (await readdir(manifestDir))
    .filter((file) => file.endsWith('.json'));
  const manifests = await Promise.all(
    manifestFiles.map((file) => readJson(path.join(manifestDir, file), `manifest ${file}`)),
  );
  const producerCatalog = await readJson(
    path.join(docsRoot, 'tools/k6-proofs/qualification/producer-catalog.json'),
    'producer catalog',
  );
  const producerResult = validateProducerCatalog({
    requiredRows: corpusManifest.required_rows,
    manifests,
    catalog: producerCatalog,
    docsRoot,
    productRoot: path.resolve(args.productDir),
  });
  failures.push(...producerResult.failures);

  const receipts = args.producerReceipts
    ? await readJson(path.resolve(args.producerReceipts), 'producer receipts')
    : [];
  const signingKey = args.producerSigningKeyFile
    ? await readFile(path.resolve(args.producerSigningKeyFile))
    : null;
  if (args.producerReceipts && !signingKey) {
    addFailure(failures, 'receipt.missing-signing-key', 'producer receipts require --producer-signing-key-file');
  }
  if (!Array.isArray(receipts)) addFailure(failures, 'receipt.invalid-set', 'producer receipts must be a JSON array');
  else {
    for (const row of corpusManifest.required_rows) {
      failures.push(...validateConsumerDependencies({
        row,
        producers: producerResult.producers,
        receipts,
        identities,
        signingKey,
      }));
    }
  }

  let rawFlowInventory;
  try {
    rawFlowInventory = args.flowInventory
      ? await readJson(path.resolve(args.flowInventory), 'managed-flow inventory')
      : collectFlowInventory();
  } catch (error) {
    rawFlowInventory = null;
    addFailure(failures, 'flows.unavailable', `managed-flow inventory failed: ${error.message}`);
  }
  const staleFlows = classifyManagedFlows({
    inventory: rawFlowInventory,
    identities,
  });
  failures.push(...staleFlows.failures);

  if (args.terminalRollup) {
    const terminalRollup = await readJson(path.resolve(args.terminalRollup), 'terminal rollup');
    failures.push(...validateTerminalRollup(terminalRollup.rows, corpusManifest.required_rows));
  }

  const hostileControls = runHostileControls();
  if (!hostileControls.ok) addFailure(failures, 'hostile-controls.failed', 'one or more hostile controls did not reject bad evidence');
  const receipt = {
    schema: QUALIFICATION_SCHEMA,
    generatedAt: new Date().toISOString(),
    status: failures.length ? 'FAIL' : 'PASS',
    identities,
    workspace: {
      packageManager: workspace.packageManager,
      provenance: workspace.provenance,
      homeContained: !failures.some((item) => item.code === 'workspace.outside-home'),
    },
    environment,
    validationGates,
    rows: {
      required: corpusManifest.required_rows.length,
      producersResolved: Object.values(producerResult.producers)
        .filter((producer) => producer.reviewed === true).length,
    },
    staleFlows: {
      inventory: staleFlows.inventory,
      contaminating: staleFlows.inventory.filter((flow) => flow.contaminating).length,
    },
    hostileControls: {
      total: hostileControls.controls.length,
      passed: hostileControls.controls.filter((control) => control.rejected).length,
      controls: hostileControls.controls,
    },
    failures,
    nextCommands: failures.length
      ? ['Resolve every listed non-PASS condition, allocate a new run/session identity, and rerun this exact command.']
      : [
          `OPENCLAW_CANDIDATE_SHA=${args.productSha} OPENCLAW_RUNTIME_BUILD_SHA=${args.runtimeSha} ./tools/k6-proofs/scripts/run-proofs.sh --live --docs-ref ${args.docsSha} <ROW_ID> ${args.productSha}`,
          `node tools/k6-proofs/scripts/qualify-proof-harness.mjs <same bindings> --terminal-rollup <final-rollup.json>`,
        ],
  };
  await writeFile(path.join(outputRoot, 'qualification-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(outputRoot, 'qualification-report.txt'), reportText(receipt), { mode: 0o600, flag: 'wx' });
  process.stdout.write(reportText(receipt));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
