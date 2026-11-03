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
// so no child-hop read ever ran. Guard EVERY socket.setTimeout in every
// scenario: its delay must be a numeric literal >= 1 or go through
// k6TimeoutMs(...). Balanced-paren scan, so inline arrow callbacks, nested
// calls and env-derived expressions are all covered (#575 review).
export function timerDelays(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('socket.setTimeout(', i)) !== -1) {
    let j = i + 'socket.setTimeout('.length;
    let depth = 1;
    let inStr = null;
    let lastTopComma = -1;
    for (; j < src.length && depth > 0; j += 1) {
      const c = src[j];
      if (inStr) { if (c === '\\') { j += 1; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '(' || c === '{' || c === '[') depth += 1;
      else if (c === ')' || c === '}' || c === ']') depth -= 1;
      else if (c === ',' && depth === 1) lastTopComma = j;
    }
    out.push(lastTopComma >= 0 ? src.slice(lastTopComma + 1, j - 1).trim() : '');
    i = j;
  }
  return out;
}

function unsafeDelays(src) {
  return timerDelays(src).filter((arg) =>
    !(/^\d+$/.test(arg) && Number(arg) >= 1) && !/^k6TimeoutMs\(/.test(arg));
}

test('the timer scan sees inline, nested and env-derived delays', () => {
  const src = [
    'socket.setTimeout(() => observer.poll(), delayMs);',
    'socket.setTimeout(() => { a(); }, Number(__ENV.X || 5000));',
    'socket.setTimeout(() => f(1, 2), 0);',
    'socket.setTimeout(() => g(), 250);',
    'socket.setTimeout(() => h(), k6TimeoutMs(delayMs));',
  ].join('\n');
  assert.deepEqual(unsafeDelays(src), ['delayMs', 'Number(__ENV.X || 5000)', '0']);
});

test('no scenario passes socket.setTimeout an unclamped or zero delay', () => {
  const offenders = [];
  for (const file of readdirSync(scenarios).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(path.join(scenarios, file), 'utf8');
    for (const arg of unsafeDelays(src)) offenders.push(`${file}: ${arg}`);
  }
  assert.deepEqual(offenders, []);
});
