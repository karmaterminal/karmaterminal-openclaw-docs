#!/usr/bin/env node
/**
 * Check Project-81 k6 workflow/scenario alignment.
 *
 * Invariants:
 * - workflow_dispatch scenario choices are basenames (no path, no .js suffix)
 * - every workflow choice has tools/k6-proofs/scenarios/<choice>.js
 * - every manifest uses the current scenario.status registry contract:
 *   - runnable manifests point at an existing scenario via scenario.file or name
 *   - scaffold / construct-only manifests explicitly mark intentional non-runnable rows
 *
 * The repository root comes from the shared repo-root contract, so running this
 * from the repository root and from tools/k6-proofs inspects the same files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateManifestContinuationRequirements } from '../lib/continuation-depth-contract.mjs';
import { proofsToolPath, resolveRepositoryRoot } from '../lib/repo-root.mjs';

const { root: ROOT } = resolveRepositoryRoot({ argv: process.argv.slice(2) });
const SCENARIO_DIR = proofsToolPath(ROOT, 'scenarios');
const MANIFEST_DIR = proofsToolPath(ROOT, 'manifests');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/k6-proof.yml');
const VALID_STATUSES = new Set(['runnable', 'scaffold', 'construct-only']);
const VALID_SAFETY_CLASSES = new Set(['static-preflight-only', 'k6-runnable', 'orchestration-required', 'construct-only']);
const VALID_ARTIFACT_CLASSES = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

function withoutJs(value) {
  return String(value || '').replace(/\.js$/u, '');
}

function readWorkflowScenarioChoices(workflowText) {
  const lines = workflowText.split('\n');
  const choices = [];
  let inScenarioInput = false;
  let inOptions = false;
  let scenarioIndent = 0;

  for (const line of lines) {
    const scenarioMatch = line.match(/^(\s*)scenario:\s*$/u);
    if (scenarioMatch && !inScenarioInput) {
      inScenarioInput = true;
      scenarioIndent = scenarioMatch[1].length;
      continue;
    }

    if (!inScenarioInput) continue;

    const topLevelInput = line.match(/^(\s*)[a-zA-Z_][a-zA-Z0-9_]*:\s*$/u);
    if (topLevelInput && topLevelInput[1].length === scenarioIndent && !line.includes('scenario:')) {
      break;
    }

    if (line.match(/^\s*options:\s*$/u)) {
      inOptions = true;
      continue;
    }

    if (inOptions) {
      const item = line.match(/^\s*-\s+([^\s#]+)/u);
      if (item) choices.push(item[1]);
      else if (line.trim() && !line.match(/^\s*#/u)) inOptions = false;
    }
  }

  return choices;
}

const scenarioFiles = fs.readdirSync(SCENARIO_DIR)
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.basename(file, '.js'))
  .sort();
const scenarios = new Set(scenarioFiles);
const choices = readWorkflowScenarioChoices(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
const errors = [];
const manifestRows = [];

if (choices.length === 0) {
  errors.push('workflow scenario input has no choices');
}

for (const choice of choices) {
  if (choice.includes('/') || choice.endsWith('.js')) {
    errors.push(`workflow choice must be a scenario basename without path/.js: ${choice}`);
  }
  if (!scenarios.has(choice)) {
    errors.push(`workflow choice has no scenario file: tools/k6-proofs/scenarios/${choice}.js`);
  }
}

for (const file of fs.readdirSync(MANIFEST_DIR).filter((entry) => entry.endsWith('.json')).sort()) {
  const manifestPath = path.join(MANIFEST_DIR, file);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scenario = manifest.scenario || {};
  const status = scenario.status;
  const runnableRef = withoutJs(scenario.file || (status === 'runnable' ? scenario.name : ''));
  const expectedRef = withoutJs(scenario.expectedFile || scenario.name);
  const existing = runnableRef ? scenarios.has(runnableRef) : false;

  manifestRows.push({ file, rowId: manifest.rowId, status, runnableRef, expectedRef, existing });
  for (const failure of validateManifestContinuationRequirements(manifest)) {
    errors.push(`${file}: ${failure}`);
  }

  if (!VALID_STATUSES.has(status)) {
    errors.push(`${file}: scenario.status must be one of ${[...VALID_STATUSES].join(', ')}`);
    continue;
  }

  if (status === 'runnable') {
    if (!runnableRef) {
      errors.push(`${file}: runnable manifest must set scenario.file or scenario.name`);
    } else if (!existing) {
      errors.push(`${file}: runnable scenario '${runnableRef}.js' is missing under tools/k6-proofs/scenarios/`);
    }
  }

  if (status === 'construct-only' && (scenario.file || scenario.expectedFile)) {
    errors.push(`${file}: construct-only manifest should not declare scenario.file/expectedFile`);
  }

  const safety = manifest.liveRunSafety;
  if (safety) {
    if (!VALID_SAFETY_CLASSES.has(safety.classification)) {
      errors.push(`${file}: liveRunSafety.classification must be one of ${[...VALID_SAFETY_CLASSES].join(', ')}`);
    }
    if (!VALID_ARTIFACT_CLASSES.has(safety.expectedArtifactClass)) {
      errors.push(`${file}: liveRunSafety.expectedArtifactClass must be one of ${[...VALID_ARTIFACT_CLASSES].join(', ')}`);
    }
    if (safety.foldRequiresReview !== true) {
      errors.push(`${file}: liveRunSafety.foldRequiresReview must be true`);
    }
    if (safety.classification === 'k6-runnable' && status !== 'runnable') {
      errors.push(`${file}: liveRunSafety.classification=k6-runnable requires scenario.status=runnable`);
    }
    if (safety.classification === 'construct-only' && status === 'runnable') {
      errors.push(`${file}: liveRunSafety.classification=construct-only cannot be paired with scenario.status=runnable`);
    }
    if (safety.requiresLiveGatewayToken === true && manifest.transport === 'offline') {
      errors.push(`${file}: offline transport cannot require a live gateway token`);
    }
    if (typeof safety.requiresCandidateSha !== 'boolean') {
      errors.push(`${file}: liveRunSafety.requiresCandidateSha must be boolean`);
    }
    if (safety.requiresExternalAgentOrToolInvocation === true && manifest.toolSurface === 'read-only') {
      errors.push(`${file}: read-only toolSurface cannot require external agent/tool invocation`);
    }
    if (!Array.isArray(safety.requiredReceipts) || safety.requiredReceipts.length === 0) {
      errors.push(`${file}: liveRunSafety.requiredReceipts must be non-empty`);
    } else {
      const expected = new Set((manifest.expectedReceipts || []).map((receipt) => receipt.name));
      for (const receiptName of safety.requiredReceipts) {
        if (receiptName !== 'seat-readiness' && !expected.has(receiptName)) {
          errors.push(`${file}: liveRunSafety.requiredReceipts references '${receiptName}' but expectedReceipts has no matching receipt`);
        }
      }
    }
  }
}

const result = {
  workflowChoices: choices,
  scenarioFiles,
  manifests: manifestRows,
  ok: errors.length === 0,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) process.exit(1);
