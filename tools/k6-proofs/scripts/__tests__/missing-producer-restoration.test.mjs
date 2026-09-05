import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProducerCatalog } from '../../lib/proof-harness-qualification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RESTORED = [
  'R-CD-COLLECTION-ON-COLLAPSE',
  'R-CW-7',
  'R-CW-DELEGATE-CHILD-LIVE',
  'R-CW-DELEGATE-TOKEN',
  'R-CW-MULTI',
  'R-CW-MULTI-COLLAPSE',
];

test('restored missing rows are live/process-local producers, not static-corpus-row-validator', async () => {
  const catalog = JSON.parse(await readFile(
    path.join(root, 'tools/k6-proofs/qualification/producer-catalog.json'),
    'utf8',
  ));
  const manifests = [];
  for (const row of [...RESTORED, 'R-CD-RETURN-OVERLAP', 'R-OBS-2', 'R-CD-RETURN-COVENANT-AUTHORITY']) {
    const file = `r-${row.slice(2).toLowerCase().replaceAll('_', '-')}.json`;
    const mapped = {
      'R-CD-COLLECTION-ON-COLLAPSE': 'r-cd-collection-on-collapse.json',
      'R-CW-7': 'r-cw-7.json',
      'R-CW-DELEGATE-CHILD-LIVE': 'r-cw-delegate-child-live.json',
      'R-CW-DELEGATE-TOKEN': 'r-cw-delegate-token.json',
      'R-CW-MULTI': 'r-cw-multi.json',
      'R-CW-MULTI-COLLAPSE': 'r-cw-multi-collapse.json',
      'R-CD-RETURN-OVERLAP': 'r-cd-return-overlap.json',
      'R-OBS-2': 'r-obs-2.json',
      'R-CD-RETURN-COVENANT-AUTHORITY': 'r-cd-return-covenant-authority.json',
    }[row];
    manifests.push(JSON.parse(await readFile(path.join(root, 'tools/k6-proofs/manifests', mapped), 'utf8')));
    void file;
  }
  const productRoot = '/home/figs/flesh_beast_best_beast/source/WORKTREES/openclaw-7cb9d71f-missing-producer-trace';
  const result = validateProducerCatalog({
    requiredRows: [...RESTORED, 'R-CD-RETURN-OVERLAP', 'R-OBS-2', 'R-CD-RETURN-COVENANT-AUTHORITY'],
    manifests,
    catalog,
    docsRoot: root,
    productRoot: existsSync(productRoot) ? productRoot : root,
  });
  assert.deepEqual(result.failures, []);
  for (const row of RESTORED) {
    const producer = result.producers[row];
    assert.ok(producer, row);
    assert.notEqual(producer.kind, 'consumer');
    assert.equal(producer.reviewed, true);
    assert.doesNotMatch(producer.command, /static-corpus-row-validator/);
    const manifest = manifests.find((entry) => entry.rowId === row);
    assert.notEqual(manifest.scenario?.file, 'static-corpus-row-validator.js');
  }
  assert.deepEqual(result.producers['R-CD-RETURN-OVERLAP'].dependsOn, ['R-CD-RETURN-COVENANT-AUTHORITY']);
  assert.ok(result.producers['R-OBS-2'].dependsOn.includes('R-CW-7'));
  assert.ok(result.producers['R-OBS-2'].dependsOn.includes('R-CW-DELEGATE-CHILD-LIVE'));
  assert.ok(result.producers['R-OBS-2'].dependsOn.includes('R-CW-DELEGATE-TOKEN'));
  assert.ok(result.producers['R-OBS-2'].dependsOn.includes('R-CW-MULTI'));
});
