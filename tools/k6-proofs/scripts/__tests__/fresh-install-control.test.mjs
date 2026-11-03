// R-CD-FRESH-INSTALL control: the byte-walked storage shape, every named refusal, the verdict
// logic on fixtures, and dry runs against a scripted fresh-install gateway. Nothing new is imported
// at module scope, so on a tree without the control each test fails for its own reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const LIB = path.join(repoRoot, 'tools/k6-proofs/lib/fresh-install-control.mjs');
const DRIVER = path.join(repoRoot, 'tools/k6-proofs/scripts/run-fresh-install-control.mjs');
const SCRIPTED = path.join(repoRoot, 'tools/k6-proofs/scripts/__tests__/helpers/fresh-install-scripted-gateway.mjs');
const CANDIDATE = '352f56029dc95c60149ab4aaa127226a861d0b3d';
const DOCS = 'd'.repeat(40);
const J12 = '352f56029dc95c60149ab4aaa127226a861d0b3d';

const lib = () => import(pathToFileURL(LIB).href);
const driver = () => import(pathToFileURL(DRIVER).href);

const roots = [];
test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** A temporary home, a stage holding the scripted gateway, an observer key and output paths. */
async function workspace({ commit = CANDIDATE, buildId = 'fic-build-1' } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fic-test-'));
  roots.push(root);
  const home = path.join(root, 'home');
  mkdirSync(home);
  const stage = path.join(root, 'stage');
  mkdirSync(path.join(stage, 'dist'), { recursive: true });
  copyFileSync(SCRIPTED, path.join(stage, 'dist', 'index.js'));
  writeFileSync(path.join(stage, 'dist', 'build-info.json'), JSON.stringify({ commit, buildId, version: '2026.10.31' }));
  writeFileSync(path.join(stage, 'dist', 'node-compile-cache.mjs'), "if (process.argv.includes('--maintain')) setTimeout(() => {}, 60_000);\n");
  const keyFile = path.join(root, 'observer.key');
  writeFileSync(keyFile, `${'k'.repeat(64)}\n`, { mode: 0o600 });
  return {
    root,
    home,
    stage,
    keyFile,
    stateDir: path.join(root, 'fresh-state'),
    artifactDir: path.join(root, 'out', 'run'),
    port: await freePort(),
  };
}

function controlOptions(ws, extra = {}) {
  return {
    stageDir: ws.stage,
    candidateSha: CANDIDATE,
    docsSha: DOCS,
    stateDir: ws.stateDir,
    port: ws.port,
    artifactDir: ws.artifactDir,
    observerKeyFile: ws.keyFile,
    home: ws.home,
    environment: {},
    repoRoot: path.join(ws.root, 'repo'),
    plan: { stopGraceMs: 3000, bootTimeoutMs: 20_000 },
    ...extra,
  };
}

const docsOverride = { docsIdentity: () => ({ sha: DOCS, clean: true }) };

function markerProcesses(runId) {
  const found = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/u.test(entry)) continue;
    try {
      if (readFileSync(`/proc/${entry}/environ`).toString('utf8').split('\0').includes(`OPENCLAW_PROOF_FIC_RUN=${runId}`)) found.push(Number(entry));
    } catch {
      // Gone or not ours.
    }
  }
  return found;
}

/* ------------------------------------------------------------------------------------ */
/* Byte-walked storage shape                                                             */
/* ------------------------------------------------------------------------------------ */

test('the expected authority column hash is what SQLite reports for the byte-walked DDL', async () => {
  const fic = await lib();
  const database = new DatabaseSync(':memory:');
  database.exec(fic.FIC_AUTHORITY_TABLE_SQL);
  const columns = database.prepare(`PRAGMA table_xinfo(${fic.FIC_AUTHORITY_TABLE})`).all();
  const [listed] = database.prepare(`PRAGMA table_list(${fic.FIC_AUTHORITY_TABLE})`).all();
  const projection = fic.authorityProjection(columns, { strict: listed.strict === 1, withoutRowid: listed.wr === 1 });
  assert.deepEqual(projection, JSON.parse(JSON.stringify(fic.FIC_AUTHORITY_PROJECTION)));
  assert.equal(fic.projectionSha256(projection), fic.FIC_AUTHORITY_COLUMNS_SHA256);
  // A drifted table hashes differently: not STRICT, or one more column.
  for (const ddl of [
    'CREATE TABLE session_recipient_authority (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
    'CREATE TABLE session_recipient_authority (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, generation INTEGER) STRICT',
    // (A STRICT table's PRIMARY KEY is NOT NULL whether or not it says so, so that spelling is
    // the same table and hashes the same; a nullable epoch is not.)
    'CREATE TABLE session_recipient_authority (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT',
    'CREATE TABLE session_recipient_authority (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT, WITHOUT ROWID',
  ]) {
    const drift = new DatabaseSync(':memory:');
    drift.exec(ddl);
    const [list] = drift.prepare('PRAGMA table_list(session_recipient_authority)').all();
    const hash = fic.projectionSha256(fic.authorityProjection(drift.prepare('PRAGMA table_xinfo(session_recipient_authority)').all(), { strict: list.strict === 1, withoutRowid: list.wr === 1 }));
    assert.notEqual(hash, fic.FIC_AUTHORITY_COLUMNS_SHA256, ddl);
  }
});

// The byte-walk itself, re-read from the product when a clone holding j12 is on this host.
const productRepo = [process.env.OPENCLAW_SOURCE_REPO, path.join(os.homedir(), 'flesh_beast_best_beast/source/openclaw')]
  .filter(Boolean)
  .find((dir) => existsSync(dir) && spawnSync('git', ['-C', dir, 'cat-file', '-e', `${J12}^{commit}`]).status === 0);
const show = (file) => spawnSync('git', ['-C', productRepo, 'show', `${J12}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout;
test('the expectations match the product bytes at j12', { skip: productRepo ? false : 'no openclaw clone with j12 on this host' }, async () => {
  const fic = await lib();
  assert.equal(fic.FIC_BYTE_WALK_SHA, J12);
  const schema = show('src/state/openclaw-agent-schema.sql').split('\n');
  assert.equal(schema.slice(141, 147).join('\n'), fic.FIC_AUTHORITY_TABLE_SQL, 'openclaw-agent-schema.sql:142-147');
  const versions = show('src/state/openclaw-schema-versions.ts').split('\n');
  assert.equal(versions[12], `export const OPENCLAW_AGENT_SCHEMA_VERSION = ${fic.FIC_AGENT_SCHEMA_VERSION};`);
  assert.equal(versions[46], `export const OPENCLAW_STATE_SCHEMA_VERSION = ${fic.FIC_STATE_SCHEMA_VERSION};`);
  const creation = show('src/state/openclaw-agent-db-schema.ts').split('\n').slice(351, 358).join('\n');
  assert.match(creation, /isEmptyDatabase && targetVersion === OPENCLAW_AGENT_SCHEMA_VERSION/u);
  assert.match(creation, /PRAGMA user_version = \$\{targetVersion\}/u);
  assert.match(creation, /persistAgentSchemaMetadata\(db, agentId, targetVersion\)/u);
  const desktop = show('src/infra/device-pairing-node-desktop-migration.ts').split('\n');
  assert.equal(desktop[26], `const MIGRATION_ID = "${fic.FIC_FRESH_INSTALL_MIGRATION_RECEIPTS[0].id}";`);
  assert.match(desktop.slice(119, 126).join('\n'), /status: "completed",\n\s+reportJson: JSON\.stringify\(\{ retiredDesktopApprovals: retired \}\)/u);
  assert.match(show('src/gateway/server-startup-bootstrap.ts').split('\n').slice(495, 505).join('\n'), /migrateLegacyDesktopStreamOptOuts\(cfgAtStart\)/u);
  const continuation = show('src/auto-reply/continuation/config.ts').split('\n');
  assert.equal(continuation[99].trim(), 'enabled: continuation?.enabled === true,');
  const startGuard = show('src/cli/gateway-cli/pre-bootstrap.ts').split('\n').slice(53, 81).join('\n');
  assert.match(startGuard, /params\.mode === "local"/u);
  const narrowing = show('src/config/sessions/session-accessor.sqlite-entry-mutation.ts').split('\n').slice(118, 136).join('\n');
  assert.match(narrowing, /advanceSessionRecipientAuthorityInTransaction\(database, params\.sessionKey\)/u);
  const noTurn = show('src/gateway/server-methods/sessions-create.ts').split('\n').slice(615, 619).join('\n');
  assert.match(noTurn, /if \(!hasInitialTurn\) \{\n\s+scheduleCreatedDashboardSessionTitle/u);
  const noTitle = show('src/gateway/server-methods/chat-send-background.ts').split('\n').slice(35, 38).join('\n');
  assert.match(noTitle, /!titleSource/u);
  const validate = show('src/cli/config-cli.ts').split('\n').slice(483, 565).join('\n');
  assert.match(validate, /\.command\("validate"\)/u);
  assert.match(validate, /valid: true, path: outputPath, warnings/u);
});

test('model credentials are recognised by name, never by value', async () => {
  const fic = await lib();
  assert.deepEqual(fic.modelCredentialKeys({
    ANTHROPIC_API_KEY: 'x',
    OPENAI_API_KEY: 'x',
    CLAUDE_CODE_OAUTH_TOKEN: 'x',
    AWS_BEARER_TOKEN_BEDROCK: 'x',
    COPILOT_GITHUB_TOKEN: 'x',
    GOOGLE_APPLICATION_CREDENTIALS: '/x.json',
    RUNWAYML_API_SECRET: 'x',
    GEMINI_API_KEY: '   ',
    PATH: '/usr/bin',
    GH_CONFIG_DIR: '/x',
    OPENCLAW_GATEWAY_TOKEN: 'x',
  }), [
    'ANTHROPIC_API_KEY',
    'AWS_BEARER_TOKEN_BEDROCK',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'COPILOT_GITHUB_TOKEN',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'OPENAI_API_KEY',
    'RUNWAYML_API_SECRET',
  ]);
});

test('the migration journal accepts only the fresh boot receipt, and names anything else by hash', async () => {
  const fic = await lib();
  const fresh = { id: 'node-desktop-stream-pairing-defaults-v1', status: 'completed', report: '{"retiredDesktopApprovals":0}' };
  assert.deepEqual(fic.classifyMigrationRuns([fresh]), { runs: 1, freshInstallReceipts: 1, unexpected: 0, unexpectedIdSha256s: [] });
  const upgraded = fic.classifyMigrationRuns([{ ...fresh, report: '{"retiredDesktopApprovals":2}' }, { id: 'legacy-sessions:import', status: 'completed', report: '{}' }]);
  assert.equal(upgraded.unexpected, 2);
  assert.equal(upgraded.freshInstallReceipts, 0);
  assert.ok(upgraded.unexpectedIdSha256s.every((hash) => /^[0-9a-f]{64}$/u.test(hash)));
  assert.ok(!JSON.stringify(upgraded).includes('legacy-sessions'));
});

/* ------------------------------------------------------------------------------------ */
/* Refusals before start                                                                 */
/* ------------------------------------------------------------------------------------ */

async function refusedRun(ws, extra = {}, platform = {}) {
  const { runFreshInstallControl } = await driver();
  const spawned = [];
  const result = await runFreshInstallControl(controlOptions(ws, extra), {
    ...docsOverride,
    spawnGateway: (spec) => {
      spawned.push(spec);
      throw new Error('a refused run must not start a gateway');
    },
    ...platform,
  });
  assert.equal(result.status, 'refused');
  assert.equal(spawned.length, 0);
  assert.equal(result.refusal.processesStarted, 0);
  const written = JSON.parse(readFileSync(path.join(ws.artifactDir, 'refusal.json'), 'utf8'));
  assert.deepEqual(written.refusals, result.refusals);
  return result.refusals.map((entry) => entry.code);
}

test('refusal: a non-empty state directory', async () => {
  const ws = await workspace();
  mkdirSync(ws.stateDir);
  writeFileSync(path.join(ws.stateDir, 'openclaw.json'), '{}');
  const codes = await refusedRun(ws);
  assert.deepEqual(codes, ['state-dir-not-empty']);
  assert.equal(readFileSync(path.join(ws.stateDir, 'openclaw.json'), 'utf8'), '{}');
});

test('refusal: an existing state directory, even an empty one: the control creates its own', async () => {
  const ws = await workspace();
  mkdirSync(ws.stateDir);
  assert.deepEqual(await refusedRun(ws), ['state-dir-exists']);
  assert.deepEqual(readdirSync(ws.stateDir), []);
});

test('two runs on one state directory: the second cannot claim it', async () => {
  const first = await workspace();
  const second = await workspace();
  const { runFreshInstallControl } = await driver();
  const results = await Promise.all([
    runFreshInstallControl(controlOptions(first), docsOverride),
    runFreshInstallControl(controlOptions(second, { stateDir: first.stateDir }), docsOverride),
  ]);
  const completed = results.filter((result) => result.status === 'completed');
  const refused = results.filter((result) => result.status === 'refused');
  assert.equal(completed.length, 1, JSON.stringify(results.map((result) => result.refusals ?? result.grade?.verdict)));
  assert.equal(completed[0].grade.verdict, 'PASS-candidate', JSON.stringify(completed[0].grade));
  assert.equal(refused.length, 1);
  assert.ok(['state-dir-changed', 'state-dir-exists', 'state-dir-not-empty'].includes(refused[0].refusals[0].code), JSON.stringify(refused[0].refusals));
  assert.equal(refused[0].refusal.processesStarted, 0);
});

test('refusal: an artifact directory that lands in a live ~/.openclaw through a symlink', async () => {
  const ws = await workspace();
  const data = path.join(ws.root, 'data', 'openclaw');
  mkdirSync(data, { recursive: true });
  symlinkSync(data, path.join(ws.home, '.openclaw'));
  const { runFreshInstallControl } = await driver();
  const result = await runFreshInstallControl(controlOptions(ws, { artifactDir: path.join(data, 'run1') }), docsOverride);
  assert.deepEqual(result.refusals.map((entry) => entry.code), ['artifact-dir-in-target']);
  assert.equal(result.refusalWritten, false);
  assert.deepEqual(readdirSync(data), []);
});

test('refusal: a state directory under, or over, any live ~/.openclaw', async () => {
  for (const make of [
    (ws) => path.join(ws.home, '.openclaw', 'fresh'),
    (ws) => path.join(ws.home, '.openclaw-work', 'fresh'),
    (ws) => path.join(ws.home, '.clawdbot'),
    (ws) => ws.home,
  ]) {
    const ws = await workspace();
    mkdirSync(path.join(ws.home, '.openclaw'), { recursive: true });
    mkdirSync(path.join(ws.home, '.openclaw-work'), { recursive: true });
    const stateDir = make(ws);
    const codes = await refusedRun(ws, { stateDir });
    assert.ok(codes.includes('state-dir-live'), `${stateDir}: ${codes}`);
    assert.ok(!existsSync(path.join(stateDir, 'state')), 'nothing was created in the live directory');
  }
  // The operator's own OPENCLAW_STATE_DIR is live too.
  const ws = await workspace();
  const codes = await refusedRun(ws, { environment: { OPENCLAW_STATE_DIR: ws.stateDir } });
  assert.deepEqual(codes, ['state-dir-live']);
});

test('refusal: a port already in use, or a live gateway\'s', async () => {
  const ws = await workspace();
  const server = net.createServer();
  await new Promise((resolve) => server.listen(ws.port, '127.0.0.1', resolve));
  try {
    assert.deepEqual(await refusedRun(ws), ['port-in-use']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const live = await workspace();
  assert.deepEqual(await refusedRun(live, { port: 18789 }, { portListening: () => false }), ['port-is-live']);
  const configured = await workspace();
  mkdirSync(path.join(configured.home, '.openclaw'));
  writeFileSync(path.join(configured.home, '.openclaw', 'openclaw.json'), JSON.stringify({ gateway: { port: configured.port } }));
  assert.deepEqual(await refusedRun(configured), ['port-is-live']);
});

test('refusal: a runtime whose build-info commit is not the candidate', async () => {
  const ws = await workspace({ commit: 'e'.repeat(40) });
  assert.deepEqual(await refusedRun(ws), ['stage-build-mismatch']);
  assert.ok(!existsSync(ws.stateDir), 'the state directory is not created');
});

test('refusal: any model credential in the environment, named by key only', async () => {
  const ws = await workspace();
  const { refusals } = await (async () => {
    const { runFreshInstallControl } = await driver();
    return runFreshInstallControl(controlOptions(ws, { environment: { ANTHROPIC_API_KEY: 'sk-ant-secret-value', PATH: '/usr/bin' } }), {
      ...docsOverride,
      spawnGateway: () => {
        throw new Error('a refused run must not start a gateway');
      },
    });
  })();
  assert.deepEqual(refusals.map((entry) => entry.code), ['model-credentials-in-environment']);
  assert.match(refusals[0].detail, /ANTHROPIC_API_KEY/u);
  assert.ok(!readFileSync(path.join(ws.artifactDir, 'refusal.json'), 'utf8').includes('sk-ant-secret-value'));
});

test('every named refusal is reported together, and the workorder names them all', async () => {
  const fic = await lib();
  const ws = await workspace({ commit: 'e'.repeat(40) });
  mkdirSync(path.join(ws.home, '.openclaw', 'fresh'), { recursive: true });
  writeFileSync(path.join(ws.home, '.openclaw', 'fresh', 'x'), 'x');
  const server = net.createServer();
  await new Promise((resolve) => server.listen(ws.port, '127.0.0.1', resolve));
  try {
    const codes = await refusedRun(ws, { stateDir: path.join(ws.home, '.openclaw', 'fresh'), environment: { OPENAI_API_KEY: 'x' } });
    assert.deepEqual([...codes].sort(), [...fic.FIC_NAMED_REFUSALS].sort());
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the guard also refuses a missing observer key, a used artifact directory and one inside the repository', async () => {
  const ws = await workspace();
  assert.deepEqual(await refusedRun(ws, { observerKeyFile: undefined }), ['observer-key-missing']);
  const used = await workspace();
  mkdirSync(`${used.artifactDir}.private`, { recursive: true });
  assert.deepEqual(await refusedRun(used), ['artifact-dir-used']);
  const { runFreshInstallControl } = await driver();
  const inRepo = await workspace();
  const result = await runFreshInstallControl(controlOptions(inRepo, { artifactDir: path.join(inRepo.root, 'repo', 'out') }), docsOverride);
  assert.deepEqual(result.refusals.map((entry) => entry.code), ['artifact-dir-in-repo']);
  assert.equal(result.refusalWritten, false);
});

/* ------------------------------------------------------------------------------------ */
/* Verdict logic on fixtures                                                             */
/* ------------------------------------------------------------------------------------ */

function passingRecord(fic) {
  return {
    schema: fic.FIC_SCHEMA,
    row: fic.FIC_ROW,
    runId: 'fic-fixture',
    candidateSha: CANDIDATE,
    docsSha: DOCS,
    docs: { sha: DOCS, clean: true },
    target: {
      agentId: 'main',
      port: 18990,
      stageBuild: { commit: CANDIDATE, buildId: 'fic-build-1', version: '2026.10.31' },
      environmentCredentialKeys: [],
      stateDir: { createdByControl: true, emptyAtStart: true, entriesAtStart: 0, mode: '0700' },
      home: { controlOwned: true, entriesAtStart: 0 },
      config: { sha256: 'a'.repeat(64), keys: [...fic.FIC_CONFIG_KEYS], mode: '0600', outsideStateDir: true },
    },
    gateway: {
      started: true,
      readyAtMs: 1200,
      listen: { port: 18990, inode: 4242, ownerIsGatewayPid: true },
      readyz: { status: 200, ready: true, bodySha256: 'b'.repeat(64) },
      startupz: { status: 200, startup: 'started', bodySha256: 'c'.repeat(64) },
      hello: { bootIdSha256: 'd'.repeat(64), buildId: 'fic-build-1' },
      environ: { keyCount: 9, credentialKeys: [], homeControlOwned: true },
    },
    storage: {
      agentDatabase: {
        present: true,
        userVersion: 40,
        schemaMeta: { present: true, role: 'agent', schemaVersion: 40, agentIdMatches: true, createdEqualsUpdated: true },
        authProfileRows: 0,
      },
      authorityTable: { present: true, columns: 4, strict: true, columnsSha256: fic.FIC_AUTHORITY_COLUMNS_SHA256 },
      stateDatabase: {
        present: true,
        userVersion: 36,
        migrationRuns: { runs: 1, freshInstallReceipts: 1, unexpected: 0, unexpectedIdSha256s: [] },
        migrationSources: 0,
        backupRuns: 0,
        agentRegistry: { rows: 1, mismatched: 0 },
      },
    },
    authority: {
      readOnly: true,
      rowsBeforeCreate: 0,
      createOk: true,
      rowsAfterCreate: 0,
      visibilityOk: true,
      rowsAfterNarrowing: 1,
      keyRow: { present: true, keyForm: 'canonical' },
      sessionKeySha256: 'e'.repeat(64),
      epochSha256: 'f'.repeat(64),
    },
    configValidate: { ran: true, exit: { code: 0, signal: null }, valid: true, pathMatches: true, warnings: 0, issues: 0 },
    stop: { signal: 'SIGTERM', signalledAtMs: 3000, exitedAtMs: 3100, exit: { code: 0, signal: null }, escalatedToSigkill: false, shutdownDeadlineReached: false, portReleased: true, leftoverProcesses: 0 },
    cleanup: { completed: true, residualPids: [], unverifiedPids: [], orphansTerminated: [], portReleased: true, stateRemoved: true, homeRemoved: true, tmpRemoved: true, configRemoved: true },
    timings: { bootMs: 1200, establishMs: 40, configValidateMs: 300, stopMs: 100, totalMs: 4000 },
    observerKey: { available: true, algorithmFingerprint: '0123456789abcdef' },
    errors: [],
  };
}

test('all receipts present and holding grade PASS-candidate', async () => {
  const fic = await lib();
  const grade = fic.gradeFreshInstallControl(passingRecord(fic));
  assert.equal(grade.verdict, 'PASS-candidate', JSON.stringify(grade));
  assert.deepEqual(grade.missingReceipts, []);
  assert.deepEqual(Object.keys(grade.observations), [...fic.FIC_RECEIPTS]);
  assert.ok(Object.values(grade.observations).every((entry) => entry.present && entry.holds));
  assert.deepEqual(grade.namedLimits, ['no-upgrade-path-exercised', 'no-model-turn', 'no-delegate-delivery']);
});

// One removal per receipt: the record without that receipt's evidence.
const REMOVALS = {
  'runtime-build-info': (record) => { delete record.target.stageBuild; },
  'state-dir-empty-proof': (record) => { delete record.target.stateDir; },
  readiness: (record) => { delete record.gateway.readyAtMs; },
  'agent-schema-version': (record) => { record.storage.agentDatabase = { present: false, error: 'no-database' }; },
  'no-upgrade-path': (record) => { record.storage.stateDatabase = { present: false, error: 'no-database' }; },
  'authority-table-column-hash': (record) => { record.storage.authorityTable = null; },
  'authority-epoch-row-hash': (record) => { delete record.authority.rowsAfterNarrowing; },
  'no-model-sign-in': (record) => { record.gateway.environ = null; },
  'config-validate': (record) => { record.configValidate = { ran: false }; },
  'clean-stop': (record) => { record.stop = {}; },
  timings: (record) => { record.timings = {}; },
  'signed-cleanup-receipt': (record) => { record.cleanup = { completed: false }; },
};

test('each receipt missing keeps the record below PASS-candidate', async () => {
  const fic = await lib();
  assert.deepEqual(Object.keys(REMOVALS), [...fic.FIC_RECEIPTS]);
  for (const [name, remove] of Object.entries(REMOVALS)) {
    const record = passingRecord(fic);
    remove(record);
    const grade = fic.gradeFreshInstallControl(record);
    assert.notEqual(grade.verdict, 'PASS-candidate', name);
    assert.ok(grade.missingReceipts.includes(name), `${name} is not reported missing: ${JSON.stringify(grade.missingReceipts)}`);
    assert.equal(grade.observations[name].present, false, name);
  }
});

// Contradictions: a present receipt that shows something other than a fresh install.
const CONTRADICTIONS = {
  'runtime-not-candidate': (record) => { record.target.stageBuild.commit = 'e'.repeat(40); },
  'state-not-fresh': (record) => { Object.assign(record.target.stateDir, { emptyAtStart: false, entriesAtStart: 3 }); },
  'gateway-not-ready': (record) => { delete record.gateway.readyAtMs; record.gateway.failure = { kind: 'exited-before-ready' }; },
  'readiness-incomplete': (record) => { record.gateway.hello.buildId = 'another-build'; },
  'agent-schema-not-canonical': (record) => { record.storage.agentDatabase.schemaMeta.createdEqualsUpdated = false; },
  'upgrade-path-recorded': (record) => { record.storage.stateDatabase.migrationSources = 1; },
  'fresh-boot-receipt-missing': (record) => { Object.assign(record.storage.stateDatabase.migrationRuns, { runs: 0, freshInstallReceipts: 0 }); },
  'authority-table-missing': (record) => { record.storage.authorityTable = { present: false }; },
  'authority-table-drift': (record) => { record.storage.authorityTable.columnsSha256 = '0'.repeat(64); },
  'epoch-row-not-single': (record) => { record.authority.rowsAfterNarrowing = 2; },
  'model-credentials-present': (record) => { record.storage.agentDatabase.authProfileRows = 1; },
  'config-invalid': (record) => { record.configValidate.valid = false; },
  'stop-not-clean': (record) => { record.stop.escalatedToSigkill = true; },
  'cleanup-residue': (record) => { record.cleanup.stateRemoved = false; },
};

test('each contradiction of a fresh install grades FAIL-candidate with its own code', async () => {
  const fic = await lib();
  for (const [code, contradict] of Object.entries(CONTRADICTIONS)) {
    const record = passingRecord(fic);
    contradict(record);
    const grade = fic.gradeFreshInstallControl(record);
    assert.equal(grade.verdict, 'FAIL-candidate', code);
    assert.ok(grade.failures.some((entry) => entry.code === code), `${code}: ${JSON.stringify(grade.failures)}`);
  }
  // More of the same: every other way the journal, the schema, the epoch, the sign-in or the stop can contradict.
  const more = [
    (record) => { record.storage.agentDatabase.userVersion = 39; },
    (record) => { record.storage.agentDatabase.schemaMeta.schemaVersion = 39; },
    (record) => { record.storage.stateDatabase.migrationRuns.unexpected = 1; },
    (record) => { record.storage.stateDatabase.backupRuns = 1; },
    (record) => { record.storage.stateDatabase.agentRegistry.mismatched = 1; },
    (record) => { record.authority.rowsBeforeCreate = 1; },
    (record) => { record.authority.keyRow = { present: false }; },
    (record) => { record.authority.readOnly = false; },
    (record) => { record.gateway.environ.credentialKeys = ['ANTHROPIC_API_KEY']; },
    (record) => { record.gateway.environ.homeControlOwned = false; },
    (record) => { record.configValidate.exit.code = 1; },
    (record) => { record.configValidate.pathMatches = false; },
    (record) => { record.stop.exit = { code: 1, signal: null }; },
    (record) => { record.stop.leftoverProcesses = 1; },
    (record) => { record.stop.shutdownDeadlineReached = true; },
    (record) => { record.stop.portReleased = false; },
    (record) => { record.cleanup.residualPids = [4242]; },
    (record) => { record.cleanup.configRemoved = false; },
    (record) => { record.cleanup.homeRemoved = false; },
    (record) => { record.cleanup.tmpRemoved = false; },
    (record) => { record.target.stateDir.createdByControl = false; },
    (record) => { record.target.config.keys = [...fic.FIC_CONFIG_KEYS, 'channels.discord.token']; },
    (record) => { record.target.config.mode = '0644'; },
    (record) => { record.candidateSha = 'short'; },
  ];
  for (const [index, contradict] of more.entries()) {
    const record = passingRecord(fic);
    contradict(record);
    assert.equal(fic.gradeFreshInstallControl(record).verdict, 'FAIL-candidate', `contradiction ${index}`);
  }
});

test('a missing bound keeps an otherwise holding record at PARTIAL-candidate', async () => {
  const fic = await lib();
  for (const [code, loosen] of Object.entries({
    'receipt-unsigned': (record) => { record.observerKey.available = false; },
    'docs-harness-dirty': (record) => { record.docs.clean = false; },
    'build-id-unbound': (record) => { record.target.stageBuild.buildId = null; },
    'control-error': (record) => { record.errors.push({ at: 'control', message: 'x' }); },
  })) {
    const record = passingRecord(fic);
    loosen(record);
    const grade = fic.gradeFreshInstallControl(record);
    assert.ok(['PARTIAL-candidate', 'MISSING-candidate'].includes(grade.verdict), code);
    assert.ok(grade.partials.some((entry) => entry.code === code), code);
  }
});

/* ------------------------------------------------------------------------------------ */
/* Dry runs against the scripted fresh-install gateway                                   */
/* ------------------------------------------------------------------------------------ */

async function dryRun(gatewayEnv = {}, extra = {}) {
  const ws = await workspace();
  const { runFreshInstallControl } = await driver();
  const result = await runFreshInstallControl(controlOptions(ws, { gatewayEnv, ...extra }), docsOverride);
  return { ws, result };
}

test('dry run: a fresh install of the scripted gateway grades PASS-candidate and leaves nothing behind', async () => {
  const { ws, result } = await dryRun();
  assert.equal(result.status, 'completed');
  assert.equal(result.grade.verdict, 'PASS-candidate', JSON.stringify({ grade: result.grade, errors: result.record.errors }));
  const { record } = result;
  assert.equal(record.target.stateDir.createdByControl, true);
  assert.equal(record.target.stateDir.entriesAtStart, 0);
  assert.equal(record.gateway.agentDatabaseAtReady, 'absent');
  assert.equal(record.authority.rowsBeforeCreate, 0);
  assert.equal(record.authority.rowsAfterCreate, 0);
  assert.equal(record.authority.rowsAfterNarrowing, 1);
  assert.equal(record.storage.agentDatabase.userVersion, 40);
  assert.equal(record.storage.stateDatabase.userVersion, 36);
  assert.equal(record.storage.stateDatabase.migrationRuns.freshInstallReceipts, 1);
  /* cleanup: nothing of the run remains */
  assert.ok(!existsSync(ws.stateDir));
  assert.ok(!existsSync(path.join(`${ws.artifactDir}.private`, 'home')));
  assert.ok(!existsSync(path.join(`${ws.artifactDir}.private`, 'config')));
  assert.ok(!existsSync(path.join(`${ws.artifactDir}.private`, 'tmp')), 'the gateway TMPDIR is removed');
  assert.equal(record.cleanup.tmpRemoved, true);
  // The gateway logged to the run's own file, not the machine-wide /tmp/openclaw one.
  assert.ok(record.target.config.keys.includes('logging.file'));
  assert.match(readFileSync(path.join(`${ws.artifactDir}.private`, 'logs', 'gateway.log'), 'utf8'), /gateway starting[\s\S]*gateway stopped/u);
  assert.equal(record.stop.leftoverProcesses, 0);
  assert.equal(record.stop.compileCacheMaintainers, 0);
  // The session key cannot be rebuilt from the public run id.
  const guessed = createHash('sha256').update(`agent:main:fic-${record.runId.slice(4, 16)}`).digest('hex');
  assert.notEqual(record.authority.sessionKeySha256, guessed);
  assert.equal(record.target.livePortsRefused, undefined);
  assert.equal(statSync(`${ws.artifactDir}.private`).mode & 0o777, 0o700);
  assert.deepEqual(markerProcesses(record.runId), []);
  assert.equal(record.cleanup.portReleased, true);
  /* the receipt: signed, re-gradable, counts and hashes only */
  const receipt = JSON.parse(readFileSync(path.join(ws.artifactDir, 'observer-receipt.json'), 'utf8'));
  const { verifyReceipt } = await driver();
  const key = readFileSync(ws.keyFile, 'utf8').trim();
  assert.deepEqual(verifyReceipt(receipt, key), { valid: true, verdict: 'PASS-candidate', regraded: 'PASS-candidate', regradeMatches: true });
  assert.equal(verifyReceipt({ ...receipt, verdict: 'PASS-candidate', grade: { ...receipt.grade, failures: [] }, record: { ...receipt.record, candidateSha: 'f'.repeat(40) } }, key).valid, false);
  const text = JSON.stringify(receipt);
  for (const secret of [ws.root, ws.home, ws.stateDir, key]) assert.ok(!text.includes(secret), `the receipt carries ${secret}`);
  const config = readFileSync(path.join(`${ws.artifactDir}.private`, 'gateway.stdout.log'), 'utf8');
  assert.match(config, /\[gateway\] stopped/u);
});

test('dry run: the entry\'s detached compile-cache maintainer is not a leftover, and cleanup still stops it', async () => {
  const { ws, result } = await dryRun({ FIC_SCRIPT_MAINTAINER: '1' });
  assert.equal(result.grade.verdict, 'PASS-candidate', JSON.stringify(result.grade));
  assert.equal(result.record.stop.compileCacheMaintainers, 1);
  assert.equal(result.record.stop.leftoverProcesses, 0);
  assert.equal(result.record.cleanup.orphansTerminated.length, 1);
  assert.deepEqual(markerProcesses(result.record.runId), []);
  assert.ok(!existsSync(ws.stateDir));
});

const NEGATIVE_DRY_RUNS = [
  [{ FIC_SCRIPT_NO_DESKTOP_RECEIPT: '1' }, 'fresh-boot-receipt-missing'],
  [{ FIC_SCRIPT_MIGRATED: '1' }, 'agent-schema-not-canonical'],
  [{ FIC_SCRIPT_AGENT_VERSION: '39' }, 'agent-schema-not-canonical'],
  [{ FIC_SCRIPT_LEGACY_IMPORT: '1' }, 'upgrade-path-recorded'],
  [{ FIC_SCRIPT_BACKUP_RUN: '1' }, 'upgrade-path-recorded'],
  [{ FIC_SCRIPT_STALE_REGISTRY: '1' }, 'upgrade-path-recorded'],
  [{ FIC_SCRIPT_DESKTOP_RETIRED: '2' }, 'upgrade-path-recorded'],
  [{ FIC_SCRIPT_AUTHORITY: 'nostrict' }, 'authority-table-drift'],
  [{ FIC_SCRIPT_AUTHORITY: 'extra-column' }, 'authority-table-drift'],
  [{ FIC_SCRIPT_AUTHORITY: 'missing' }, 'authority-table-missing'],
  [{ FIC_SCRIPT_CREATE_WRITES_AUTHORITY: '1' }, 'epoch-row-not-single'],
  [{ FIC_SCRIPT_NO_ADVANCE: '1' }, 'epoch-row-not-single'],
  [{ FIC_SCRIPT_AUTH_PROFILE: '1' }, 'model-credentials-present'],
  [{ FIC_SCRIPT_CONFIG_INVALID: '1' }, 'config-invalid'],
  [{ FIC_SCRIPT_STOP_EXIT: '1' }, 'stop-not-clean'],
  [{ FIC_SCRIPT_IGNORE_SIGTERM: '1' }, 'stop-not-clean'],
  [{ FIC_SCRIPT_STOP_DEADLINE: '1' }, 'stop-not-clean'],
  [{ FIC_SCRIPT_ORPHAN: '1' }, 'stop-not-clean'],
  [{ FIC_SCRIPT_BUILD_ID: 'another-build' }, 'readiness-incomplete'],
  [{ FIC_SCRIPT_NEVER_READY: '1' }, 'gateway-not-ready'],
];

for (const [gatewayEnv, code] of NEGATIVE_DRY_RUNS) {
  test(`dry run: ${JSON.stringify(gatewayEnv)} grades FAIL-candidate (${code}) and still cleans up`, async () => {
    const extra = gatewayEnv.FIC_SCRIPT_NEVER_READY ? { plan: { stopGraceMs: 3000, bootTimeoutMs: 2000 } } : {};
    const { ws, result } = await dryRun(gatewayEnv, extra);
    assert.equal(result.status, 'completed');
    assert.equal(result.grade.verdict, 'FAIL-candidate', JSON.stringify(result.grade));
    assert.ok(result.grade.failures.some((entry) => entry.code === code), JSON.stringify(result.grade.failures));
    assert.deepEqual(markerProcesses(result.record.runId), []);
    assert.deepEqual(result.record.cleanup.residualPids, []);
    assert.ok(!existsSync(ws.stateDir));
    assert.ok(!existsSync(path.join(`${ws.artifactDir}.private`, 'config')));
  });
}

test('parseArgs reads every flag and refuses an unknown one', async () => {
  const { parseArgs } = await driver();
  const options = parseArgs([
    '--stage-dir', '/s', '--candidate-sha', CANDIDATE, '--docs-sha', DOCS, '--state-dir', '/st', '--port', '18995',
    '--artifact-dir', '/a', '--observer-key-file', '/k', '--agent-id', 'main', '--boot-timeout-ms', '9000',
    '--gateway-env', 'NODE_OPTIONS=--max-old-space-size=4096',
  ]);
  assert.equal(options.port, 18995);
  assert.equal(options.stateDir, '/st');
  assert.deepEqual(options.plan, { bootTimeoutMs: 9000 });
  assert.deepEqual(options.gatewayEnv, { NODE_OPTIONS: '--max-old-space-size=4096' });
  assert.throws(() => parseArgs(['--proof-gw-dir', '/x']), /unknown argument/u);
});
