#!/usr/bin/env node
/**
 * Check Project-81 k6 scenario alignment.
 *
 * Invariants:
 * - workflow_dispatch scenario choices are basenames (no path, no .js suffix)
 * - every workflow choice has tools/k6-proofs/scenarios/<choice>.js
 * - every manifest with scenario.status="runnable" points at an existing scenario via scenario.file or scenario.name
 * - every non-runnable manifest explicitly uses scenario.status scaffold/construct-only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCENARIO_DIR = path.join(ROOT, 'tools/k6-proofs/scenarios');
const MANIFEST_DIR = path.join(ROOT, 'tools/k6-proofs/manifests');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/k6-proof.yml');

function readWorkflowScenarioChoices(workflowText) {
  const lines = workflowText.split('\n');
  const choices = [];
  let inScenarioInput = false;
  let inOptions = false;
  let scenarioIndent = 0;

  for (const line of lines) {
    const scenarioMatch = line.match(/^(\s*)scenario:\s*$/);
    if (scenarioMatch && !inScenarioInput) {
      inScenarioInput = true;
      scenarioIndent = scenarioMatch[1].length;
      continue;
    }

    if (inScenarioInput) {
      const topLevelInput = line.match(/^(\s*)[a-zA-Z_][a-zA-Z0-9_]*:\s*$/);
      if (topLevelInput && topLevelInput[1].length === scenarioIndent && !line.includes('scenario:')) {
        break;
      }
      if (line.match(/^\s*options:\s*$/)) {
        inOptions = true;
        continue;
      }
      if (inOptions) {
        const item = line.match(/^\s*-\s+([^\s#]+)/);
        if (item) choices.push(item[1]);
        else if (line.trim() && !line.match(/^\s*#/)) inOptions = false;
      }
    }
  }

  return choices;
}

function main() {
  const scenarios = new Set(
    fs.readdirSync(SCENARIO_DIR)
      .filter((file) => file.endsWith('.js'))
      .map((file) => path.basename(file, '.js')),
  );

  const choices = readWorkflowScenarioChoices(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
  const errors = [];

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
    const name = scenario.name;
    if (!name) continue;

    if (name.includes('/') || name.endsWith('.js')) {
      errors.push(`${file}: scenario.name must be a basename without path/.js: ${name}`);
    }

    const status = scenario.status;
    const ref = (scenario.file || name || '').replace(/\.js$/u, '');
    const exists = scenarios.has(ref);
    if (!['runnable', 'scaffold', 'construct-only'].includes(status)) {
      errors.push(`${file}: scenario.status must be runnable, scaffold, or construct-only`);
    }
    if (status === 'runnable' && !exists) {
      errors.push(`${file}: runnable scenario has no file: tools/k6-proofs/scenarios/${ref}.js`);
    }
    if (status !== 'runnable' && exists) {
      errors.push(`${file}: scenario ${ref}.js exists but scenario.status is ${status}, not runnable`);
    }
  }

  const result = {
    workflowChoices: choices,
    scenarioFiles: [...scenarios].sort(),
    ok: errors.length === 0,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length > 0) process.exit(1);
}

main();
