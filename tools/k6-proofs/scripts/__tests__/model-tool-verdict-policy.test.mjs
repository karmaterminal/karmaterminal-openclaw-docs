import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scenarioPath = 'tools/k6-proofs/scenarios/r-cd-model-tool.js';
const manifestPath = 'tools/k6-proofs/manifests/r-cd-model-tool.json';

test('R-CD-MODEL-TOOL fails authoritative model mismatch instead of using honest limit', async () => {
  const scenario = await readFile(scenarioPath, 'utf8');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.match(scenario, /const authoritativeMismatch =[\s\S]+!evidence\.model_matches/);
  assert.match(scenario, /tracker\.send\(socket, 'sessions\.describe'/);
  assert.match(scenario, /tracker\.send\(socket, 'tasks\.list'/);
  assert.match(scenario, /childSessionKeyForRow\(classified\.payload, rowNonce\)/);
  assert.match(scenario, /requestChildMetadata\(socket, delayMs = 1\)/);
  assert.doesNotMatch(scenario, /tracker\.send\(socket, 'sessions\.list'/);
  assert.match(scenario, /const verdict = authoritativeMismatch\s*\?\s*'FAIL-candidate'\s*:\s*\(complete \? 'PASS-candidate' : 'PARTIAL-candidate'\)/);
  assert.match(scenario, /finalEvidence\?\.child_session_metadata_observed[\s\S]+!finalEvidence\?\.model_matches/);
  assert.doesNotMatch(scenario, /HONEST-LIMIT-candidate/);
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.doesNotMatch(JSON.stringify(manifest), /HONEST-LIMIT-candidate/);
});
