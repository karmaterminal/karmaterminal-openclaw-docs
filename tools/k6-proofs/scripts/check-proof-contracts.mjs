#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const TRANSPORTS = new Set(['websocket', 'http-tools-invoke', 'offline', 'process-local', 'github-source-contract']);
const TOOL_SURFACES = new Set(['typed-tool', 'token', 'bracket-token', 'read-only', 'mixed', 'source-status-formatter']);
const VERDICTS = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

function applicability(manifest) {
  if (manifest.rowId === 'PREFLIGHT') return 'preflight';
  if (manifest.transport === 'offline') return 'static';
  if (manifest.transport === 'process-local') return 'fixture';
  if (manifest.transport === 'github-source-contract') return 'source-contract';
  return 'live';
}

function tempoStrategy(manifest) {
  const receipts = manifest.liveRunSafety?.requiredReceipts || [];
  if (!receipts.some((name) => /trace|tempo/i.test(name))) return 'not-required';
  if (['continue_work', 'continue_delegate'].includes(manifest.invocation?.tool)) {
    return 'bounded-reason-fingerprint';
  }
  return 'bounded-trace-id';
}

function hasNonceContract(manifest) {
  return JSON.stringify(manifest.invocation || {}).includes('{{nonce}}');
}

export function checkProofContracts(root) {
  const manifestsDir = proofsToolPath(root, 'manifests');
  const scenariosDir = proofsToolPath(root, 'scenarios');
  const exceptionsPath = proofsToolPath(root, 'scenario-contract-exceptions.json');
  const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8')).scenarios || [];
  const exceptionFiles = new Set(exceptions.map((entry) => entry.file));
  const scenarioFiles = readdirSync(scenariosDir).filter((name) => name.endsWith('.js')).sort();
  const referencedScenarios = new Set();
  const failures = [];
  const rows = [];

  for (const file of readdirSync(manifestsDir).filter((name) => name.endsWith('.json')).sort()) {
    const manifest = JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8'));
    const scenarioFile = manifest.scenario?.file
      || (manifest.scenario?.status === 'runnable' ? `${manifest.scenario?.name || ''}.js` : null);
    const receipts = manifest.liveRunSafety?.requiredReceipts || [];
    const expected = new Set((manifest.expectedReceipts || []).map((receipt) => receipt.name));
    const row = {
      rowId: manifest.rowId,
      manifest: file,
      scenario: scenarioFile || manifest.scenario?.expectedFile || null,
      scenarioStatus: manifest.scenario?.status || null,
      applicability: applicability(manifest),
      transport: manifest.transport,
      toolSurface: manifest.toolSurface,
      nonce: hasNonceContract(manifest) ? 'manifest-template' : 'scenario-specific-or-none',
      targetSession: manifest.liveRunSafety?.requiresTargetSessionKey ? 'explicit-required' : 'scenario-managed-or-not-applicable',
      expectedArtifactClass: manifest.liveRunSafety?.expectedArtifactClass || null,
      predicateReceipts: receipts,
      resultSchema: 'openclaw.k6.run-result.v1',
      tempoStrategy: tempoStrategy(manifest),
      tempoWindow: tempoStrategy(manifest) === 'not-required'
        ? null
        : 'dispatch/start minus 60s through collector completion plus 60s',
    };
    rows.push(row);

    if (manifest.artifactDestination?.row !== manifest.rowId) {
      failures.push(`${file}: artifactDestination.row must equal rowId`);
    }
    if (!TRANSPORTS.has(manifest.transport)) failures.push(`${file}: unsupported transport ${manifest.transport}`);
    if (!TOOL_SURFACES.has(manifest.toolSurface)) failures.push(`${file}: unsupported toolSurface ${manifest.toolSurface}`);
    if (!VERDICTS.has(manifest.liveRunSafety?.expectedArtifactClass)) {
      failures.push(`${file}: unsupported expectedArtifactClass ${manifest.liveRunSafety?.expectedArtifactClass}`);
    }
    for (const receipt of receipts) {
      if (receipt !== 'seat-readiness' && !expected.has(receipt)) {
        failures.push(`${file}: required receipt '${receipt}' is not declared in expectedReceipts`);
      }
    }
    if (manifest.scenario?.status === 'runnable') {
      if (!scenarioFile || !scenarioFiles.includes(scenarioFile)) {
        failures.push(`${file}: runnable scenario is missing`);
      } else {
        referencedScenarios.add(scenarioFile);
        const source = readFileSync(path.join(scenariosDir, scenarioFile), 'utf8');
        if (!/EVIDENCE/.test(source)) failures.push(`${scenarioFile}: runnable scenario must emit evidence`);
        if (!/export function handleSummary/.test(source)) {
          failures.push(`${scenarioFile}: runnable scenario must emit one summary verdict`);
        }
      }
    }
  }

  const unregistered = scenarioFiles.filter((file) => !referencedScenarios.has(file));
  const undocumented = unregistered.filter((file) => !exceptionFiles.has(file));
  const staleExceptions = [...exceptionFiles].filter((file) => !unregistered.includes(file));
  if (undocumented.length) failures.push(`unregistered scenarios lack explicit exceptions: ${undocumented.join(', ')}`);
  if (staleExceptions.length) failures.push(`scenario exceptions are stale: ${staleExceptions.join(', ')}`);

  return { schema: 'openclaw.k6.proof-contract-matrix.v1', rows, unregistered, exceptions, failures };
}

function renderMarkdown(result) {
  const lines = [
    '# k6 proof scenario contract matrix',
    '',
    'Generated from canonical row manifests by `scripts/check-proof-contracts.mjs --markdown`.',
    '',
    '| Row | Scenario | Applicability | Inputs | Expected class | Predicate receipts | Tempo |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const row of result.rows) {
    lines.push(`| ${row.rowId} | \`${row.scenario || '-'}\` | ${row.applicability} | nonce: ${row.nonce}; session: ${row.targetSession} | ${row.expectedArtifactClass} | ${row.predicateReceipts.join(', ')} | ${row.tempoStrategy} |`);
  }
  lines.push('', '## Explicit scenario exceptions', '');
  for (const exception of result.exceptions) {
    lines.push(`- \`${exception.file}\` — **${exception.status}**: ${exception.reason}`);
  }
  lines.push('');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { root, rest } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
  const result = checkProofContracts(root);
  if (rest.includes('--markdown')) process.stdout.write(renderMarkdown(result));
  else console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
