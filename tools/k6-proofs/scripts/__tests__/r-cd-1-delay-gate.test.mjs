import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-1-typed-delegate.js');

test('R-CD-1 rejects return-like events until the configured delegate delay elapses', async () => {
  // docs#564: the window opens at scheduled + delegate delay (the earliest a
  // real return can exist), not at a fixed 5 s gate that discarded a real
  // return 77 ms early. The decision lives in lib/delegate-return-window.mjs
  // and is unit-tested there; this pins that the scenario uses it.
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(
    source,
    /delegateReturnWindow\(\{\s*anchorAtMs: evidence\.delegate_scheduled_at_ms,\s*delayMs: evidence\.delegate_delay_ms,/,
    'return window must be anchored on the scheduled sentinel and floored at the delegate delay',
  );
  assert.match(
    source,
    /if \(returnSentinel && returnWindow\.open\)/,
    'return evidence should not be accepted before the window opens',
  );
  assert.doesNotMatch(
    source,
    /Date\.now\(\) >= evidence\.delegate_scheduled_at_ms \+ evidence\.delegate_wake_gate_ms/,
    'the fixed wake gate must no longer decide whether a return counts',
  );
  assert.match(
    source,
    /evidence\.delegate_scheduled_at_ms \+\s+evidence\.delegate_wake_gate_ms \+\s+traceIngestGraceMs/,
    'socket close should preserve Tempo ingest grace after the same wake gate',
  );
});
