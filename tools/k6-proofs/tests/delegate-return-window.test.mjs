import assert from 'node:assert/strict';
import test from 'node:test';
import { delegateReturnWindow } from '../lib/delegate-return-window.mjs';

// R-CD-1 re-run on emeric (docs#564), PDT 21:16: scheduled 11.372, child
// CD1-DONE 16.295, gate opened 16.372 (scheduled + max(5000, 1000)).
const SCHEDULED = 1791173771372;
const RETURN_AT = SCHEDULED + 4923;

test('#564: a fast child return 77 ms before the old 5 s gate is counted', () => {
  const w = delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: 1000, legacyGateMs: 5000, nowMs: RETURN_AT });
  assert.equal(w.open, true);
  assert.equal(w.beforeLegacyGate, true, 'recorded as a diagnostic, not a reason to discard');
});

test('negative control: nothing counts before the anchor exists (pre-dispatch echo)', () => {
  const w = delegateReturnWindow({ anchorAtMs: null, delayMs: 1000, legacyGateMs: 5000, nowMs: RETURN_AT });
  assert.equal(w.open, false);
  assert.equal(w.opensAtMs, null);
});

test('negative control: nothing counts before the delegate delay has elapsed', () => {
  const w = delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: 1000, legacyGateMs: 5000, nowMs: SCHEDULED + 999 });
  assert.equal(w.open, false);
  assert.equal(w.opensAtMs, SCHEDULED + 1000);
});

test('a return after the old gate is counted and not flagged', () => {
  const w = delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: 1000, legacyGateMs: 5000, nowMs: SCHEDULED + 9000 });
  assert.equal(w.open, true);
  assert.equal(w.beforeLegacyGate, false);
});

test('a delay longer than the old gate still sets the floor', () => {
  assert.equal(delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: 8000, legacyGateMs: 5000, nowMs: SCHEDULED + 6000 }).open, false);
  assert.equal(delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: 8000, legacyGateMs: 5000, nowMs: SCHEDULED + 8000 }).open, true);
});

test('a zero or missing delay opens at the anchor itself, never before it', () => {
  assert.equal(delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: 0, legacyGateMs: 5000, nowMs: SCHEDULED }).open, true);
  assert.equal(delegateReturnWindow({ anchorAtMs: SCHEDULED, delayMs: undefined, legacyGateMs: 5000, nowMs: SCHEDULED - 1 }).open, false);
});
