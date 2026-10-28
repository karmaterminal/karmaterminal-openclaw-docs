import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  MAX_NOFIRE_ATTEMPTS,
  NON_DISCRIMINATING_PASS_EPOCHS,
  ROLLUP_SCHEMA,
  artifactName,
  buildRollup,
  corpusObservations,
  deployCheck,
  historyObservations,
  lastDailyOccurrence,
  parseArtifactName,
  parseCorpusDate,
  renderAlert,
  renderRollupMarkdown,
  selectPreviousBaseline,
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
    corpus: corpusObservations([]),
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

test('the last same-row PASS survives consecutive partial baselines', () => {
  const prior = {
    schema: ROLLUP_SCHEMA, fired: true, sha: SHA, trigger: 'nightly',
    generatedAt: '2026-10-19T03:00:00Z', runUrl: 'u',
    rows: [{ row: 'R-CD-1', cls: 'partial', lastPass: {
      sha: OLD, at: '2026-09-20T00:00:00Z', source: 'corpus',
      carried: true, fireType: 'carried', ref: `PROOFS/${OLD}/proofs-manifest.json`,
    } }],
  };
  const result = rollup({
    history: historyObservations([prior]),
    results: [{ row: 'R-CD-1', verdict: 'PARTIAL-candidate', endedAt: '2026-10-20T02:30:00Z' }],
  });
  assert.equal(result.rows[0].previous.cls, 'partial');
  assert.equal(result.rows[0].lastPass.sha, OLD);
  assert.equal(result.rows[0].lastPass.carried, true);
  assert.equal(result.rows[0].lastPass.provenance, 'carried');
});

test('corpus dates are read the same way on every runner, or not at all', () => {
  // Date.parse() resolves "2026-09-20 (re-fired)" through V8's legacy path in
  // the runner's local zone, so two machines could order the same corpus
  // differently. Only these two shapes are accepted.
  assert.deepEqual(parseCorpusDate('2026-09-20T04:30:00Z'), { at: '2026-09-20T04:30:00.000Z', precision: 'instant', reason: null });
  assert.deepEqual(parseCorpusDate('2026-09-20T04:30:00.250+02:00'), { at: '2026-09-20T02:30:00.250Z', precision: 'instant', reason: null });
  assert.deepEqual(parseCorpusDate('2026-09-20 04:30:00Z'), { at: '2026-09-20T04:30:00.000Z', precision: 'instant', reason: null });
  // A bare day is pinned to UTC midnight, so it loses to any instant that day.
  assert.deepEqual(parseCorpusDate('2026-09-20'), { at: '2026-09-20T00:00:00.000Z', precision: 'day', reason: null });
  assert.deepEqual(parseCorpusDate('2026-09-20 (re-fired from x)'), { at: '2026-09-20T00:00:00.000Z', precision: 'day', reason: null });
  assert.deepEqual(parseCorpusDate('  2026-09-20  '), { at: '2026-09-20T00:00:00.000Z', precision: 'day', reason: null });
  for (const value of [undefined, null, '', '   ', 42, {}]) {
    assert.deepEqual(parseCorpusDate(value), { at: null, precision: null, reason: 'generated-absent' }, JSON.stringify(value));
  }
  for (const value of ['Sep 20 2026', '2026-09-20T04:30:00', '2026-09-20 04:30:00', '20/09/2026', '2026-13-45']) {
    assert.deepEqual(parseCorpusDate(value), { at: null, precision: null, reason: 'generated-unparseable' }, value);
  }
  // A local-time instant is refused rather than silently read as local.
  assert.equal(parseCorpusDate('2026-09-20T04:30:00').at, null);
});

test('the rollup says which corpora it weighed and which it skipped, and why', () => {
  const corpus = corpusObservations([
    { sha: 'a'.repeat(40), manifest: { generated: '2026-09-20T00:00:00Z', rows: [{ row: 'R-CD-1', state: 'pass' }] } },
    { sha: 'b'.repeat(40), manifest: { rows: [{ row: 'R-CD-1', state: 'pass' }] } },
    { sha: 'c'.repeat(40), manifest: { generated: 'Sep 20 2026', rows: [{ row: 'R-CD-1', state: 'pass' }] } },
    { sha: 'd'.repeat(40), manifest: { generated: '2026-09-21', rows: {} } },
    { sha: 'e'.repeat(40), manifest: { generated: '2026-09-22', rows: [{ row: 'R-CD-1', state: 'in-flight' }, { state: 'pass' }] } },
  ]);
  assert.deepEqual(corpus.included, [{ sha: 'a'.repeat(40), at: '2026-09-20T00:00:00.000Z', precision: 'instant', rows: 1 }]);
  assert.deepEqual(corpus.skipped, [
    { sha: 'b'.repeat(40), reason: 'generated-absent' },
    { sha: 'c'.repeat(40), reason: 'generated-unparseable' },
    { sha: 'd'.repeat(40), reason: 'rows-not-a-list' },
    { sha: 'e'.repeat(40), reason: 'no-row-states' },
  ]);
  const result = rollup({ corpus, results: [{ row: 'R-CD-1', verdict: 'PASS-candidate', endedAt: '1' }] });
  assert.deepEqual(result.corpusProvenance, { included: 1, rows: 1, skipped: corpus.skipped });
  const markdown = renderRollupMarkdown(result);
  assert.match(markdown, /History weighed 1 PROOFS corpora \(1 row observations\); \*\*4 skipped\*\*/u);
  assert.match(markdown, /generated-absent/u);
  // A corpus with no `fire_type` is "provenance unknown", never "fresh".
  assert.equal(result.rows.find((r) => r.row === 'R-CD-1').lastPass.provenance, 'unknown');
  assert.match(markdown, /provenance unknown/u);
});

test('a documented non-discriminating PASS is kept as history but cannot anchor a 2.x regression claim', () => {
  const row = 'R-CW-DELEGATE-SELF-CONTINUATION';
  const epoch = NON_DISCRIMINATING_PASS_EPOCHS[row];
  assert.ok(epoch, 'the epoch is declared for exactly this row');
  const live = { live: [row], orchestrationOnly: [], constructOnly: [] };
  const old = corpusObservations([
    { sha: OLD, manifest: { generated: '2026-08-25T00:00:00Z', fire_type: 'fresh-fire', rows: [{ row, state: 'pass' }] } },
  ]);
  const stale = rollup({
    catalog: live,
    corpus: old,
    results: [{ row, verdict: 'PARTIAL-candidate', endedAt: '1' }],
  });
  const entry = stale.rows[0];
  assert.deepEqual(stale.regressions, [], 'a pre-#570 PASS cannot make this a regression');
  assert.equal(entry.anchor, null, 'there is no observation that could anchor the claim');
  assert.equal(entry.previous.nonDiscriminating, true, 'but the PASS is still shown as history');
  assert.equal(entry.lastPass.sha, OLD);
  assert.equal(entry.lastPass.nonDiscriminating, true);
  assert.equal(entry.lastPass.nonDiscriminatingReason, epoch.reason);
  const markdown = renderRollupMarkdown(stale);
  assert.match(markdown, /no discriminating anchor/u);
  assert.match(markdown, new RegExp(`non-discriminating: ${epoch.reason}`, 'u'));
  assert.deepEqual(stale.nonDiscriminatingEpochs[row], { ...epoch });

  // A PASS from after the epoch anchors normally.
  const fresh = rollup({
    catalog: live,
    corpus: corpusObservations([
      { sha: 'f'.repeat(40), manifest: { generated: '2026-10-06T00:00:00Z', fire_type: 'fresh-fire', rows: [{ row, state: 'pass' }] } },
    ]),
    results: [{ row, verdict: 'PARTIAL-candidate', endedAt: '1' }],
  });
  assert.deepEqual(fresh.regressions, [row]);
  assert.equal(fresh.rows[0].anchor.nonDiscriminating, false);
  assert.equal(fresh.rows[0].lastPass.nonDiscriminating, false);
  // Only this row is treated this way: the epoch is one documented row, not a
  // blanket re-reading of the corpus.
  assert.deepEqual(Object.keys(NON_DISCRIMINATING_PASS_EPOCHS), [row]);
});

test('the non-discriminating epoch still matches what the row manifest documents', () => {
  // The constant is a copy of a claim the manifest owns; if the manifest's
  // note were removed or rewritten, the constant must be revisited, not kept.
  const epoch = NON_DISCRIMINATING_PASS_EPOCHS['R-CW-DELEGATE-SELF-CONTINUATION'];
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, epoch.ref), 'utf8'));
  assert.equal(manifest.rowId, 'R-CW-DELEGATE-SELF-CONTINUATION');
  assert.match(manifest.liveRunSafety.notes, /Retained PASS receipts from before #570 .* are historically non-discriminating/u);
  assert.match(manifest.liveRunSafety.notes, /parent-stream substring checks could be satisfied by the parent's own continue_delegate task text/u);
  assert.match(manifest.liveRunSafety.notes, /not re-classified as FAIL/u);
  // `before` is the #570 merge commit's own commit date, in UTC.
  const merged = spawnSync('git', ['show', '-s', '--format=%cI', '57478ad454c7249e86dfee4dd1c1b344bcdeff40'], { cwd: repoRoot, encoding: 'utf8' });
  if (merged.status === 0 && merged.stdout.trim()) {
    assert.equal(new Date(merged.stdout.trim()).toISOString(), epoch.before, 'epoch is the #570 merge commit');
  }
});

test('a last-PASS gate that could not read its history is red, not green', () => {
  const fired = [{ row: 'R-CD-1', verdict: 'PASS-candidate', endedAt: '1' }];
  const complete = rollup({ results: fired, historyAvailability: { expectedName: 'k6-baseline-ronan-x', loaded: true, listing: 'success' } });
  assert.deepEqual([complete.historyComplete, complete.historyGaps, complete.alert], [true, [], false]);

  // The listing step is continue-on-error so a listing failure cannot cost the
  // nightly its fire — but the run must not then claim "no regression".
  const noListing = rollup({ results: fired, historyAvailability: { expectedName: '', loaded: false, listing: 'failure' } });
  assert.deepEqual(noListing.historyGaps, ['artifact-listing-failure']);
  assert.deepEqual([noListing.fired, noListing.historyComplete, noListing.alert], [true, false, false]);
  assert.match(renderRollupMarkdown(noListing), /Last-PASS history is incomplete/u);
  assert.match(renderRollupMarkdown(noListing), /HISTORY INCOMPLETE/u);

  // A previous baseline that was named but never arrived is the same gap.
  const notLoaded = rollup({ results: fired, historyAvailability: { expectedName: 'k6-baseline-ronan-abc-nightly-fired-5-r1', loaded: false, listing: 'success' } });
  assert.deepEqual(notLoaded.historyGaps, ['previous-baseline-not-loaded:k6-baseline-ronan-abc-nightly-fired-5-r1']);
  assert.equal(notLoaded.alert, false);
  assert.match(renderRollupMarkdown(notLoaded), /treat "no regression" as unknown, not as green/u);

  // A skipped listing step (an earlier step failed hard) is not success either.
  assert.deepEqual(rollup({ results: fired, historyAvailability: { expectedName: '', loaded: false, listing: 'skipped' } }).historyGaps, ['artifact-listing-skipped']);
  // A first-ever baseline for a seat has no previous artifact and no gap.
  assert.deepEqual(rollup({ results: fired, historyAvailability: { expectedName: '', loaded: false, listing: 'success' } }).historyGaps, []);
  // Both an unfired run and a regression keep their own alert text.
  const both = rollup({ historyAvailability: { expectedName: 'n', loaded: false, listing: 'failure' } });
  assert.match(renderAlert(both), /did not fire/u);
});

test('artifact names carry seat, SHA, fire status and run attempt, and round-trip', () => {
  const name = artifactName({ seat: 'ronan-dgx', sha: SHA, trigger: 'nightly', fired: true, runId: 99 });
  assert.equal(name, `k6-baseline-ronan-dgx-${SHA.slice(0, 12)}-nightly-fired-99-r1`);
  assert.deepEqual(parseArtifactName(name), { seat: 'ronan-dgx', shaPrefix: SHA.slice(0, 12), trigger: 'nightly', fired: true, runId: '99', runAttempt: '1' });
  assert.equal(parseArtifactName(`k6-baseline-proof-ronan-99`), null, 'proof artifacts are not baselines');
  assert.equal(parseArtifactName(`k6-baseline-proof-ronan-99-r2`), null, 'nor are re-run proof artifacts');
  assert.equal(artifactName({ seat: 'ronan', sha: '', trigger: 'deploy', fired: false, runId: 1 }), 'k6-baseline-ronan-nosha-deploy-nofire-1-r1');
  for (const bad of [{ runId: '' }, { runId: 'abc' }, { runId: undefined }, { runAttempt: '' }, { runAttempt: 'x' }, { runAttempt: null }]) {
    assert.throws(() => artifactName({ seat: 'ronan', sha: SHA, trigger: 'nightly', fired: true, runId: 1, ...bad }), JSON.stringify(bad));
  }
});

test('a re-run publishes its own artifact, and pre-attempt names still parse as attempt 1', () => {
  // upload-artifact@v4 refuses a name a previous attempt of the same run
  // published, so attempt 2 must not collide with attempt 1.
  const first = artifactName({ seat: 'ronan', sha: SHA, trigger: 'nightly', fired: false, runId: 7, runAttempt: 1 });
  const second = artifactName({ seat: 'ronan', sha: SHA, trigger: 'nightly', fired: true, runId: 7, runAttempt: 2 });
  assert.notEqual(first, second);
  assert.equal(parseArtifactName(second).runAttempt, '2');
  // Names published before the attempt suffix existed must stay readable by
  // the watchdog and the deploy-check.
  const legacy = `k6-baseline-ronan-${SHA.slice(0, 12)}-nightly-fired-7`;
  assert.deepEqual(parseArtifactName(legacy), { seat: 'ronan', shaPrefix: SHA.slice(0, 12), trigger: 'nightly', fired: true, runId: '7', runAttempt: '1' });
  const now = new Date('2026-10-20T06:41:00Z');
  const watched = watchdog({
    seats: ['ronan'],
    artifacts: [{ name: legacy, created_at: '2026-10-20T03:00:00Z' }],
    nightlyCron: '17 2 * * *',
    now,
  });
  assert.deepEqual([watched.fired, watched.alert], [['ronan'], false], 'the attempt suffix does not break the watchdog');
  assert.equal(deployCheck({ seat: 'ronan', sha: SHA, artifacts: [{ name: legacy, expired: false }] }).fire, false);
});

test('deploy-check retries a seat that did not fire, then goes quiet for the nightly', () => {
  const nofire = (runAttempt) => ({ name: artifactName({ seat: 'ronan', sha: SHA, trigger: 'deploy', fired: false, runId: runAttempt, runAttempt }), expired: false });
  const fired = { name: artifactName({ seat: 'ronan', sha: SHA, trigger: 'nightly', fired: true, runId: 9 }), expired: false };
  const other = { name: artifactName({ seat: 'cael', sha: OLD.replace(/a/gu, '0'), trigger: 'nightly', fired: true, runId: 2 }), expired: false };

  // Nothing attempted for this SHA on this seat: fire.
  assert.deepEqual(deployCheck({ seat: 'cael', sha: SHA, artifacts: [other] }), { fire: true, reason: 'deployed-sha-not-yet-proved', attempts: 0, noFireAttempts: 0 });
  // An attempt that did not fire proved nothing, so the next poll retries it.
  assert.deepEqual(deployCheck({ seat: 'ronan', sha: SHA, artifacts: [nofire(1), other] }), { fire: true, reason: 'retry-after-nofire:1', attempts: 1, noFireAttempts: 1 });
  assert.deepEqual(deployCheck({ seat: 'ronan', sha: SHA, artifacts: [nofire(1), nofire(2)] }), { fire: true, reason: 'retry-after-nofire:2', attempts: 2, noFireAttempts: 2 });
  // A seat that is simply broken must not alert every 30 minutes forever.
  const exhausted = deployCheck({ seat: 'ronan', sha: SHA, artifacts: [nofire(1), nofire(2), nofire(3)] });
  assert.deepEqual(exhausted, { fire: false, reason: 'nofire-attempts-exhausted:3', attempts: 3, noFireAttempts: 3 });
  assert.equal(MAX_NOFIRE_ATTEMPTS, 3);
  assert.equal(deployCheck({ seat: 'ronan', sha: SHA, artifacts: [nofire(1)], maxNoFireAttempts: 1 }).fire, false);
  // A fired baseline for this SHA ends the polling whatever came before it.
  assert.deepEqual(deployCheck({ seat: 'ronan', sha: SHA, artifacts: [nofire(1), nofire(2), nofire(3), fired] }), { fire: false, reason: 'already-fired-for-deployed-sha', attempts: 4, noFireAttempts: 3 });
  // Expired artifacts are no longer evidence; an unnameable SHA is not polled.
  assert.equal(deployCheck({ seat: 'ronan', sha: SHA, artifacts: [nofire(1), nofire(2), nofire(3)].map((a) => ({ ...a, expired: true })) }).fire, true);
  assert.deepEqual(deployCheck({ seat: 'ronan', sha: 'main', artifacts: [] }), { fire: false, reason: 'deployed-sha-invalid', attempts: 0, noFireAttempts: 0 });
});

test('a seat never inherits another seat whose name it prefixes', () => {
  // `cael` is a string prefix of `cael-dgx`: a prefix match would hand cael
  // cael-dgx's last-PASS lineage, and call a regression on the wrong machine.
  const artifacts = [
    { name: artifactName({ seat: 'cael-dgx', sha: SHA, trigger: 'nightly', fired: true, runId: 10 }), expired: false, created_at: '2026-10-20T03:00:00Z', run_id: 10 },
    { name: artifactName({ seat: 'cael', sha: OLD, trigger: 'nightly', fired: true, runId: 8 }), expired: false, created_at: '2026-10-18T03:00:00Z', run_id: 8 },
    { name: artifactName({ seat: 'cael', sha: SHA, trigger: 'deploy', fired: false, runId: 11 }), expired: false, created_at: '2026-10-20T04:00:00Z', run_id: 11 },
    { name: artifactName({ seat: 'cael', sha: SHA, trigger: 'nightly', fired: true, runId: 12 }), expired: true, created_at: '2026-10-20T05:00:00Z', run_id: 12 },
    { name: 'k6-baseline-proof-cael-77-r1', expired: false, created_at: '2026-10-20T06:00:00Z', run_id: 77 },
  ];
  assert.equal(selectPreviousBaseline({ artifacts, seat: 'cael' }).runId, 8, 'exact seat, fired, unexpired');
  assert.equal(selectPreviousBaseline({ artifacts, seat: 'cael-dgx' }).runId, 10);
  assert.equal(selectPreviousBaseline({ artifacts, seat: 'cael', excludeRunId: 8 }), null, 'this run is never its own history');
  assert.equal(selectPreviousBaseline({ artifacts, seat: 'ronan' }), null);
  assert.equal(selectPreviousBaseline({ artifacts: [], seat: 'cael' }), null);
  assert.equal(selectPreviousBaseline({ artifacts: undefined, seat: 'cael' }), null);
  const chosen = selectPreviousBaseline({ artifacts, seat: 'cael' });
  assert.deepEqual([chosen.name, chosen.createdAt], [artifacts[1].name, '2026-10-18T03:00:00Z']);
});

test('watchdog: a seat without a fired baseline since the nightly is a missed fire', () => {
  const cron = '17 2 * * *';
  const now = new Date('2026-10-20T06:41:00Z');
  assert.equal(lastDailyOccurrence(cron, now).toISOString(), '2026-10-20T02:17:00.000Z');
  assert.equal(lastDailyOccurrence(cron, new Date('2026-10-20T01:00:00Z')).toISOString(), '2026-10-19T02:17:00.000Z');
  assert.throws(() => lastDailyOccurrence('*/5 * * * *', now));
  const artifacts = [
    { name: artifactName({ seat: 'ronan', sha: SHA, trigger: 'nightly', fired: true, runId: 5 }), created_at: '2026-10-20T03:05:00Z' },
    { name: artifactName({ seat: 'cael', sha: SHA, trigger: 'nightly', fired: false, runId: 5 }), created_at: '2026-10-20T02:30:00Z' },
    { name: artifactName({ seat: 'silas', sha: SHA, trigger: 'nightly', fired: true, runId: 4 }), created_at: '2026-10-19T03:00:00Z' },
    { name: artifactName({ seat: 'cael', sha: SHA, trigger: 'deploy', fired: true, runId: 6 }), created_at: '2026-10-20T04:00:00Z' },
    { name: artifactName({ seat: 'k6-missed-fire-probe', sha: SHA, trigger: 'manual', fired: true, runId: 7 }), created_at: '2026-10-20T04:00:00Z' },
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
    const run = (extra = []) => spawnSync(process.execPath, [cli, 'rollup', '--run-root', runRoot, '--sha', SHA, '--seat', 'ronan',
      '--docs-ref', 'b'.repeat(40), '--trigger', 'nightly', '--run-url', 'https://example.invalid/r/7', '--run-id', '7',
      '--out', out, '--repo-root', repoRoot, '--blocked-at', '', ...extra], { encoding: 'utf8', env });
    const res = run(['--listing-status', 'success', '--history-expected', '']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^fired=true$/mu);
    assert.match(res.stdout, /^history_complete=true$/mu);
    assert.match(res.stdout, /^history_gaps=none$/mu);
    assert.match(res.stdout, new RegExp(`^artifact_name=k6-baseline-ronan-${SHA.slice(0, 12)}-nightly-fired-7-r1$`, 'mu'));
    const written = JSON.parse(readFileSync(path.join(out, 'rollup.json'), 'utf8'));
    assert.equal(written.denominator, 34);
    assert.equal(written.counts.pass, 1);
    assert.equal(written.counts.missing, 33);
    assert.match(readFileSync(path.join(out, 'rollup.md'), 'utf8'), /Denominator \*\*34\*\* live-suite rows/u);

    // A re-run publishes under its own name instead of colliding with attempt 1.
    assert.match(run(['--run-attempt', '3']).stdout, new RegExp(`^artifact_name=k6-baseline-ronan-${SHA.slice(0, 12)}-nightly-fired-7-r3$`, 'mu'));

    // A named previous baseline that never arrived is a red history gap, not
    // a #sprites alert: issue #587 reserves those for regressions/non-fires.
    const blind = run(['--listing-status', 'success', '--history-expected', 'k6-baseline-ronan-abc-nightly-fired-5-r1']);
    assert.equal(blind.status, 0, blind.stderr);
    assert.match(blind.stdout, /^history_complete=false$/mu);
    assert.match(blind.stdout, /^history_gaps=previous-baseline-not-loaded:k6-baseline-ronan-abc-nightly-fired-5-r1$/mu);
    // This synthetic corpus also has row regressions, so its alert remains
    // true for those rows—not for the separate history gap.
    assert.match(blind.stdout, /^alert=true$/mu);
    assert.match(readFileSync(path.join(out, 'rollup.md'), 'utf8'), /Last-PASS history is incomplete/u);

    // So is a listing step that failed or never ran.
    const unlisted = run(['--listing-status', 'failure']);
    assert.match(unlisted.stdout, /^history_gaps=artifact-listing-failure$/mu);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
