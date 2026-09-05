#!/usr/bin/env node
import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { publishArtifacts } from '../lib/atomic-artifacts.mjs';

const [runDir, reason = 'postprocess-failed'] = process.argv.slice(2);
const failures = [];
async function attempt(name, operation) {
  try { await operation(); } catch { failures.push(name); }
}
function invalidate(result) {
  result.verdict = 'FAIL-candidate';
  if (Object.hasOwn(result, 'outcome')) result.outcome = 'FAIL-candidate';
  result.verdictSource = reason;
  result.effectiveExitCode = Number(result.effectiveExitCode) || 1;
  result.postprocessExitCode = Number(result.postprocessExitCode) || 1;
  result.summaryFileVerdict = 'FAIL-candidate';
  result.vuLogVerdict = null;
  result.terminal = true;
  const pending = Array.isArray(result.review?.pendingReceipts) ? result.review.pendingReceipts : [];
  result.review = { status: 'review-pending', pendingReceipts: [...new Set([...pending, reason])] };
  if (result.evidence?.verdict) result.evidence.verdict = 'FAIL-candidate';
  if (result.metrics && typeof result.metrics === 'object') {
    result.metrics.failures = Math.max(1, Number(result.metrics.failures) || 0);
    result.metrics.proofFailures = Math.max(1, Number(result.metrics.proofFailures) || 0);
  }
  return result;
}
async function invalidateFile(name) {
  const file = path.join(runDir, name);
  let result;
  try {
    result = JSON.parse(await readFile(file, 'utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid result');
  } catch {
    failures.push(`${name}:malformed-or-missing`);
    result = {};
  }
  await publishArtifacts([[file, `${JSON.stringify(invalidate(result), null, 2)}\n`]]);
}

try {
  // Invalidate the authoritative surface first, but never skip later surfaces.
  await attempt('run-result.json', () => invalidateFile('run-result.json'));
  for (const name of ['candidate-run-result.json', 'openclaw-proofs-k6.prom',
    'openclaw-proofs-k6.otlp.json', 'metrics-export.json']) {
    await attempt(name, () => rm(path.join(runDir, name), { force: true }));
  }
  await attempt('auxiliary-results', async () => {
    for (const name of await readdir(runDir)) {
      if (!name.endsWith('summary.json') && !['row-result.json', 'fixture-result.json'].includes(name)) continue;
      await attempt(name, () => invalidateFile(name));
    }
  });
  await attempt('failure-invalidation.json', () => publishArtifacts([[
    path.join(runDir, 'failure-invalidation.json'),
    `${JSON.stringify({ ok: failures.length === 0, reason, failures }, null, 2)}\n`,
  ]]));
} catch {
  failures.push('invalidation');
}
if (failures.length) {
  console.error(`failed to cleanly invalidate all terminal artifacts: ${failures.join(', ')}`);
  process.exitCode = 1;
}
