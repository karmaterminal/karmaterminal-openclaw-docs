import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// 🌊's ruling on docs#616 (review 5720773113 and his issue comment, Discord
// 1565925290008387728; openclaw-bootstrap#1727): a row verdict is the minimum of
// the fixture's verdict, the cap the row manifest declares and the preflight cap.
// R-CW-5/6 declare that cap in `verdictCap` (PARTIAL-candidate, process-local
// fixture); a passing R-CW-5A/6A preflight is necessary, not sufficient, and never
// lifts it. These tests pin the declaration, its schema, the catalog rule that
// keeps it in place, the shared cap rules, and the wording.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const manifestsDir = join(repoRoot, 'tools/k6-proofs/manifests');
const checker = join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const CAPPED_ROWS = [
  ['r-cw-5.json', 'R-CW-5', 'run-cost-cap-fixture.mjs', 'R-CW-5A'],
  ['r-cw-6.json', 'R-CW-6', 'run-max-chain-fixture.mjs', 'R-CW-6A'],
];
// Loaded per test, so a missing module fails only the tests that need it.
const lib = () => import('../../lib/row-verdict-cap.mjs');

async function manifest(file) {
  return JSON.parse(await readFile(join(manifestsDir, file), 'utf8'));
}

test('R-CW-5 and R-CW-6 declare a machine-readable PARTIAL-candidate cap for their process-local fixture', async () => {
  for (const [file, rowId, fixture, preflight] of CAPPED_ROWS) {
    const row = await manifest(file);
    assert.equal(row.rowId, rowId);
    assert.equal(row.transport, 'process-local');
    assert.deepEqual(
      { rowCap: row.verdictCap?.rowCap, artifactClass: row.verdictCap?.artifactClass, supersedingAuthorities: row.verdictCap?.supersedingAuthorities },
      { rowCap: 'PARTIAL-candidate', artifactClass: 'process-local-fixture', supersedingAuthorities: [] },
      file,
    );
    assert.match(row.verdictCap.ruling, /1565925290008387728/, file);
    assert.match(row.verdictCap.description, new RegExp(fixture.replaceAll('.', '\\.')), file);
    assert.match(row.verdictCap.description, /necessary, not sufficient/, file);
    assert.match(row.verdictCap.description, /superseding authority receipt from a different artifact class, adopted by an explicit method change/, file);
    // What a run of the row is expected to produce is the cap, not the fixture's behavioral PASS.
    assert.equal(row.liveRunSafety.expectedArtifactClass, 'PARTIAL-candidate', file);
    // The preflight keeps its own cap; the row cap is a separate declaration.
    assert.equal(row.requiredPreflights[0].rowId, preflight, file);
    assert.equal(row.requiredPreflights[0].capOnMissingOrFailed, 'PARTIAL-candidate', file);
    assert.match(row.requiredPreflights[0].description, /necessary, not sufficient/, file);
    assert.match(row.telemetryContract.verdictAuthority.pass, /necessary, not sufficient/, file);
    assert.match(row.telemetryContract.verdictAuthority.partial, /PARTIAL-candidate/, file);
    assert.match(row.review.notes, /necessary, not sufficient/, file);
  }
});

test('only the process-local rows declare a verdict cap today', async () => {
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json')).sort();
  const declared = [];
  for (const file of files) {
    const row = await manifest(file);
    if (Object.prototype.hasOwnProperty.call(row, 'verdictCap')) declared.push(row.rowId);
    if (row.transport === 'process-local') assert.ok(row.verdictCap, `${file} is process-local without a verdictCap`);
  }
  assert.deepEqual(declared, ['R-CW-5', 'R-CW-6']);
});

test('the row-manifest schema declares verdictCap with its fixed cap and no adopted superseding authority', async () => {
  const schema = JSON.parse(await readFile(join(repoRoot, 'tools/k6-proofs/row-manifest.schema.json'), 'utf8'));
  const cap = schema.properties.verdictCap;
  assert.ok(cap, 'no verdictCap in the schema');
  assert.equal(cap.type, 'object');
  assert.equal(cap.additionalProperties, false);
  assert.deepEqual(cap.required, ['rowCap', 'artifactClass', 'supersedingAuthorities', 'ruling']);
  assert.equal(cap.properties.rowCap.const, 'PARTIAL-candidate');
  assert.equal(cap.properties.supersedingAuthorities.type, 'array');
  assert.equal(cap.properties.supersedingAuthorities.maxItems, 0);
  assert.match(cap.description, /necessary, not sufficient/);
  assert.doesNotMatch(schema.properties.requiredPreflights.description, /before this row can be PASS/);
});

test('the repository catalog passes the verdict-cap rule', () => {
  const result = spawnSync(process.execPath, [checker], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Verdict cap rule failures: 0/);
});

function processLocal(overrides = {}) {
  return {
    rowId: 'R-LIVE',
    transport: 'process-local',
    liveRunSafety: { classification: 'orchestration-required', expectedArtifactClass: 'PARTIAL-candidate' },
    verdictCap: {
      rowCap: 'PARTIAL-candidate',
      artifactClass: 'process-local-fixture',
      supersedingAuthorities: [],
      ruling: 'test ruling',
      description: 'capped while its only producer is process-local',
    },
    ...overrides,
  };
}

async function runCatalog(manifests) {
  const root = await mkdtemp(join(tmpdir(), 'k6-row-verdict-cap-catalog-'));
  try {
    await mkdir(join(root, 'PROOFS', SHA, 'R-LIVE'), { recursive: true });
    await mkdir(join(root, 'tools/k6-proofs/manifests'), { recursive: true });
    await mkdir(join(root, 'tools/k6-proofs/scenarios'), { recursive: true });
    await writeFile(join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({ current_sha: SHA })}\n`);
    for (const [file, value] of Object.entries(manifests)) {
      await writeFile(join(root, 'tools/k6-proofs/manifests', file), `${JSON.stringify(value)}\n`);
    }
    return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('a process-local row with a well-formed cap passes the catalog', async () => {
  const result = await runCatalog({ 'r-live.json': processLocal() });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Verdict cap rule failures: 0/);
});

test('every malformed or missing verdict cap fails the catalog', async () => {
  const cap = (patch) => processLocal({ verdictCap: { ...processLocal().verdictCap, ...patch } });
  for (const [label, row, detail] of [
    ['process-local without a cap', processLocal({ verdictCap: undefined }), /r-live\.json: R-LIVE is process-local, so it must declare verdictCap \(rowCap PARTIAL-candidate\)/],
    ['not an object', processLocal({ verdictCap: 'PARTIAL-candidate' }), /r-live\.json: verdictCap must be an object/],
    ['a PASS cap', cap({ rowCap: 'PASS-candidate' }), /r-live\.json: verdictCap\.rowCap must be "PARTIAL-candidate"/],
    ['no cap value', cap({ rowCap: undefined }), /r-live\.json: verdictCap\.rowCap must be "PARTIAL-candidate"/],
    ['another artifact class', cap({ artifactClass: 'live-gateway' }), /r-live\.json: verdictCap\.artifactClass must be "process-local-fixture" for a process-local row/],
    ['an adopted authority', cap({ supersedingAuthorities: [{ id: 'live-gateway-fire' }] }), /r-live\.json: verdictCap\.supersedingAuthorities must be empty/],
    ['authorities absent', cap({ supersedingAuthorities: undefined }), /r-live\.json: verdictCap\.supersedingAuthorities must be empty/],
    ['no ruling', cap({ ruling: '' }), /r-live\.json: verdictCap\.ruling must name the ruling/],
    ['expected class above the cap', processLocal({ liveRunSafety: { classification: 'orchestration-required', expectedArtifactClass: 'PASS-candidate' } }),
      /r-live\.json: liveRunSafety\.expectedArtifactClass PASS-candidate is above verdictCap\.rowCap PARTIAL-candidate/],
    // Whether a row is process-local never hangs on one exact spelling.
    ['process-local spelled another way, no cap', processLocal({ transport: 'Process-Local', verdictCap: undefined }),
      /r-live\.json: R-LIVE is process-local, so it must declare verdictCap/],
    ['process_local, no cap', processLocal({ transport: 'process_local', verdictCap: undefined }),
      /r-live\.json: R-LIVE is process-local, so it must declare verdictCap/],
    ['an unknown transport', processLocal({ transport: 'carrier-pigeon' }),
      /r-live\.json: transport "carrier-pigeon" is not a known transport .*so whether R-LIVE is process-local cannot be decided/],
    ['a null transport', processLocal({ transport: null }),
      /r-live\.json: transport null is not a known transport/],
    ['a process-local fixture under another transport, no cap', processLocal({ transport: 'websocket', invocation: { fixture: 'tools/k6-proofs/scripts/x.mjs' }, verdictCap: undefined }),
      /r-live\.json: R-LIVE names a process-local fixture \(invocation\.fixture\), so it must declare verdictCap/],
    // The ruling names R-CW-5/6: their manifests must declare the cap however they are otherwise edited.
    ['R-CW-5 without a cap or a process-local marker', processLocal({ rowId: 'R-CW-5', transport: 'websocket', verdictCap: undefined }),
      /r-live\.json: R-CW-5 is capped by 🌊's ruling on docs#616, so it must declare verdictCap/],
    ['r-cw-6 spelled another way, without a cap', processLocal({ rowId: 'r-cw-6', transport: 'offline', verdictCap: undefined }),
      /r-live\.json: r-cw-6 is capped by 🌊's ruling on docs#616, so it must declare verdictCap/],
  ]) {
    const result = await runCatalog({ 'r-live.json': row });
    assert.notEqual(result.status, 0, `${label}: ${result.stdout}`);
    assert.match(result.stderr, detail, label);
    assert.doesNotMatch(result.stdout, /Verdict cap rule failures: 0/, label);
  }
});

// A runner's artifact class is declared in `invocation.artifactClass`, never
// inferred from the key that names the runner (docs#615 merging #616). The
// RETURN-COVENANT restart control restarts a real disposable gateway process, so
// its manifest names it under `invocation.control` as `disposable-real-process`
// and the row is not capped. A runner named with no class is read as a
// process-local fixture, as #616 reads `invocation.fixture`.
const COVENANT_MANIFEST = 'r-cd-return-covenant-authority.json';
const COVENANT_CONTROL = 'tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs';

function disposable({ invocation = {}, ...overrides } = {}) {
  return {
    rowId: 'R-LIVE',
    transport: 'websocket',
    liveRunSafety: { classification: 'orchestration-required', expectedArtifactClass: 'PASS-candidate' },
    invocation: { control: 'tools/k6-proofs/scripts/x.mjs', artifactClass: 'disposable-real-process', ...invocation },
    ...overrides,
  };
}

test('(a) the RETURN-COVENANT restart control is declared a disposable real process, so its row declares no cap and none is required', async () => {
  const { declaredRowCap, manifestVerdictCapFailures, verdictCapCatalog } = await lib();
  const row = await manifest(COVENANT_MANIFEST);
  assert.equal(row.rowId, 'R-CD-RETURN-COVENANT-AUTHORITY');
  assert.equal(row.transport, 'websocket');
  assert.equal(row.invocation.artifactClass, 'disposable-real-process');
  assert.equal(row.invocation.control, COVENANT_CONTROL);
  assert.equal(Object.prototype.hasOwnProperty.call(row.invocation, 'fixture'), false, 'the control is not named as a process-local fixture');
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'verdictCap'), false);
  assert.deepEqual(manifestVerdictCapFailures(row), []);
  assert.equal(declaredRowCap(row), null);
  // What a run is expected to produce stays the PASS the supervised cases can earn.
  assert.equal(row.liveRunSafety.expectedArtifactClass, 'PASS-candidate');

  // (b) Across the whole catalog, exactly R-CW-5 and R-CW-6 are capped, both as process-local fixtures.
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json')).sort();
  const entries = await Promise.all(files.map(async (file) => ({ file, manifest: await manifest(file) })));
  const caps = verdictCapCatalog(entries);
  assert.deepEqual([...caps.keys()].sort(), ['R-CW-5', 'R-CW-6']);
  for (const cap of caps.values()) assert.equal(cap.artifactClass, 'process-local-fixture');
});

test('a disposable real-process row with its control passes the catalog uncapped; a declared process-local fixture passes with its cap', async () => {
  const uncapped = await runCatalog({ 'r-live.json': disposable() });
  assert.equal(uncapped.status, 0, uncapped.stderr || uncapped.stdout);
  assert.match(uncapped.stdout, /Verdict cap rule failures: 0/);
  // A disposable row a reviewer chooses to cap names its own class in the cap.
  const capped = await runCatalog({
    'r-live.json': disposable({
      liveRunSafety: { classification: 'orchestration-required', expectedArtifactClass: 'PARTIAL-candidate' },
      verdictCap: { ...processLocal().verdictCap, artifactClass: 'disposable-real-process' },
    }),
  });
  assert.equal(capped.status, 0, capped.stderr || capped.stdout);
  const declared = await runCatalog({ 'r-live.json': processLocal({ transport: 'websocket', invocation: { control: 'x.mjs', artifactClass: 'process-local-fixture' } }) });
  assert.equal(declared.status, 0, declared.stderr || declared.stdout);
});

test('an artifact class that is missing, unknown or contradicted by the row fails the catalog', async () => {
  for (const [label, row, detail] of [
    // (c) A runner named with no class fails closed exactly as before: it is a process-local fixture.
    ['invocation.fixture, no class, no cap', processLocal({ transport: 'websocket', invocation: { fixture: 'x.mjs' }, verdictCap: undefined }),
      /r-live\.json: R-LIVE names a process-local fixture \(invocation\.fixture\), so it must declare verdictCap \(rowCap PARTIAL-candidate\)/],
    ['invocation.fixture, no class, a cap of another class', processLocal({ transport: 'websocket', invocation: { fixture: 'x.mjs' }, verdictCap: { ...processLocal().verdictCap, artifactClass: 'disposable-real-process' } }),
      /r-live\.json: verdictCap\.artifactClass must be "process-local-fixture" for a process-local row/],
    ['invocation.control, no class, no cap', disposable({ invocation: { artifactClass: undefined } }),
      /r-live\.json: R-LIVE names a runner \(invocation\.control\) without invocation\.artifactClass, so it is read as a process-local fixture and must declare verdictCap \(rowCap PARTIAL-candidate\)/],
    ['a declared process-local fixture, no cap', disposable({ invocation: { artifactClass: 'process-local-fixture' } }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "process-local-fixture", so it must declare verdictCap \(rowCap PARTIAL-candidate\)/],
    // A class the rule does not know is refused, never read as "not process-local".
    ['an unknown class', disposable({ invocation: { artifactClass: 'real-process' } }),
      /r-live\.json: invocation\.artifactClass "real-process" is not a known artifact class \(process-local-fixture, disposable-real-process\), so whether R-LIVE is process-local cannot be decided/],
    ['the class spelled another way', disposable({ invocation: { artifactClass: 'Disposable-Real-Process' } }),
      /r-live\.json: invocation\.artifactClass "Disposable-Real-Process" is not a known artifact class/],
    ['a null class', disposable({ invocation: { artifactClass: null } }), /r-live\.json: invocation\.artifactClass null is not a known artifact class/],
    ['an unknown class beside invocation.fixture, with a cap', processLocal({ transport: 'websocket', invocation: { fixture: 'x.mjs', artifactClass: 'live-gateway' } }),
      /r-live\.json: invocation\.artifactClass "live-gateway" is not a known artifact class/],
    // (d) A disposable real process is refused wherever the row says process-local.
    ['disposable on a process-local transport', disposable({ transport: 'process-local' }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process", but its transport "process-local" is process-local/],
    ['disposable on Process-Local', disposable({ transport: 'Process-Local' }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process", but its transport "Process-Local" is process-local/],
    ['disposable on process_local, with a cap', disposable({ transport: 'process_local', verdictCap: processLocal().verdictCap }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process", but its transport "process_local" is process-local/],
    ['disposable with no transport', disposable({ transport: undefined }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process" but declares no transport, so whether it is process-local cannot be decided/],
    ['disposable beside invocation.fixture', disposable({ invocation: { fixture: 'x.mjs' } }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process" but names a process-local fixture \(invocation\.fixture\)/],
    ['disposable with its runner only under invocation.fixture', disposable({ invocation: { control: undefined, fixture: 'x.mjs' } }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process" but names a process-local fixture \(invocation\.fixture\)/],
    ['disposable without a control', disposable({ invocation: { control: undefined } }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process" without naming its runner in invocation\.control/],
    ['disposable with an empty control', disposable({ invocation: { control: '' } }),
      /r-live\.json: R-LIVE declares invocation\.artifactClass "disposable-real-process" without naming its runner in invocation\.control/],
    ['disposable with a cap of another class', disposable({ verdictCap: processLocal().verdictCap }),
      /r-live\.json: verdictCap\.artifactClass must be "disposable-real-process", the class invocation\.artifactClass declares, not "process-local-fixture"/],
    // (b) The ruling's rows stay process-local fixtures, however they are reclassified.
    ['R-CW-5 reclassified as disposable, uncapped', disposable({ rowId: 'R-CW-5' }),
      /r-live\.json: R-CW-5 is capped by 🌊's ruling on docs#616 as a process-local fixture, so it cannot declare invocation\.artifactClass "disposable-real-process"/],
    ['r-cw-6 reclassified as disposable, still capped', disposable({ rowId: 'r-cw-6', verdictCap: { ...processLocal().verdictCap, artifactClass: 'disposable-real-process' } }),
      /r-live\.json: r-cw-6 is capped by 🌊's ruling on docs#616 as a process-local fixture, so it cannot declare invocation\.artifactClass "disposable-real-process"/],
  ]) {
    const result = await runCatalog({ 'r-live.json': row });
    assert.notEqual(result.status, 0, `${label}: ${result.stdout}`);
    assert.match(result.stderr, detail, label);
    assert.doesNotMatch(result.stdout, /Verdict cap rule failures: 0/, label);
  }
});

test('(c, d) the covenant manifest in its pre-classification shape, or claiming a process-local transport, fails the catalog', async () => {
  const { manifestVerdictCapFailures } = await lib();
  const row = await manifest(COVENANT_MANIFEST);
  // #615 as it met #616: the control named as a fixture, no class.
  const { control, artifactClass, ...rest } = row.invocation;
  assert.equal(artifactClass, 'disposable-real-process');
  const asFixture = { ...row, invocation: { ...rest, fixture: control } };
  assert.match(
    manifestVerdictCapFailures(asFixture).join('\n'),
    /R-CD-RETURN-COVENANT-AUTHORITY names a process-local fixture \(invocation\.fixture\), so it must declare verdictCap/,
  );
  const classless = { ...row, invocation: { ...rest, control } };
  assert.match(manifestVerdictCapFailures(classless).join('\n'), /names a runner \(invocation\.control\) without invocation\.artifactClass/);
  const processLocalTransport = { ...row, transport: 'process-local' };
  assert.match(
    manifestVerdictCapFailures(processLocalTransport).join('\n'),
    /declares invocation\.artifactClass "disposable-real-process", but its transport "process-local" is process-local/,
  );
});

test('cap lib: only a verdict above the cap is lowered, and nothing is ever raised', async () => {
  const { capVerdict, ROW_VERDICT_CAP } = await lib();
  assert.equal(ROW_VERDICT_CAP, 'PARTIAL-candidate');
  assert.deepEqual(capVerdict('PASS-candidate', 'PARTIAL-candidate'), { verdict: 'PARTIAL-candidate', capped: true });
  for (const verdict of ['PARTIAL-candidate', 'FAIL-candidate', 'FAIL-fixture', 'HONEST-LIMIT-candidate', 'construct-only', '', undefined]) {
    assert.deepEqual(capVerdict(verdict, 'PARTIAL-candidate'), { verdict, capped: false }, String(verdict));
  }
  // A cap the rules do not know is refused, never read as "no cap".
  for (const unknown of ['PASS-candidate', 'FAIL-candidate', 'partial', undefined]) {
    assert.throws(() => capVerdict('PASS-candidate', unknown), /unsupported verdict cap/, String(unknown));
  }
});

test('cap lib: only a known state at or below the cap is within it; pass is above it, however it is written', async () => {
  const { corpusStateAboveCap, corpusStateWithinCap } = await lib();
  for (const state of ['pass', 'PASS', ' pass ']) {
    assert.equal(corpusStateAboveCap(state, 'PARTIAL-candidate'), true, JSON.stringify(state));
    assert.equal(corpusStateWithinCap(state, 'PARTIAL-candidate'), false, JSON.stringify(state));
  }
  for (const state of ['partial', 'thin', 'fail', 'honest_limit', 'missing', ' Partial ']) {
    assert.equal(corpusStateWithinCap(state, 'PARTIAL-candidate'), true, JSON.stringify(state));
    assert.equal(corpusStateAboveCap(state, 'PARTIAL-candidate'), false, JSON.stringify(state));
  }
  // Neither: not shown to lie within the cap, so the validator refuses them too.
  for (const state of ['passed', 'PASS-candidate', 'not-runnable', '', undefined, null]) {
    assert.equal(corpusStateWithinCap(state, 'PARTIAL-candidate'), false, JSON.stringify(state));
    assert.equal(corpusStateAboveCap(state, 'PARTIAL-candidate'), false, JSON.stringify(state));
  }
});

test('cap lib: the cap is read from the declaration, never inferred from prose', async () => {
  const { declaredRowCap, manifestVerdictCapFailures } = await lib();
  for (const [file] of CAPPED_ROWS) {
    const row = await manifest(file);
    assert.deepEqual(declaredRowCap(row), { verdict: 'PARTIAL-candidate', artifactClass: 'process-local-fixture' }, file);
    assert.deepEqual(manifestVerdictCapFailures(row), [], file);
  }
  // R-CW-3's prose says it stays PARTIAL-candidate, but it declares no cap: none is inferred.
  const r3 = await manifest('r-cw-3.json');
  assert.match(r3.review.notes, /PARTIAL-candidate/);
  assert.equal(declaredRowCap(r3), null);
  assert.deepEqual(manifestVerdictCapFailures(r3), []);
});

// The claims 🌊's ruling withdraws: that a passing preflight makes R-CW-5/6 PASS.
const LIFTING_CLAIMS = [
  /\b(?:is|are) PASS only when\b/,
  /before it can be PASS/,
  /\bkeeps? PASS\b/,
  /is `pass` only when/,
  /PASS-candidate survives only when/,
  /leaves the behavioral verdict in place/,
];
const WORDING_FILES = [
  'tools/k6-proofs/README.md',
  'tools/k6-proofs/skill/SKILL.md',
  'tools/k6-proofs/row-manifest.schema.json',
  'tools/k6-proofs/docs/R-CW-5-ISOLATED-TOOL-SURFACE.md',
  'tools/k6-proofs/docs/R-CW-6-ISOLATED-MAX-CHAIN.md',
  'tools/k6-proofs/manifests/r-cw-5.json',
  'tools/k6-proofs/manifests/r-cw-6.json',
  'tools/k6-proofs/manifests/r-cw-5a-static.json',
  'tools/k6-proofs/manifests/r-cw-6a-static.json',
  'tools/k6-proofs/lib/required-preflight.mjs',
  'tools/k6-proofs/scripts/grade-preflight-gated-row.mjs',
  'tools/k6-proofs/scripts/validate-corpus.mjs',
  'tools/k6-proofs/scripts/__tests__/required-preflight-corpus.test.mjs',
  'tools/k6-proofs/scripts/__tests__/required-preflight-grader.test.mjs',
];

test('no doc, manifest or comment says a passing preflight makes R-CW-5/6 PASS', async () => {
  for (const file of WORDING_FILES) {
    // Whitespace folded, so a claim wrapped across lines is still found.
    const text = (await readFile(join(repoRoot, file), 'utf8')).replace(/\s+/g, ' ');
    for (const claim of LIFTING_CLAIMS) assert.doesNotMatch(text, claim, `${file}: ${claim}`);
  }
  // The replacement is stated where a reader of the row looks first.
  for (const file of [
    'tools/k6-proofs/README.md',
    'tools/k6-proofs/skill/SKILL.md',
    'tools/k6-proofs/docs/R-CW-5-ISOLATED-TOOL-SURFACE.md',
    'tools/k6-proofs/docs/R-CW-6-ISOLATED-MAX-CHAIN.md',
    'tools/k6-proofs/lib/required-preflight.mjs',
  ]) {
    const text = (await readFile(join(repoRoot, file), 'utf8')).replace(/\s+/g, ' ');
    assert.match(text, /necessary, not sufficient/, file);
  }
});
