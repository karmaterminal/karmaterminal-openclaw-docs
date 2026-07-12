import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-1-typed-delegate.js');

test('R-CD-1 rejects return-like events until the configured delegate delay elapses', async () => {
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(
    source,
    /delegate_wake_gate_ms = Math\.max\(evidence\.wake_gate_ms, evidence\.delegate_delay_ms\)/,
    'wake gate should cover both the safety floor and configured delegate delay',
  );
  assert.match(
    source,
    /Date\.now\(\) >= evidence\.delegate_scheduled_at_ms \+ evidence\.delegate_wake_gate_ms/,
    'return evidence should not be accepted before the effective wake gate',
  );
  assert.match(
    source,
    /evidence\.delegate_scheduled_at_ms \+\s+evidence\.delegate_wake_gate_ms \+\s+traceIngestGraceMs/,
    'socket close should preserve Tempo ingest grace after the same wake gate',
  );
});
