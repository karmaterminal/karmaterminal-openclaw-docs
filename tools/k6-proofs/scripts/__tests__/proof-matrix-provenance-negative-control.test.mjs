import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(
  'PROOFS/4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd/proofs-manifest.json',
  'utf8',
));
const supplemental = [
  'R-OBS-CONT-PROVENANCE',
  'R-OBS-PROOF-MARKER',
  'R-OBS-TERMINAL-OUTCOME',
];

test('continuation acceptance excludes the three fleet telemetry contracts', () => {
  assert.equal(manifest.required_rows.length, 38);
  assert.deepEqual(
    manifest.supplemental_rows.map((entry) => entry.row),
    supplemental,
  );
  assert.ok(manifest.required_rows.includes('R-OBS-BACKEND-DISPOSITION'));
  for (const row of supplemental) {
    assert.ok(!manifest.required_rows.includes(row));
    assert.ok(!manifest.dispatch_allocation.some((entry) => entry.row === row));
    const evidenceRow = manifest.rows.find((entry) => entry.row === row);
    assert.equal(evidenceRow.state, 'missing');
    assert.notEqual(evidenceRow.candidate_verdict, 'PASS-candidate');
  }
});
