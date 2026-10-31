import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-1-typed-delegate.js');

test('R-CD-1 keeps the docs#564 return window as a diagnostic on stream text', async () => {
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
    /if \(returnSentinel && returnWindow\.open\) \{\s*evidence\.return_text_seen = true;/,
    'stream text inside the window is recorded as a diagnostic only',
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

test('R-CD-1 credits the return only from the child-minted token a later parent run reproduces (#1727)', async () => {
  // The return sentinel used to ride the delegate task, so the parent's own
  // call carried it and only the window kept it out. The verdict now needs the
  // child's own minted token and a parent run outside the dispatch run.
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(source, /mintedTokenFromHistory\(messages, \{ marker: 'CD1-DONE', nonce: rowNonce, sentTexts \}\)/);
  assert.match(source, /marker: 'CD1-RETURN',[\s\S]*?excludeRunIds: \[dispatchRunId\],[\s\S]*?notBeforeTimestamp: childTokenTimestamp,/);
  assert.match(source, /evidence\.child_return_bound && evidence\.parent_return_event;/);
  assert.doesNotMatch(source, /evidence\.parent_return_event = true;\s*evidence\.parent_return_event_at_ms = Date\.now\(\);\s*if \(returnWindow/);
});
