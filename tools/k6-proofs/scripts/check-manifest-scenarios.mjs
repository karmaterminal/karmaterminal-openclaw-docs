#!/usr/bin/env node
/**
 * check-manifest-scenarios.mjs — manifest ↔ runnable scenario registry check.
 *
 * A manifest is OK when it either:
 *   - declares scenario.status="runnable" and points at an existing
 *     tools/k6-proofs/scenarios/*.js file via scenario.file (or scenario.name), or
 *   - declares scenario.status="scaffold" / "construct-only" to make a missing
 *     scenario intentionally non-runnable instead of accidental.
 *
 * The repository root comes from the shared repo-root contract, so running this
 * from the repository root and from tools/k6-proofs inspects the same files.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const { root } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
const manifestsDir = proofsToolPath(root, 'manifests');
const scenariosDir = proofsToolPath(root, 'scenarios');
const validStatuses = new Set(['runnable', 'scaffold', 'construct-only']);
const validSafetyClasses = new Set(['static-preflight-only', 'k6-runnable', 'orchestration-required', 'construct-only']);
const validArtifactClasses = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

function withoutJs(value) {
  return String(value || '').replace(/\.js$/u, '');
}

function manifestFiles() {
  return readdirSync(manifestsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

const scenarioBasenames = new Set(
  readdirSync(scenariosDir)
    .filter((name) => name.endsWith('.js'))
    .map(withoutJs),
);

const failures = [];
const rows = [];

for (const file of manifestFiles()) {
  const manifestPath = path.join(manifestsDir, file);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const scenario = manifest.scenario || {};
  const status = scenario.status;
  const runnableRef = withoutJs(scenario.file || (status === 'runnable' ? scenario.name : ''));
  const expectedRef = withoutJs(scenario.expectedFile || scenario.name);
  const existing = runnableRef ? scenarioBasenames.has(runnableRef) : false;

  rows.push({ file, rowId: manifest.rowId, status, runnableRef, expectedRef, existing });

  if (!validStatuses.has(status)) {
    failures.push(`${file}: scenario.status must be one of ${[...validStatuses].join(', ')}`);
    continue;
  }

  if (status === 'runnable') {
    if (!runnableRef) {
      failures.push(`${file}: runnable manifest must set scenario.file or scenario.name`);
    } else if (!existing) {
      failures.push(`${file}: runnable scenario '${runnableRef}.js' is missing under tools/k6-proofs/scenarios/`);
    }
  }

  if (status === 'construct-only' && (scenario.file || scenario.expectedFile)) {
    failures.push(`${file}: construct-only manifest should not declare scenario.file/expectedFile`);
  }

  const safety = manifest.liveRunSafety;
  if (safety) {
    if (!validSafetyClasses.has(safety.classification)) {
      failures.push(`${file}: liveRunSafety.classification must be one of ${[...validSafetyClasses].join(', ')}`);
    }
    if (!validArtifactClasses.has(safety.expectedArtifactClass)) {
      failures.push(`${file}: liveRunSafety.expectedArtifactClass must be one of ${[...validArtifactClasses].join(', ')}`);
    }
    if (safety.foldRequiresReview !== true) {
      failures.push(`${file}: liveRunSafety.foldRequiresReview must be true`);
    }
    if (safety.classification === 'k6-runnable' && status !== 'runnable') {
      failures.push(`${file}: liveRunSafety.classification=k6-runnable requires scenario.status=runnable`);
    }
    if (safety.classification === 'construct-only' && status === 'runnable') {
      failures.push(`${file}: liveRunSafety.classification=construct-only cannot be paired with scenario.status=runnable`);
    }
    if (safety.requiresLiveGatewayToken === true && manifest.transport === 'offline') {
      failures.push(`${file}: offline transport cannot require a live gateway token`);
    }
    if (typeof safety.requiresCandidateSha !== 'boolean') {
      failures.push(`${file}: liveRunSafety.requiresCandidateSha must be boolean`);
    }
    if (safety.requiresExternalAgentOrToolInvocation === true && manifest.toolSurface === 'read-only') {
      failures.push(`${file}: read-only toolSurface cannot require external agent/tool invocation`);
    }
    if (!Array.isArray(safety.requiredReceipts) || safety.requiredReceipts.length === 0) {
      failures.push(`${file}: liveRunSafety.requiredReceipts must be non-empty`);
    } else {
      const expected = new Set((manifest.expectedReceipts || []).map((receipt) => receipt.name));
      for (const receiptName of safety.requiredReceipts) {
        if (receiptName !== 'seat-readiness' && !expected.has(receiptName)) {
          failures.push(`${file}: liveRunSafety.requiredReceipts references '${receiptName}' but expectedReceipts has no matching receipt`);
        }
      }
    }
  }
}

for (const row of rows) {
  const ref = row.runnableRef || row.expectedRef || '-';
  const suffix = row.status === 'runnable'
    ? (row.existing ? 'OK' : 'MISSING')
    : 'intentional non-runnable';
  console.log(`${row.file}\t${row.rowId}\t${row.status}\t${ref}\t${suffix}`);
}

if (failures.length) {
  console.error('\nManifest scenario registry check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nManifest scenario registry check passed: ${rows.length} manifests; ${scenarioBasenames.size} scenario files.`);
}
