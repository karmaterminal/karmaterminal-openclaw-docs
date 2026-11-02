/**
 * proof-pipe-dry-run.test.mjs — docs#587.
 *
 * The scheduled proof pipe (tools/k6-proofs/docs/PROOF-PIPE-DESIGN.md) is built
 * as a dry-run skeleton only. These tests hold the runner to that:
 *
 * - dry_run=false is refused while the bugs-first hold is in effect, and the
 *   hold fails closed (a missing, malformed or unauthorized release is a hold);
 * - with the hold lifted, dry_run=false is still refused: the live leg is not
 *   built;
 * - a dry run validates its inputs, resolves rows only from
 *   proofs-manifest.json::dispatch_allocation at the exact docs SHA, refuses a
 *   consumed or possibly consumed row, refuses a rented runner, and prints the
 *   plan and the receipts it would collect;
 * - nothing fires: a tripwire on every binary that could reach a seat, a
 *   gateway, Temporal or GitHub stays untouched.
 *
 * Every fixture is a throwaway git repository, so the docs SHA the runner reads
 * is an exact commit and no test depends on the live corpus except the F′
 * real-data check, which reads it from this checkout's HEAD.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const script = path.join(repoRoot, 'tools/k6-proofs/scripts/proof-pipe-dry-run.mjs');

const CANDIDATE = '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d';
const PURE = '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432';
const F_PRIME = 'f15237ec921879d918482cdf372b0718d4c1aab9';

const HELD = {
  schema: 'openclaw.k6.proof-pipe-hold.v1',
  held: true,
  reason: 'bugs-first hold (fixture)',
  since: '2026-11-02',
  release: null,
};
const RELEASED = {
  schema: 'openclaw.k6.proof-pipe-hold.v1',
  held: false,
  reason: 'released (fixture)',
  since: '2026-11-02',
  release: { by: 'fixture reviewer', ref: 'https://example.invalid/go/1', at: '2026-11-03T00:00:00Z' },
};

function catalogManifest(rowId, overrides = {}) {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId,
    toolSurface: 'typed-tool',
    scenario: { name: rowId.toLowerCase(), status: 'runnable', file: `${rowId.toLowerCase()}.js` },
    liveRunSafety: {
      classification: 'k6-runnable',
      expectedArtifactClass: 'PASS-candidate',
      requiredReceipts: ['seat-readiness', 'dispatch-accepted'],
      foldRequiresReview: true,
    },
    expectedReceipts: [{ name: 'dispatch-accepted', required: true }],
    ...overrides,
  };
}

/** R-A fires continue_work (owes trace receipts); R-B is read-only; R-S static; R-F a fixture. */
function defaultCatalog() {
  return {
    'r-a.json': catalogManifest('R-A', {
      invocation: { tool: 'continue_work' },
      liveRunSafety: {
        classification: 'k6-runnable',
        expectedArtifactClass: 'PASS-candidate',
        requiredReceipts: ['seat-readiness', 'dispatch-accepted', 'tempo-trace-json', 'continuation-trace-correlation'],
        foldRequiresReview: true,
      },
      expectedReceipts: [
        { name: 'dispatch-accepted', required: true },
        { name: 'tempo-trace-json', required: true },
        { name: 'continuation-trace-correlation', required: true },
      ],
    }),
    'r-b.json': catalogManifest('R-B'),
    'r-s.json': catalogManifest('R-S', {
      scenario: { name: 'static-corpus-row-validator', status: 'runnable', file: 'static-corpus-row-validator.js' },
      liveRunSafety: { classification: 'static-preflight-only', expectedArtifactClass: 'PASS-candidate', requiredReceipts: [], foldRequiresReview: true },
    }),
    'r-f.json': catalogManifest('R-F', {
      invocation: { fixture: 'run-fixture.mjs' },
      liveRunSafety: { classification: 'orchestration-required', expectedArtifactClass: 'PARTIAL-candidate', requiredReceipts: [], foldRequiresReview: true },
    }),
  };
}

function corpusRow(row, extra = {}) {
  return { row, state: 'missing', fired: false, ...extra };
}

function defaultManifest(corpusSha = CANDIDATE) {
  return {
    schema: 'openclaw.proofs.manifest.v1',
    capture_sha: corpusSha,
    ship_sha: corpusSha,
    proof_source_sha: corpusSha,
    required_rows: ['R-A', 'R-B', 'R-S', 'R-F'],
    dispatch_allocation: {
      emeric: ['R-A', 'R-B'],
      'frond-scribe-static': ['R-S'],
      'frond-scribe-fixture': ['R-F'],
    },
    rows: ['R-A', 'R-B', 'R-S', 'R-F'].map((row) => corpusRow(row)),
  };
}

const temps = [];
test.after(async () => {
  await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function scratch(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function git(root, args, home) {
  const result = spawnSync('git', ['-C', root, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function writeTree(root, files) {
  for (const [rel, value] of Object.entries(files)) {
    const file = path.join(root, rel);
    if (value === null) {
      await rm(file, { force: true });
      continue;
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  }
}

/**
 * A docs repository with one commit, or two when `then` is given (the second
 * becomes HEAD; `docsSha` stays the first). Returns the root and both SHAs.
 */
async function fixtureRepo({
  hold = HELD,
  manifest = defaultManifest(),
  corpusSha = CANDIDATE,
  catalog = defaultCatalog(),
  extra = {},
  then,
} = {}) {
  const root = await scratch('proof-pipe-repo-');
  const home = await scratch('proof-pipe-home-');
  const files = { ...extra };
  for (const [name, value] of Object.entries(catalog)) files[`tools/k6-proofs/manifests/${name}`] = value;
  if (hold !== undefined) files['tools/k6-proofs/proof-pipe/hold.json'] = hold;
  if (manifest !== undefined) files[`PROOFS/${corpusSha}/proofs-manifest.json`] = manifest;
  await writeTree(root, files);
  git(root, ['init', '-q', '-b', 'main'], home);
  git(root, ['add', '-A'], home);
  git(root, ['commit', '-q', '-m', 'fixture'], home);
  const docsSha = git(root, ['rev-parse', 'HEAD'], home);
  let headSha = docsSha;
  if (then) {
    await writeTree(root, then);
    git(root, ['add', '-A'], home);
    git(root, ['commit', '-q', '-m', 'fixture head'], home);
    headSha = git(root, ['rev-parse', 'HEAD'], home);
  }
  return { root, docsSha, headSha };
}

const TRIPWIRES = ['k6', 'ssh', 'scp', 'systemctl', 'systemd-run', 'journalctl', 'curl', 'wget', 'gh', 'temporal', 'thornfield', 'docker', 'kubectl', 'nc', 'openclaw'];

async function tripwireBin() {
  const dir = await scratch('proof-pipe-tripwire-');
  const log = path.join(dir, 'tripped.log');
  for (const name of TRIPWIRES) {
    const file = path.join(dir, name);
    await writeFile(file, `#!/bin/sh\necho "${name} $*" >> "${log}"\nexit 97\n`);
    await chmod(file, 0o755);
  }
  return { dir, log };
}

let tripwire;
test.before(async () => {
  tripwire = await tripwireBin();
});

function run(root, args, env = {}) {
  const base = { ...process.env };
  delete base.PROOF_PIPE_HOLD;
  const result = spawnSync(process.execPath, [script, '--repo-root', root, ...args], {
    encoding: 'utf8',
    env: { ...base, PATH: `${tripwire.dir}${path.delimiter}${process.env.PATH}`, ...env },
  });
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = undefined;
  }
  return { ...result, json };
}

function assertNothingFired() {
  assert.equal(existsSync(tripwire.log), false, `a tripwire fired: ${existsSync(tripwire.log) ? '(see log)' : ''}`);
}

function baseArgs(docsSha, extra = []) {
  return ['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--json', ...extra];
}

// ── dry_run=false and the hold ──────────────────────────────────────────────

test('dry_run=false is refused while the hold flag is set', async () => {
  const { root, docsSha } = await fixtureRepo();
  const result = run(root, baseArgs(docsSha, ['--dry-run', 'false']));
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.json.refused, true);
  assert.equal(result.json.reason, 'held');
  assert.equal(result.json.dryRun, false);
  assert.equal(result.json.fired, 0);
  assert.equal(result.json.hold.held, true);
  assert.equal(result.json.stages, undefined, 'a refused live run plans nothing');
  assertNothingFired();
});

test('dry_run=false is refused with the hold lifted too: the live leg is not built', async () => {
  const { root, docsSha } = await fixtureRepo({ hold: RELEASED });
  const result = run(root, baseArgs(docsSha, ['--dry-run', 'false']));
  assert.equal(result.status, 4, result.stderr);
  assert.equal(result.json.refused, true);
  assert.equal(result.json.reason, 'live-leg-not-built');
  assert.equal(result.json.hold.held, false);
  assert.equal(result.json.fired, 0);
  assertNothingFired();
});

const FAIL_CLOSED_HOLDS = [
  ['a missing hold file', undefined],
  ['a hold file that is not JSON', '{ held: false'],
  ['a hold file with another schema', { ...RELEASED, schema: 'openclaw.k6.proof-pipe-hold.v0' }],
  ['held:false with no release authority', { ...RELEASED, release: null }],
  ['held:false with a blank release ref', { ...RELEASED, release: { ...RELEASED.release, ref: '  ' } }],
  ['held:"false" as a string', { ...RELEASED, held: 'false' }],
  ['a hold file that is an array', [RELEASED]],
];

for (const [label, hold] of FAIL_CLOSED_HOLDS) {
  test(`the hold fails closed: ${label} is a hold`, async () => {
    const { root, docsSha } = await fixtureRepo({ hold });
    const result = run(root, baseArgs(docsSha, ['--dry-run', 'false']));
    assert.equal(result.status, 3, result.stderr);
    assert.equal(result.json.reason, 'held');
    assertNothingFired();
  });
}

test('a release at HEAD does not lift a hold at the docs SHA', async () => {
  const { root, docsSha, headSha } = await fixtureRepo({ hold: HELD, then: { 'tools/k6-proofs/proof-pipe/hold.json': RELEASED } });
  assert.notEqual(docsSha, headSha);
  const result = run(root, baseArgs(docsSha, ['--dry-run', 'false']));
  assert.equal(result.status, 3, result.stderr);
  assert.deepEqual(result.json.hold.sources.map((s) => [s.ref, s.held]), [[headSha, false], [docsSha, true]]);
});

test('a release at the docs SHA does not lift a hold at HEAD', async () => {
  const { root, docsSha, headSha } = await fixtureRepo({ hold: RELEASED, then: { 'tools/k6-proofs/proof-pipe/hold.json': HELD } });
  const result = run(root, baseArgs(docsSha, ['--dry-run', 'false']));
  assert.equal(result.status, 3, result.stderr);
  assert.deepEqual(result.json.hold.sources.map((s) => [s.ref, s.held]), [[headSha, true], [docsSha, false]]);
});

test('PROOF_PIPE_HOLD adds a hold and can never lift one', async () => {
  const released = await fixtureRepo({ hold: RELEASED });
  const added = run(released.root, baseArgs(released.docsSha, ['--dry-run', 'false']), { PROOF_PIPE_HOLD: 'storm' });
  assert.equal(added.status, 3, added.stderr);
  assert.equal(added.json.hold.operatorHold, true);

  const held = await fixtureRepo({ hold: HELD });
  for (const value of ['false', '0', 'off', 'no', '']) {
    const kept = run(held.root, baseArgs(held.docsSha, ['--dry-run', 'false']), { PROOF_PIPE_HOLD: value });
    assert.equal(kept.status, 3, `PROOF_PIPE_HOLD=${JSON.stringify(value)} lifted the hold`);
  }
  assertNothingFired();
});

// ── the dry-run plan ────────────────────────────────────────────────────────

test('a dry run prints the plan and the receipts it would collect, and fires nothing', async () => {
  const { root, docsSha, headSha } = await fixtureRepo();
  const result = run(root, baseArgs(docsSha, ['--trigger', 'nightly', '--runner-labels', '["oc-4cpu-16gb"]']));
  assert.equal(result.status, 0, result.stderr);
  const plan = result.json;
  assert.equal(plan.schema, 'openclaw.k6.proof-pipe-plan.v1');
  assert.equal(plan.dryRun, true);
  assert.equal(plan.refused, false);
  assert.equal(plan.fired, 0);
  assert.deepEqual(plan.contacted, []);
  assert.deepEqual(Object.keys(plan.stages), ['trigger', 'handoff', 'collection', 'assembly', 'guards']);

  const { trigger, handoff, collection, assembly, guards } = plan.stages;
  assert.equal(trigger.kind, 'nightly');
  assert.equal(trigger.productSha, CANDIDATE);
  assert.equal(trigger.docsSha, docsSha);
  assert.equal(trigger.corpusSha, CANDIDATE);
  assert.equal(trigger.pipelineSha, headSha);
  assert.equal(trigger.manifest.path, `PROOFS/${CANDIDATE}/proofs-manifest.json`);
  assert.match(trigger.manifest.blob, /^[0-9a-f]{40}$/);
  assert.equal(trigger.label, `nightly-${docsSha.slice(0, 8)}`);

  const byRow = Object.fromEntries(trigger.rows.map((row) => [row.row, row]));
  assert.equal(byRow['R-A'].disposition, 'fire');
  assert.equal(byRow['R-A'].seat, 'emeric');
  assert.equal(byRow['R-B'].disposition, 'fire');
  assert.equal(byRow['R-S'].disposition, 'orchestrator-static');
  assert.equal(byRow['R-F'].disposition, 'not-run');
  assert.equal(byRow['R-F'].debt, 'owner-not-a-proof-seat (frond-scribe-fixture)');

  assert.equal(handoff.temporal.workflowType, 'proofRunWorkflow');
  assert.equal(handoff.temporal.taskQueue, 'thornfield-orchestrator');
  assert.equal(handoff.temporal.workflowId, `proofs/${CANDIDATE}/nightly-${docsSha.slice(0, 8)}`);
  assert.equal(handoff.temporal.workflowIdReusePolicy, 'REJECT_DUPLICATE');
  assert.deepEqual(handoff.seats.map((s) => [s.seat, s.taskQueue, s.rows]), [['emeric', 'thornfield-proof-emeric', ['R-A', 'R-B']]]);
  assert.equal(handoff.seats[0].go, 'required');
  assert.match(handoff.seats[0].launcher, /composite-launcher\.sh run /);
  assert.ok(handoff.seats[0].launcher.includes(`${CANDIDATE} ${CANDIDATE} ${docsSha} R-A,R-B`));
  assert.equal(handoff.seats[0].stageOnly.workflow, 'deploy-gateway.yml');
  assert.equal(handoff.seats[0].stageOnly.approvedRef, CANDIDATE);

  const receipts = Object.fromEntries(collection.rows.map((row) => [row.row, row]));
  assert.ok(receipts['R-A'].files.includes('tempo-trace-<trace-id>.json'));
  assert.ok(receipts['R-A'].files.includes('continuation-trace-correlation.json'));
  assert.ok(receipts['R-A'].files.includes('run-result.json'));
  assert.ok(receipts['R-A'].files.includes('evidence-redaction.json'));
  assert.ok(receipts['R-A'].files.includes('gateway-journal-redaction.json'));
  assert.ok(receipts['R-A'].manifestReceipts.includes('continuation-trace-correlation'));
  assert.equal(receipts['R-B'].files.includes('tempo-trace-<trace-id>.json'), false);
  assert.ok(collection.run.includes('harness-provenance.json'));
  assert.equal(collection.stagingRefs[0], `proof-runs-staging/proofs_${CANDIDATE}_nightly-${docsSha.slice(0, 8)}/emeric`);

  assert.equal(assembly.model, 'mai-code-2-flash');
  assert.equal(assembly.candidateOnly, true);
  assert.ok(assembly.forbidden.includes('PROOFS/INDEX.json'));
  assert.ok(assembly.forbidden.includes('PROOFS/**'));

  assert.equal(guards.hold.held, true, 'the plan reports the hold; a dry run is not blocked by it');
  assert.equal(guards.cost.ok, true);
  assert.equal(guards.noRefire.refused.length, 0);
  assert.equal(guards.exactSha.docsSha, docsSha);
  assertNothingFired();
});

test('the human plan names every stage and says nothing fired', async () => {
  const { root, docsSha } = await fixtureRepo();
  const result = run(root, ['--product-sha', CANDIDATE, '--docs-sha', docsSha]);
  assert.equal(result.status, 0, result.stderr);
  for (const heading of ['(a) trigger', '(b) hand-off', '(c) collection', '(d) assembly', '(e) guards']) {
    assert.ok(result.stdout.includes(heading), `missing ${heading}`);
  }
  assert.match(result.stdout, /DRY RUN: zero rows fired; no seat, gateway or Temporal contact/);
});

test('--out writes the plan receipt it printed', async () => {
  const { root, docsSha } = await fixtureRepo();
  const dir = await scratch('proof-pipe-out-');
  const out = path.join(dir, 'plan.json');
  const result = run(root, baseArgs(docsSha, ['--out', out]));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), result.json);
});

test('--pure binds the corpus to the pure SHA and the launcher to both', async () => {
  const { root, docsSha } = await fixtureRepo({ corpusSha: PURE, manifest: defaultManifest(PURE) });
  const result = run(root, baseArgs(docsSha, ['--corpus-sha', PURE]));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.stages.trigger.corpusSha, PURE);
  assert.ok(result.json.stages.handoff.seats[0].launcher.includes(`${PURE} ${CANDIDATE} ${docsSha}`));
  assert.ok(result.json.stages.handoff.thornfieldCli.includes(`--pure ${PURE}`));
});

test('--rows narrows the allocation; owner:<bucket> takes one bucket', async () => {
  const { root, docsSha } = await fixtureRepo();
  const one = run(root, baseArgs(docsSha, ['--rows', 'R-B']));
  assert.equal(one.status, 0, one.stderr);
  assert.deepEqual(one.json.stages.trigger.rows.map((r) => r.row), ['R-B']);
  const bucket = run(root, baseArgs(docsSha, ['--rows', 'owner:emeric']));
  assert.equal(bucket.status, 0, bucket.stderr);
  assert.deepEqual(bucket.json.stages.trigger.rows.map((r) => r.row), ['R-A', 'R-B']);
});

test('the supplemental bucket is not a firing bucket', async () => {
  const manifest = defaultManifest();
  manifest.dispatch_allocation.supplemental = ['R-X'];
  manifest.rows.push({ ...corpusRow('R-X'), supplemental: true });
  const { root, docsSha } = await fixtureRepo({ manifest });
  const all = run(root, baseArgs(docsSha));
  assert.equal(all.status, 0, all.stderr);
  assert.equal(all.json.stages.trigger.rows.some((r) => r.row === 'R-X'), false);
  const asked = run(root, baseArgs(docsSha, ['--rows', 'R-X']));
  assert.equal(asked.status, 2);
  assert.match(asked.json.problem, /outside required_rows: R-X/);
});

// ── input refusals ──────────────────────────────────────────────────────────

test('malformed inputs are refused before anything is read', async () => {
  const { root, docsSha } = await fixtureRepo();
  const cases = [
    [['--product-sha', CANDIDATE.toUpperCase(), '--docs-sha', docsSha], /product-sha must be a 40-character lowercase hex SHA/],
    [['--product-sha', CANDIDATE.slice(0, 12), '--docs-sha', docsSha], /product-sha/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha.slice(0, 39)], /docs-sha/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--corpus-sha', 'main'], /corpus-sha/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--rows', 'R-A,../x'], /unsafe row name/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--trigger', 'hourly'], /trigger must be one of manual, nightly, on-deploy/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--label', 'Not A Slug'], /label must be a lowercase slug/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--dry-run', 'yes'], /dry-run must be exactly true or false/],
    [['--product-sha', CANDIDATE, '--docs-sha', docsSha, '--proof-seats', 'emeric,frond-scribe-static'], /static owner, never a proof seat/],
    [['--docs-sha', docsSha], /product-sha is required/],
  ];
  for (const [args, problem] of cases) {
    const result = run(root, [...args, '--json']);
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
    assert.equal(result.json.refused, true);
    assert.match(result.json.problem, problem);
  }
  assertNothingFired();
});

test('a docs SHA that is not a commit here is refused; the runner never fetches', async () => {
  const { root } = await fixtureRepo();
  const result = run(root, baseArgs('0123456789abcdef0123456789abcdef01234567'));
  assert.equal(result.status, 2);
  assert.match(result.json.problem, /docs-sha 0123456789abcdef0123456789abcdef01234567 is not a commit in this repository/);
  assertNothingFired();
});

// ── allocation refusals ─────────────────────────────────────────────────────

test('row authority is proofs-manifest.json::dispatch_allocation; a bad allocation refuses', async () => {
  const twice = defaultManifest();
  twice.dispatch_allocation['frond-scribe-static'].push('R-A');
  const unallocated = defaultManifest();
  unallocated.dispatch_allocation.emeric = ['R-A'];
  const unknown = defaultManifest();
  unknown.dispatch_allocation.emeric.push('R-Z');
  const noAllocation = defaultManifest();
  delete noAllocation.dispatch_allocation;
  const badShape = defaultManifest();
  badShape.dispatch_allocation = { emeric: 'R-A' };
  const otherCorpus = defaultManifest();
  otherCorpus.capture_sha = PURE;
  const cases = [
    [twice, /row allocated twice: R-A/],
    [unallocated, /row allocated to no owner: R-B/],
    [unknown, /unknown row allocated: R-Z/],
    [noAllocation, /dispatch_allocation is missing/],
    [badShape, /dispatch_allocation has an invalid shape/],
    [otherCorpus, new RegExp(`capture_sha ${PURE} is not the corpus SHA ${CANDIDATE}`)],
  ];
  for (const [manifest, problem] of cases) {
    const { root, docsSha } = await fixtureRepo({ manifest });
    const result = run(root, baseArgs(docsSha));
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.json.problem, problem);
  }
});

test('a missing manifest at the docs SHA refuses', async () => {
  const { root, docsSha } = await fixtureRepo({ manifest: undefined });
  const result = run(root, baseArgs(docsSha));
  assert.equal(result.status, 2);
  assert.match(result.json.problem, new RegExp(`no PROOFS/${CANDIDATE}/proofs-manifest.json at docs ${docsSha}`));
});

test('the array allocation form ({row, owner}) resolves the same rows', async () => {
  const manifest = defaultManifest();
  manifest.dispatch_allocation = [
    { row: 'R-A', owner: 'emeric', status: 'planned' },
    { row: 'R-B', owner: 'emeric', status: 'planned' },
    { row: 'R-S', owner: 'frond-scribe-static' },
    { row: 'R-F', owner: 'frond-scribe-fixture' },
  ];
  const { root, docsSha } = await fixtureRepo({ manifest });
  const result = run(root, baseArgs(docsSha));
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(result.json.stages.handoff.seats[0].rows, ['R-A', 'R-B']);
});

// ── no refire ───────────────────────────────────────────────────────────────

test('a consumed or possibly consumed row is refused, and the whole trigger with it', async () => {
  const cases = [
    [{ fired: true }, /R-A: consumed \(fired: true[;)]/],
    [{ test_cases_executed: ['20261030T012952Z-r-a-44aa4c89'] }, /R-A: consumed \(test_cases_executed/],
    [{ possibly_consumed: true }, /R-A: possibly consumed \(possibly_consumed: true\)/],
    [{ fired: undefined }, /R-A: possibly consumed \(fired is not false/],
    [{ state: 'pass' }, /R-A: consumed \(state pass[;)]/],
  ];
  for (const [extra, reason] of cases) {
    const manifest = defaultManifest();
    manifest.rows[0] = { ...manifest.rows[0], ...extra };
    if (extra.fired === undefined && 'fired' in extra) delete manifest.rows[0].fired;
    const { root, docsSha } = await fixtureRepo({ manifest });
    const result = run(root, baseArgs(docsSha));
    assert.equal(result.status, 2, result.stdout);
    assert.equal(result.json.refused, true);
    assert.match(result.json.problem, /consumed or possibly consumed/);
    assert.ok(result.json.stages.guards.noRefire.refused.some((r) => reason.test(r)), JSON.stringify(result.json.stages.guards.noRefire));
  }
  assertNothingFired();
});

test('a row missing from the corpus rows[] is possibly consumed', async () => {
  const manifest = defaultManifest();
  manifest.rows = manifest.rows.filter((row) => row.row !== 'R-B');
  const { root, docsSha } = await fixtureRepo({ manifest });
  const result = run(root, baseArgs(docsSha));
  assert.equal(result.status, 2);
  assert.ok(result.json.stages.guards.noRefire.refused.some((r) => /R-B: possibly consumed \(no rows\[\] entry\)/.test(r)));
});

test('a recorded refire names a consumed row', async () => {
  const manifest = defaultManifest();
  manifest.refires = [{ row: 'R-B', run: 'x', authorized_by: 'fixture' }];
  const { root, docsSha } = await fixtureRepo({ manifest });
  const result = run(root, baseArgs(docsSha));
  assert.equal(result.status, 2);
  assert.ok(result.json.stages.guards.noRefire.refused.some((r) => /R-B: consumed \(refires\[\][;)]/.test(r)));
});

test('a prior thornfield packet for the candidate or the corpus marks its rows consumed, unless not-run', async () => {
  const packetRow = (state) => ({ row: 'R-A', seat: 'emeric', state });
  const fired = await fixtureRepo({ extra: { [`PROOF-RUNS/${CANDIDATE}/20261101T020000Z-n1/R-A/row.json`]: packetRow('candidate:PASS-candidate') } });
  const firedResult = run(fired.root, baseArgs(fired.docsSha));
  assert.equal(firedResult.status, 2);
  assert.ok(firedResult.json.stages.guards.noRefire.refused.some((r) => /R-A: consumed \(PROOF-RUNS\/.*\/R-A\/row\.json state candidate:PASS-candidate\)/.test(r)));

  const possibly = await fixtureRepo({
    corpusSha: PURE,
    manifest: defaultManifest(PURE),
    extra: { [`PROOF-RUNS/${PURE}/20261101T020000Z-n1/R-A/row.json`]: packetRow('possibly-consumed') },
  });
  const possiblyResult = run(possibly.root, baseArgs(possibly.docsSha, ['--corpus-sha', PURE]));
  assert.equal(possiblyResult.status, 2);
  assert.ok(possiblyResult.json.stages.guards.noRefire.refused.some((r) => /R-A: possibly consumed \(PROOF-RUNS\/.*state possibly-consumed\)/.test(r)));

  const notRun = await fixtureRepo({ extra: { [`PROOF-RUNS/${CANDIDATE}/20261101T020000Z-n1/R-A/row.json`]: packetRow('not-run') } });
  const notRunResult = run(notRun.root, baseArgs(notRun.docsSha));
  assert.equal(notRunResult.status, 0, notRunResult.stdout);
  assert.deepEqual(notRunResult.json.stages.guards.noRefire.packetsRead, [`PROOF-RUNS/${CANDIDATE}/20261101T020000Z-n1/R-A/row.json`]);
});

test('F′ at this checkout: every emeric row has fired, so the pipe refuses to refire any of them', () => {
  const head = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const result = run(repoRoot, ['--product-sha', F_PRIME, '--docs-sha', head, '--rows', 'owner:emeric', '--json']);
  assert.equal(result.status, 2, result.stdout);
  const refused = result.json.stages.guards.noRefire.refused;
  assert.equal(refused.length, 27);
  // missing is not unfired: R-CD-3 folded missing after its fire.
  assert.ok(refused.some((r) => /^R-CD-3: consumed \(fired: true[;)]/.test(r)));
  assertNothingFired();
});

// ── what a seat may fire, and the cost guard ────────────────────────────────

test('a seat row that run-proofs.sh would not fire live is refused', async () => {
  const manifest = defaultManifest();
  manifest.dispatch_allocation = { emeric: ['R-A', 'R-B', 'R-F'], 'frond-scribe-static': ['R-S'] };
  const { root, docsSha } = await fixtureRepo({ manifest });
  const result = run(root, baseArgs(docsSha));
  assert.equal(result.status, 2);
  assert.match(result.json.problem, /R-F: not k6-runnable \(orchestration-required\)/);
});

test('a seat row with no catalog manifest at the docs SHA is refused', async () => {
  const catalog = defaultCatalog();
  delete catalog['r-b.json'];
  const { root, docsSha } = await fixtureRepo({ catalog });
  const result = run(root, baseArgs(docsSha));
  assert.equal(result.status, 2);
  assert.match(result.json.problem, /R-B: no catalog manifest at docs/);
});

test('a trigger with nothing to fire is refused: a run that does not fire is a failure', async () => {
  const { root, docsSha } = await fixtureRepo();
  const result = run(root, baseArgs(docsSha, ['--rows', 'R-S,R-F']));
  assert.equal(result.status, 2);
  assert.match(result.json.problem, /no row to fire/);
});

test('the cost guard refuses a rented runner and admits ARC and self-hosted', async () => {
  const { root, docsSha } = await fixtureRepo();
  const refused = [
    '["ubuntu-latest"]',
    '["ubuntu-24.04"]',
    '["self-hosted","ubuntu-latest"]',
    '["windows-latest"]',
    '["macos-14"]',
    '["blacksmith-4vcpu-ubuntu-2404"]',
    '["linux"]',
    '[]',
    'not json',
    '"ubuntu-latest"',
  ];
  for (const labels of refused) {
    const result = run(root, baseArgs(docsSha, ['--runner-labels', labels]));
    assert.equal(result.status, 2, `${labels} was admitted`);
    assert.match(result.json.problem, /cost guard/);
  }
  for (const labels of ['["oc-4cpu-16gb"]', '"oc-8cpu-32gb"', '["self-hosted","emeric"]']) {
    const result = run(root, baseArgs(docsSha, ['--runner-labels', labels]));
    assert.equal(result.status, 0, `${labels}: ${result.stdout}`);
    assert.equal(result.json.stages.guards.cost.ok, true);
  }
});
