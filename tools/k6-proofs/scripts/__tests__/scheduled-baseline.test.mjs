import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ROLLUP_SCHEMA,
  artifactName,
  buildRollup,
  corpusObservations,
  deployCheck,
  historyObservations,
  lastDailyOccurrence,
  parseArtifactName,
  renderRollupMarkdown,
  watchdog,
} from '../../lib/scheduled-baseline.mjs';
import { loadCatalog } from '../scheduled-baseline.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const cli = path.join(repoRoot, 'tools/k6-proofs/scripts/scheduled-baseline.mjs');
const SHA = '7d8a1a91c6724367e5cd6f6d6ca0248af59c8ac0';
const OLD = '3821eaef7267aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const catalog = { live: ['R-CD-1', 'R-CD-2', 'R-RC-2'], orchestrationOnly: ['R-CW-5'], constructOnly: [] };

function rollup(overrides = {}) {
  return buildRollup({
    catalog,
    results: [],
    corpus: new Map(),
    history: new Map(),
    sha: SHA,
    seat: 'ronan',
    docsRef: 'b'.repeat(40),
    trigger: 'nightly',
    runUrl: 'https://example.invalid/runs/1',
    generatedAt: '2026-10-20T03:00:00.000Z',
    ...overrides,
  });
}

test('the live-suite denominator is 34, with R-CW-5/5A/6/6A orchestration-only', () => {
  const real = loadCatalog(repoRoot);
  assert.equal(real.live.length, 34);
  assert.deepEqual(real.orchestrationOnly, ['R-CW-5', 'R-CW-5A', 'R-CW-6', 'R-CW-6A']);
  const listed = spawnSync(process.execPath, [path.join(repoRoot, 'tools/k6-proofs/scripts/list-runnable-rows.mjs'), '--live-suite', '--lines'], { cwd: repoRoot, encoding: 'utf8' });
  assert.deepEqual(listed.stdout.trim().split('\n').sort(), real.live, 'rollup denominator equals the rows the runner fires');
});

test('a run with no row result did not fire, alerts, and names the earliest failed stage', () => {
  const blocked = rollup({ blockedAt: 'isolated-gateway', isolatedGateway: { outcome: 'NOT-READY', notes: ['runtime-sha-not-observed'] } });
  assert.equal(blocked.fired, false);
  assert.equal(blocked.alert, true);
  assert.equal(blocked.notFiredReason, 'isolated-gateway-not-ready:runtime-sha-not-observed');
  assert.deepEqual(blocked.counts, { pass: 0, partial: 0, fail: 0, missing: 3, honest_limit: 0 });
  assert.deepEqual(blocked.regressions, [], 'missing rows of an unfired run are not row regressions');
  assert.equal(rollup({ blockedAt: 'resolve-build', deployedBuild: { notes: ['build-info-not-found'] } }).notFiredReason, 'resolve-build:build-info-not-found');
  assert.equal(rollup({ harnessControl: { stage: 'seat-readiness', reason: 'x' } }).notFiredReason, 'harness-seat-readiness:x');
  assert.match(renderRollupMarkdown(blocked), /NOT FIRED/u);
});

test('regression means the last observation was an acceptable verdict and this one is not', () => {
  const corpus = corpusObservations([
    { sha: OLD, manifest: { generated: '2026-09-20T00:00:00Z', fire_type: 'fresh-fire', rows: [
      { row: 'R-CD-1', state: 'pass' }, { row: 'R-CD-2', state: 'partial' }, { row: 'R-RC-2', state: 'honest_limit' },
    ] } },
    { sha: 'c'.repeat(40), manifest: { generated: '2026-07-01T00:00:00Z', fire_type: 'full-copy-transpose-from-x', rows: [{ row: 'R-CD-2', state: 'pass' }] } },
  ]);
  const result = rollup({
    corpus,
    results: [
      { row: 'R-CD-1', verdict: 'FAIL-candidate', endedAt: '1' },
      { row: 'R-CD-2', verdict: 'PARTIAL-candidate', endedAt: '1' },
      { row: 'R-RC-2', verdict: 'HONEST-LIMIT-candidate', endedAt: '1' },
    ],
  });
  assert.equal(result.fired, true);
  assert.deepEqual(result.regressions, ['R-CD-1'], 'still-partial and honest-limit rows do not alert');
  const cd2 = result.rows.find((r) => r.row === 'R-CD-2');
  assert.equal(cd2.lastPass.sha, 'c'.repeat(40));
  assert.equal(cd2.lastPass.carried, true, 'a transposed PASS is labelled carried, not fresh');
  assert.equal(result.alert, true);
});

test('the previous baseline outranks older corpus history, and the newest result per row wins', () => {
  const history = historyObservations([
    { schema: ROLLUP_SCHEMA, fired: true, sha: SHA, trigger: 'nightly', generatedAt: '2026-10-19T03:00:00Z', runUrl: 'u', rows: [
      { row: 'R-CD-1', cls: 'partial' }, { row: 'R-CD-2', cls: 'pass' }, { row: 'R-RC-2', cls: 'missing' },
    ] },
    { schema: ROLLUP_SCHEMA, fired: false, sha: SHA, trigger: 'nightly', generatedAt: '2026-10-19T04:00:00Z', rows: [{ row: 'R-CD-2', cls: 'missing' }] },
  ]);
  const corpus = corpusObservations([{ sha: OLD, manifest: { generated: '2026-09-20T00:00:00Z', rows: [{ row: 'R-CD-1', state: 'pass' }] } }]);
  const result = rollup({
    history,
    corpus,
    results: [
      { row: 'R-CD-1', verdict: 'PARTIAL-candidate', endedAt: '2026-10-20T02:30:00Z' },
      { row: 'R-CD-2', verdict: 'PASS-candidate', endedAt: '2026-10-20T02:20:00Z' },
      { row: 'R-CD-2', verdict: 'PARTIAL-candidate', endedAt: '2026-10-20T02:40:00Z' },
    ],
  });
  assert.deepEqual(result.regressions, ['R-CD-2']);
  const cd1 = result.rows.find((r) => r.row === 'R-CD-1');
  assert.equal(cd1.regressed, false, 'R-CD-1 already regressed last night; alert once, not nightly');
  assert.equal(cd1.lastPass.sha, OLD);
  assert.equal(result.rows.find((r) => r.row === 'R-RC-2').cls, 'missing');
});

test('artifact names carry seat, SHA and fire status and round-trip', () => {
  const name = artifactName({ seat: 'ronan-dgx', sha: SHA, fired: true, runId: 99 });
  assert.equal(name, `k6-baseline-ronan-dgx-${SHA.slice(0, 12)}-fired-99`);
  assert.deepEqual(parseArtifactName(name), { seat: 'ronan-dgx', shaPrefix: SHA.slice(0, 12), fired: true, runId: '99' });
  assert.equal(parseArtifactName(`k6-baseline-proof-ronan-99`), null, 'proof artifacts are not baselines');
  assert.equal(artifactName({ seat: 'ronan', sha: '', fired: false, runId: 1 }), 'k6-baseline-ronan-nosha-nofire-1');
});

test('deploy-check fires once per seat for a deployed SHA with no baseline', () => {
  const artifacts = [
    { name: artifactName({ seat: 'ronan', sha: SHA, fired: false, runId: 1 }), expired: false },
    { name: artifactName({ seat: 'cael', sha: OLD.replace(/a/gu, '0'), fired: true, runId: 2 }), expired: false },
  ];
  assert.equal(deployCheck({ seat: 'ronan', sha: SHA, artifacts }).fire, false);
  assert.equal(deployCheck({ seat: 'cael', sha: SHA, artifacts }).fire, true);
  assert.equal(deployCheck({ seat: 'ronan', sha: SHA, artifacts: artifacts.map((a) => ({ ...a, expired: true })) }).fire, true);
  assert.equal(deployCheck({ seat: 'ronan', sha: 'main', artifacts }).fire, false);
});

test('watchdog: a seat without a fired baseline since the nightly is a missed fire', () => {
  const cron = '17 2 * * *';
  const now = new Date('2026-10-20T06:41:00Z');
  assert.equal(lastDailyOccurrence(cron, now).toISOString(), '2026-10-20T02:17:00.000Z');
  assert.equal(lastDailyOccurrence(cron, new Date('2026-10-20T01:00:00Z')).toISOString(), '2026-10-19T02:17:00.000Z');
  assert.throws(() => lastDailyOccurrence('*/5 * * * *', now));
  const artifacts = [
    { name: artifactName({ seat: 'ronan', sha: SHA, fired: true, runId: 5 }), created_at: '2026-10-20T03:05:00Z' },
    { name: artifactName({ seat: 'cael', sha: SHA, fired: false, runId: 5 }), created_at: '2026-10-20T02:30:00Z' },
    { name: artifactName({ seat: 'silas', sha: SHA, fired: true, runId: 4 }), created_at: '2026-10-19T03:00:00Z' },
  ];
  const result = watchdog({ seats: ['ronan', 'cael', 'silas', 'k6-missed-fire-probe'], artifacts, nightlyCron: cron, now, graceMinutes: 10 });
  assert.deepEqual(result.fired, ['ronan']);
  assert.deepEqual(result.missed, [
    { seat: 'cael', reason: 'ran-but-did-not-fire' },
    { seat: 'silas', reason: 'no-baseline-published' },
    { seat: 'k6-missed-fire-probe', reason: 'no-baseline-published' },
  ]);
  assert.equal(result.alert, true);
  assert.equal(watchdog({ seats: ['ronan'], artifacts, nightlyCron: cron, now }).alert, false);
  assert.equal(watchdog({ seats: [], artifacts, nightlyCron: cron, now }).alert, true, 'an unconfigured baseline is not silence');
});

test('rollup CLI folds a synthetic run root into public-safe outputs', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'k6-baseline-cli-'));
  try {
    const runRoot = path.join(dir, 'proof');
    const runDir = path.join(runRoot, SHA, 'R-CD-1', 'ronan', '20261020T021800Z-r-cd-1-abcd');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, 'run-result.json'), JSON.stringify({ verdict: 'PASS-candidate', endedAt: '2026-10-20T02:19:00Z', review: { pendingReceipts: ['tempo-trace-json'] } }));
    writeFileSync(path.join(runDir, 'runner-metadata.json'), JSON.stringify({ row: 'R-CD-1' }));
    const out = path.join(dir, 'baseline');
    const env = { ...process.env };
    delete env.GITHUB_OUTPUT;
    const res = spawnSync(process.execPath, [cli, 'rollup', '--run-root', runRoot, '--sha', SHA, '--seat', 'ronan',
      '--docs-ref', 'b'.repeat(40), '--trigger', 'nightly', '--run-url', 'https://example.invalid/r/7', '--run-id', '7',
      '--out', out, '--repo-root', repoRoot, '--blocked-at', ''], { encoding: 'utf8', env });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^fired=true$/mu);
    assert.match(res.stdout, new RegExp(`^artifact_name=k6-baseline-ronan-${SHA.slice(0, 12)}-fired-7$`, 'mu'));
    const written = JSON.parse(readFileSync(path.join(out, 'rollup.json'), 'utf8'));
    assert.equal(written.denominator, 34);
    assert.equal(written.counts.pass, 1);
    assert.equal(written.counts.missing, 33);
    assert.match(readFileSync(path.join(out, 'rollup.md'), 'utf8'), /Denominator \*\*34\*\* live-suite rows/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
