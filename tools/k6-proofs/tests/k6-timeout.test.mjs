import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { k6TimeoutMs } from '../lib/k6-timeout.mjs';

const scenarios = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scenarios');

test('k6TimeoutMs never hands k6 a non-positive delay', () => {
  assert.equal(k6TimeoutMs(0), 1);
  assert.equal(k6TimeoutMs(-5), 1);
  assert.equal(k6TimeoutMs(undefined), 1);
  assert.equal(k6TimeoutMs(Number.NaN), 1);
  assert.equal(k6TimeoutMs(0.5), 1);
  assert.equal(k6TimeoutMs(250), 250);
});

// Attempt 3 (2026-10-05): requestChildHops(0) -> socket.setTimeout(fn, 0) threw
// "setTimeout requires a >0 timeout parameter" after hopReadScheduled was set,
// so no child-hop read ever ran. Guard every scenario.
test('no scenario passes a literal 0 or an unclamped variable delay to socket.setTimeout', () => {
  const offenders = [];
  for (const file of readdirSync(scenarios).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(path.join(scenarios, file), 'utf8');
    for (const m of src.matchAll(/\},\s*(delayMs|delay|ms)\s*\)\s*;/g)) {
      offenders.push(`${file}: unclamped "${m[0].trim()}"`);
    }
    if (/socket\.setTimeout\(\s*\(\)\s*=>[^;]*?,\s*0\s*\)\s*;/.test(src)) offenders.push(`${file}: literal 0 delay`);
  }
  assert.deepEqual(offenders, []);
});
