import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateFinalProofClosureLedger } from '../check-final-proof-closure-ledger.mjs';

const root = path.resolve(new URL('../../../..', import.meta.url).pathname);
const sha = '5035aac3a96df18f0a5d5a5c3e91a516a32daf32';

async function loadInputs() {
  return {
    ledger: JSON.parse(
      await readFile(path.join(root, 'PROOFS', sha, 'CLOSURE-WAVE-LEDGER.json'), 'utf8'),
    ),
    index: JSON.parse(await readFile(path.join(root, 'PROOFS', 'INDEX.json'), 'utf8')),
    manifest: JSON.parse(
      await readFile(path.join(root, 'PROOFS', sha, 'proofs-manifest.json'), 'utf8'),
    ),
  };
}

test('final proof closure ledger exactly covers canonical non-PASS rows', async () => {
  const result = validateFinalProofClosureLedger(await loadInputs());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, {
    canonicalSha: sha,
    nonPassRows: 17,
    producerRows: 6,
    partialControls: 5,
    immediateAcceptanceRefires: 0,
  });
});

test('closure ledger rejects runtime relabeling and immediate acceptance refires', async () => {
  const input = await loadInputs();
  input.ledger.runtime.classification = 'final-product';
  input.ledger.policy.immediate_acceptance_refires = ['R-CD-1'];
  const result = validateFinalProofClosureLedger(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('runtime must remain deployment-composite-not-final-product'));
  assert.ok(result.errors.includes('immediate acceptance refires must be empty'));
});

test('closure ledger rejects averaged R-RC-2 evidence and missing row work', async () => {
  const input = await loadInputs();
  input.ledger.rrc2_aggregate = { context_usage: 10, threshold: 70 };
  input.ledger.rows = input.ledger.rows.filter((row) => row.row !== 'R-CD-2');
  const result = validateFinalProofClosureLedger(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('R-RC-2 paths must not be averaged'));
  assert.ok(result.errors.includes('ledger rows do not equal canonical non-PASS rows'));
});
