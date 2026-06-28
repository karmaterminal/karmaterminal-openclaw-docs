import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { chmodSync, readFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const alignmentScript = join(repoRoot, 'tools/k6-proofs/scripts/check-scenario-alignment.mjs');
const runProof = join(repoRoot, 'tools/k6-proofs/run-proof.sh');
const preflightScenario = join(repoRoot, 'tools/k6-proofs/scenarios/preflight.js');

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p81-k6-scenario-alignment-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

test('workflow scenario choices resolve to checked-in scenario basenames', () => {
  const result = run(process.execPath, [alignmentScript]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.ok, true);
  assert.ok(parsed.workflowChoices.includes('preflight'));
  for (const choice of parsed.workflowChoices) {
    assert.equal(choice.includes('/'), false, `${choice} should be a basename`);
    assert.equal(choice.endsWith('.js'), false, `${choice} should omit .js`);
    assert.ok(parsed.scenarioFiles.includes(choice), `${choice}.js should exist`);
  }
});

test('run-proof.sh accepts scenario basenames and expands them to scenario files', async () => {
  await withTmp(async (dir) => {
    const argsOut = join(dir, 'k6-args.txt');
    const k6Stub = join(dir, 'k6');
    await writeFile(k6Stub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$K6_ARGS_OUT"\n');
    chmodSync(k6Stub, 0o755);

    const result = run(runProof, ['preflight'], {
      env: {
        ...process.env,
        PATH: `${dir}${delimiter}${process.env.PATH || ''}`,
        K6_ARGS_OUT: argsOut,
        OPENCLAW_CANDIDATE_SHA: '0123456789abcdef0123456789abcdef01234567',
        OPENCLAW_SEAT_NAME: 'test-seat',
        K6_PROMETHEUS_RW_SERVER_URL: 'http://prometheus.example/api/v1/write',
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const args = (await readFile(argsOut, 'utf8')).trim().split('\n');
    assert.deepEqual(args.slice(0, 2), ['run', preflightScenario]);
    assert.ok(args.includes('--out'));
    assert.ok(args.includes('--env'));
  });
});

test('run-proof.sh rejects filename/path inputs instead of translating them', () => {
  for (const badScenario of ['preflight.js', 'scenarios/preflight']) {
    const result = run(runProof, [badScenario], {
      env: {
        ...process.env,
        OPENCLAW_CANDIDATE_SHA: '0123456789abcdef0123456789abcdef01234567',
        OPENCLAW_SEAT_NAME: 'test-seat',
      },
    });

    assert.notEqual(result.status, 0, `${badScenario} unexpectedly succeeded`);
    assert.match(result.stdout + result.stderr, /basename without path or \.js suffix/);
  }
});
