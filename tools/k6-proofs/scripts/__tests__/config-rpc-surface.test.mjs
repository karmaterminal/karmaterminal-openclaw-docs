import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

for (const file of ['r-config-defaults.js', 'r-config-intersession.js']) {
  test(`${file} uses the direct operator config.get surface, not an owner-only agent tool`, async () => {
    const source = await readFile(path.join(root, 'tools/k6-proofs/scenarios', file), 'utf8');
    assert.match(source, /tracker\.send\(socket, 'config\.get', \{\}\)/);
    assert.match(source, /operator_surface: true/);
    assert.match(source, /query_window_start/);
    assert.doesNotMatch(source, /sessions\.create/);
    assert.doesNotMatch(source, /sessions\.send/);
    assert.doesNotMatch(source, /CONFIG-(?:DEFAULTS|INTERSESSION) \$\{rowNonce\}/);
    assert.doesNotMatch(source, /gateway tool with action=config\.get/);
  });
}
