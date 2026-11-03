import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scenarioPath = 'tools/k6-proofs/scenarios/r-cd-model-tool.js';
const manifestPath = 'tools/k6-proofs/manifests/r-cd-model-tool.json';

test('R-CD-MODEL-TOOL classifies selected vs served identity and never uses honest limit', async () => {
  const scenario = await readFile(scenarioPath, 'utf8');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  // #562 review: selection (sessions.describe) and served (chat.history run
  // window) are separate; classifyModelIdentity owns FAIL / PARTIAL / PASS.
  assert.match(scenario, /classifyModelIdentity\(\{[\s\S]*baseline: requestedModel,[\s\S]*selected: evidence\.child_selected_model_byte,[\s\S]*served: evidence\.child_served_model_byte/);
  assert.match(scenario, /servedReceiptFromHistory\(messages, \{ anchor: taskIdentityToken, sentinel: 'MODEL-TOOL-CHILD ' \+ rowNonce \}\)/);
  assert.match(scenario, /activeFallbackFromSessionMetadata\(child\)/);
  assert.match(scenario, /tracker\.send\(socket, 'sessions\.describe'/);
  // #562: the child key comes from the child observer, not the removed task ledger.
  assert.doesNotMatch(scenario, /tracker\.send\(socket, 'tasks\.list'/);
  assert.match(scenario, /observer\.boundChild\(rowNonce, \[taskIdentityToken\]\)/);
  assert.match(scenario, /compactTaskIdentityToken\('MTOOL', rowNonce\)/);
  assert.match(scenario, /renderRowTaskTemplate\(inv\.promptTemplate \|\| DEFAULTS\.promptTemplate, rowNonce\)/);
  assert.match(scenario, /requestChildMetadata\(socket, delayMs = 1\)/);
  assert.doesNotMatch(scenario, /tracker\.send\(socket, 'sessions\.list'/);
  assert.match(scenario, /failClosedVerdict\(identity\.verdict, \{ gate, observer, keepProvenFail: true \}\)/);
  assert.match(scenario, /const verdict = finalEvidence\?\.verdict \|\| 'PARTIAL-candidate'/);
  assert.doesNotMatch(scenario, /HONEST-LIMIT-candidate/);
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.doesNotMatch(JSON.stringify(manifest), /HONEST-LIMIT-candidate/);
  assert.match(
    manifest.invocation.promptTemplate,
    /reply exactly MODEL-TOOL-CHILD \{\{nonce\}\} MODEL <provider\/model>/,
  );
  assert.doesNotMatch(manifest.invocation.promptTemplate, /openai\/gpt-5\.6-luna/);
  // #563 item 5: no built-in default model; unset or alias refuses before dispatch.
  assert.doesNotMatch(scenario, /gpt-5\.6-luna/);
  assert.doesNotMatch(JSON.stringify(manifest.invocation), /gpt-5\.6-luna/);
  assert.equal(manifest.invocation.model, '${OPENCLAW_ALT_MODEL:-}');
  assert.match(scenario, /resolveRequestedModel\(__ENV\.OPENCLAW_ALT_MODEL, inv\.model\)/);
  const refusal = scenario.indexOf('if (requested.refusal');
  assert.ok(refusal > 0 && refusal < scenario.indexOf('ws.connect('), 'refusal happens before any socket is opened');
  assert.match(
    scenario,
    /reply exactly MODEL-TOOL-CHILD \{\{nonce\}\} MODEL <provider\/model>/,
  );
});
