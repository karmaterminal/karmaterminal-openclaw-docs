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
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCENARIO_DIR = path.join(ROOT, 'tools/k6-proofs/scenarios');
const MANIFEST_DIR = path.join(ROOT, 'tools/k6-proofs/manifests');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/k6-proof.yml');
const VALID_STATUSES = new Set(['runnable', 'scaffold', 'construct-only']);

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
