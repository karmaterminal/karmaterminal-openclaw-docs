import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRuntimeStamp,
  parseRuntimeBuildReceipt,
  resolveExactRuntimeIdentity,
} from '../../lib/runtime-identity.mjs';

const sha = '46f4d2115700d574501bb3c4763abf6b2ba977fe';
const other = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('accepts an exact structured build receipt', () => {
  const parsed = parseRuntimeBuildReceipt({
    schema: 'openclaw.k6.runtime-build-receipt.v1',
    sha,
  }, { source: 'runtime-build-receipt', path: '/tmp/receipt.json' });
  assert.deepEqual(
    { ok: parsed.ok, sha: parsed.sha, source: parsed.source },
    { ok: true, sha, source: 'runtime-build-receipt' },
  );
});

test('resolves exact identity from installed version JSON independently of the candidate', () => {
  const identity = resolveExactRuntimeIdentity([
    { source: 'openclaw-version-json', receipt: { build: { sha } } },
    { kind: 'candidate-sha', sha: other },
  ]);
  assert.equal(identity.ok, true);
  assert.equal(identity.sha, sha);
  assert.equal(identity.source, 'openclaw-version-json');
});

test('rejects mismatched independent exact sources', () => {
  const identity = resolveExactRuntimeIdentity([
    { source: 'operator-env-exact-sha', sha },
    { source: 'openclaw-version-json', receipt: { build: { sha: other } } },
  ]);
  assert.equal(identity.ok, false);
  assert.equal(identity.reason, 'ambiguous');
  assert.equal(identity.sha, null);
});

test('rejects malformed, absent, and short-only stamps without inventing a full SHA', () => {
  assert.equal(resolveExactRuntimeIdentity([]).reason, 'absent');
  assert.equal(resolveExactRuntimeIdentity([
    { source: 'runtime-build-receipt', receipt: { schema: 'nope', sha: 'not-a-sha' } },
  ]).reason, 'malformed');
  const short = resolveExactRuntimeIdentity([
    { source: 'openclaw-version-stamp', stamp: 'OpenClaw 2026.8.1 (46f4d21)' },
  ]);
  assert.equal(short.ok, false);
  assert.equal(short.reason, 'short-only');
  assert.equal(short.sha, null);
  assert.equal(classifyRuntimeStamp('46f4d21').kind, 'short-only');
});
