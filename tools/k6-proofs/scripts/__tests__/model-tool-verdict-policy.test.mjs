import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scenarioPath = 'tools/k6-proofs/scenarios/r-cd-model-tool.js';
const manifestPath = 'tools/k6-proofs/manifests/r-cd-model-tool.json';

test('R-CD-MODEL-TOOL fails authoritative model mismatch instead of using honest limit', async () => {
  const scenario = await readFile(scenarioPath, 'utf8');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.match(scenario, /const authoritativeMismatch =[\s\S]+!evidence\.model_matches/);
  assert.match(scenario, /const verdict = authoritativeMismatch\s*\?\s*'FAIL-candidate'\s*:\s*\(complete \? 'PASS-candidate' : 'PARTIAL-candidate'\)/);
  assert.match(scenario, /finalEvidence\?\.child_session_metadata_observed[\s\S]+!finalEvidence\?\.model_matches/);
  assert.doesNotMatch(scenario, /HONEST-LIMIT-candidate/);
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.doesNotMatch(JSON.stringify(manifest), /HONEST-LIMIT-candidate/);
});

test('R-CD-MODEL-TOOL pins Luna to the allowed set and fails fallback or an ad-hoc model', async () => {
  const scenario = await readFile(scenarioPath, 'utf8');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.equal(manifest.invocation.model, '${OPENCLAW_ALT_MODEL:-openai/gpt-5.6-luna}');
  assert.deepEqual(manifest.invocation.availableModels, ['openai/gpt-5.6-luna']);
  assert.match(scenario, /const requestedModelAvailable = availableModels\.includes\(requestedModel\)/);
  assert.match(scenario, /!evidence\.requested_model_available \|\|/);
  assert.match(scenario, /'requested model is in this seat’s available set'/);
});
