import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const scenariosDir = path.join(repoRoot, 'tools/k6-proofs/scenarios');

test('every trace-required continue_delegate row persists the safe fingerprint contract', async () => {
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json'));
  const rows = [];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
    const required = (manifest.liveRunSafety?.requiredReceipts || []).map((value) => String(value).toLowerCase());
    if (manifest.invocation?.tool !== 'continue_delegate' ||
        !required.some((value) => value === 'trace-id' || value === 'tempo-trace-json')) {
      continue;
    }
    rows.push(manifest.rowId);
    const scenario = await readFile(path.join(scenariosDir, manifest.scenario.file), 'utf8');
    assert.match(scenario, /reason_hash:\s*null/);
    assert.match(scenario, /reason_length:\s*null/);
    assert.match(scenario, /delegate_mode:\s*null/);
    assert.match(scenario, /crypto\.sha256\([^,]+,\s*'hex'\)\.slice\(0,\s*16\)/);
    assert.match(scenario, /promptTemplate\.replace\(\/\\\{\\\{nonce\\\}\\\}\/g,/);
  }

  assert.deepEqual(rows.sort(), [
    'R-CD-1',
    'R-CD-2',
    'R-CD-4',
    'R-CD-CHAINED-DEPTH-2',
    'R-RC-2',
  ]);
});

test('every trace-required continue_work row persists the safe fingerprint contract', async () => {
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json'));
  const rows = [];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
    const required = (manifest.liveRunSafety?.requiredReceipts || [])
      .map((value) => String(value).toLowerCase());
    if (manifest.invocation?.tool !== 'continue_work' ||
        !required.some((value) => value === 'trace-id' || value === 'tempo-trace-json')) {
      continue;
    }
    rows.push(manifest.rowId);
    const scenario = await readFile(path.join(scenariosDir, manifest.scenario.file), 'utf8');
    assert.match(scenario, /reason_hash:\s*crypto\.sha256\([^,]+,\s*'hex'\)\.slice\(0,\s*16\)/);
    assert.match(scenario, /reason_length:\s*(?:wakeReason|rawReason)\.length/);
    assert.match(scenario, /inv\.reason\.replace\(\/\\\{\\\{nonce\\\}\\\}\/g,/);
    assert.match(manifest.invocation.reason, /\{\{nonce\}\}/);
    if (manifest.rowId === 'R-CW-3') {
      assert.match(scenario, /rawReasonSentinel = `RAW-RCW3-\$\{rowNonce\}`/);
      assert.doesNotMatch(scenario, /rawReasonSentinel.*Math\.random/);
    }
  }

  assert.deepEqual(rows.sort(), ['R-CW-1', 'R-CW-3']);
});

test('depth-2 chain dispatch uses the exact committed manifest task', async () => {
  const source = await readFile(path.join(scenariosDir, 'r-cd-chained-depth-2.js'), 'utf8');
  assert.match(source, /const task = inv\.promptTemplate\.replace\(\/\\\{\\\{nonce\\\}\\\}\/g, chainNonce\)/);
  assert.match(source, /task=\$\{JSON\.stringify\(task\)\}/);
});

test('row runner keeps private acquisition transient and publishes sanitized evidence', async () => {
  const runner = await readFile(path.join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');
  assert.match(runner, /PRIVATE_K6_LOG="\$\(mktemp/);
  assert.match(runner, /PRIVATE_EVIDENCE_FILE="\$\(mktemp/);
  assert.match(runner, /PRIVATE_GATEWAY_LOG="\$\(mktemp/);
  assert.match(runner, /journalctl[\s\S]+--after-cursor/);
  assert.match(runner, /ARTIFACT_SANITIZER/);
  assert.match(runner, /--log-out "\$RUN_DIR\/k6\.log"/);
  assert.match(runner, /--service-log-out "\$RUN_DIR\/gateway-journal\.log"/);
  assert.match(runner, /gateway-journal-capture\.json/);
  assert.match(runner, /gateway-journal-redaction\.json/);
  assert.match(runner, /VU_LOG_VERDICT/);
  assert.match(runner, /verdict-reconciliation\.json/);
  assert.match(runner, /selectedSource: \$selectedSource/);
  assert.doesNotMatch(runner, /tee "\$RUN_DIR\/k6\.log"/);
  assert.doesNotMatch(runner, /gateway-journal\.private/);
  assert.doesNotMatch(runner, /sessionKey:\$session/);
});

test('R-CD-2 row-list runner declares the signed receipt that candidate routing validates', async () => {
  const runner = await readFile(path.join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');
  assert.match(runner, /R_CD_2_RECEIPT_SHA256/);
  assert.match(runner, /createHash\("sha256"\)/);
  assert.match(runner, /authoritativeReceipt:\(if \$authoritativeReceiptSha256 == "" then null else \{file:"r-cd-2-authoritative-receipt\.json", sha256:\$authoritativeReceiptSha256, validated:true/);
});
