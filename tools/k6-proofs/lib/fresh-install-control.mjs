/**
 * R-CD-FRESH-INSTALL disposable fresh-install control: the byte-walk expectations at j12, the
 * guard, the observation plan, the grader and the observer receipt.
 *
 * Nothing here starts, stops or signals a process. The driver
 * (scripts/run-fresh-install-control.mjs) creates the empty state directory, owns the one
 * disposable gateway's lifecycle and feeds the record it observed into gradeFreshInstallControl();
 * the grader decides the candidate verdict only from that record. The product path this control
 * exercises is mapped, with path:line anchors at j12, in scenarios/r-cd-fresh-install.js.
 *
 * 🌊's ruling (room msg 1567073096706297887, 2026-11-03 07:09Z): "make fresh install its own j12
 * corpus row: empty state dir, disposable process, no model turn. Keep it separate from the
 * stopped-seat restore receipt; they prove different paths. Don't call either row satisfied until
 * its actual artifact exists."
 */
import { canonicalJson } from './canonical-json.mjs';
import { RCC_OBSERVER_ALGORITHM, isSha40, sha256 } from './return-covenant-restart-control.mjs';
import {
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';

export { isSha40, sha256 };

export const FIC_ROW = 'R-CD-FRESH-INSTALL';
export const FIC_SCHEMA = 'openclaw.k6.fresh-install-control.v1';
export const FIC_REFUSAL_SCHEMA = 'openclaw.k6.fresh-install-control-refusal.v1';
// The same launcher-held observer key scheme as the restart control: a key the gateway never
// receives (it gets a cleared environment), so the candidate cannot sign its own observation.
export const FIC_OBSERVER_ALGORITHM = RCC_OBSERVER_ALGORITHM;
// The product ref the byte-walk read (karmaterminal/openclaw j12).
export const FIC_BYTE_WALK_SHA = '352f56029dc95c60149ab4aaa127226a861d0b3d';

/**
 * What a fresh install of j12 must create, read from the product with git show at
 * FIC_BYTE_WALK_SHA:
 * - OPENCLAW_AGENT_SCHEMA_VERSION = 40 (src/state/openclaw-schema-versions.ts:13; v40 is the
 *   continuation's recipient-authority step, :3-4, AGENT_RECIPIENT_AUTHORITY_SCHEMA_VERSION in
 *   src/state/openclaw-agent-recipient-authority-schema.ts:11-12);
 * - OPENCLAW_STATE_SCHEMA_VERSION = 36 (src/state/openclaw-schema-versions.ts:47), recorded
 *   beside the verdict, not graded;
 * - an empty agent database is created at that version directly, never migrated up: its
 *   previous version is 0 with no application schema, so it is no schema migration
 *   (src/state/openclaw-agent-db-schema.ts:317-319), and the canonical-creation branch runs the
 *   whole schema, sets user_version and inserts schema_meta in one transaction
 *   (src/state/openclaw-agent-db-schema.ts:352-358, src/state/openclaw-agent-db-metadata-write.ts:9-43);
 * - session_recipient_authority, verbatim at src/state/openclaw-agent-schema.sql:142-147.
 */
export const FIC_AGENT_SCHEMA_VERSION = 40;
export const FIC_STATE_SCHEMA_VERSION = 36;
export const FIC_AUTHORITY_TABLE = 'session_recipient_authority';
export const FIC_AUTHORITY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS session_recipient_authority (
  session_key TEXT NOT NULL PRIMARY KEY,
  epoch TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;`;
/**
 * The table's shape as SQLite reports it for that DDL (PRAGMA table_xinfo plus PRAGMA
 * table_list's strict and without-rowid flags). The control reads the same projection from the
 * fresh agent database and compares its SHA-256 with FIC_AUTHORITY_COLUMNS_SHA256.
 */
export const FIC_AUTHORITY_PROJECTION = Object.freeze({
  table: FIC_AUTHORITY_TABLE,
  strict: true,
  withoutRowid: false,
  columns: Object.freeze([
    Object.freeze({ cid: 0, name: 'session_key', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1, hidden: 0 }),
    Object.freeze({ cid: 1, name: 'epoch', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 }),
    Object.freeze({ cid: 2, name: 'created_at', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0, hidden: 0 }),
    Object.freeze({ cid: 3, name: 'updated_at', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0, hidden: 0 }),
  ]),
});
export const FIC_AUTHORITY_COLUMNS_SHA256 = '6ede42f5f5ea65007530f5f59da660e22bcab9d932ba3fae6639b848aee8eb7b';

/**
 * The migration journal is the state database's migration_runs and migration_sources
 * (src/state/openclaw-state-schema.sql:1850-1881), written through
 * src/infra/state-migrations.receipts.ts:93-151 when a legacy source is imported or a
 * once-per-database step settles. A fresh j12 boot writes exactly one such row: the desktop
 * approval step records its once-per-database receipt unconditionally, with nothing to retire
 * (src/infra/device-pairing-node-desktop-migration.ts:27 and 92-127, run at gateway startup by
 * src/gateway/server-startup-bootstrap.ts:496-505). Any other run, any migration source, any
 * backup run (src/state/openclaw-state-schema.sql:1883-1889) or an agent database registered
 * below the current version (agent_databases, :1182-1189) is an upgrade or import path.
 */
export const FIC_FRESH_INSTALL_MIGRATION_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'node-desktop-stream-pairing-defaults-v1',
    status: 'completed',
    report: '{"retiredDesktopApprovals":0}',
    anchor: 'src/infra/device-pairing-node-desktop-migration.ts:27, 92-127 (src/gateway/server-startup-bootstrap.ts:496-505)',
  }),
]);

/**
 * The minimal fresh config: what `openclaw gateway` needs to start a local gateway
 * (gateway.mode=local, src/cli/gateway-cli/pre-bootstrap.ts:54-81) on one loopback port with its
 * own token, plus the continuation switch, which is off unless set
 * (src/auto-reply/continuation/config.ts:100). No channels, no models, no plugins.
 */
export const FIC_CONFIG_KEYS = Object.freeze([
  'agents.defaults.continuation.enabled',
  'gateway.auth.mode',
  'gateway.auth.token',
  'gateway.bind',
  'gateway.mode',
  'gateway.port',
]);

export function minimalFreshConfig({ port, token }) {
  return {
    gateway: { mode: 'local', port, bind: 'loopback', auth: { mode: 'token', token } },
    agents: { defaults: { continuation: { enabled: true } } },
  };
}

/** Dotted leaf paths of a JSON object, sorted. */
export function configKeyPaths(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.keys(value)
    .flatMap((key) => configKeyPaths(value[key], prefix ? `${prefix}.${key}` : key))
    .sort();
}

/**
 * Model credentials. The gateway never receives the operator's environment (it gets a cleared one
 * and an empty, control-owned HOME, so no CLI credential file is discoverable either), and the
 * control still refuses to run from a shell that carries one. A key is a model credential when its
 * name ends like a provider secret or is one of the j12 provider names the pattern misses (core:
 * src/secrets/provider-env-vars.ts:32-44; plugins: setup.providers[].envVars in
 * extensions/*\/openclaw.plugin.json at j12). Values are never read beyond "non-empty".
 */
export const FIC_MODEL_CREDENTIAL_KEY_PATTERN = /(?:^|_)(?:API_KEY|API_SECRET|API_TOKEN|OAUTH_TOKEN|AUTH_TOKEN|ADMIN_KEY|VIRTUAL_KEY|PLAN_KEY)$/u;
export const FIC_MODEL_CREDENTIAL_KEYS = Object.freeze([
  'ABLIT_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_BEARER_TOKEN_BEDROCK',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AZURE_SPEECH_KEY',
  'COPILOT_GITHUB_TOKEN',
  'FAL_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'HF_TOKEN',
  'HUGGINGFACE_HUB_TOKEN',
  'SPEECH_KEY',
  'VOLCENGINE_TTS_TOKEN',
]);

export function isModelCredentialKey(key) {
  return typeof key === 'string' && (FIC_MODEL_CREDENTIAL_KEY_PATTERN.test(key) || FIC_MODEL_CREDENTIAL_KEYS.includes(key));
}

/** The model-credential keys an environment carries with a non-empty value, sorted. */
export function modelCredentialKeys(environment = {}) {
  return Object.entries(environment ?? {})
    .filter(([key, value]) => isModelCredentialKey(key) && typeof value === 'string' && value.trim() !== '')
    .map(([key]) => key)
    .sort();
}

/** Every receipt the row requires, in the manifest's order. */
export const FIC_RECEIPTS = Object.freeze([
  'runtime-build-info',
  'state-dir-empty-proof',
  'readiness',
  'agent-schema-version',
  'no-upgrade-path',
  'authority-table-column-hash',
  'authority-epoch-row-hash',
  'no-model-sign-in',
  'config-validate',
  'clean-stop',
  'timings',
  'signed-cleanup-receipt',
]);
/** The refusals the workorder names, each checked before anything starts. */
export const FIC_NAMED_REFUSALS = Object.freeze([
  'state-dir-not-empty',
  'state-dir-live',
  'port-in-use',
  'stage-build-mismatch',
  'model-credentials-in-environment',
]);
export const FIC_VERDICTS = Object.freeze(['PASS-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'MISSING-candidate']);
const CORPUS_STATE_CEILING = Object.freeze({
  'PASS-candidate': 'pass',
  'PARTIAL-candidate': 'partial',
  'FAIL-candidate': 'fail',
  'MISSING-candidate': 'missing',
});
export const LIVE_GATEWAY_DEFAULT_PORT = 18789;
export const DEFAULT_PLAN = Object.freeze({
  bootTimeoutMs: 180_000,
  readyPollMs: 250,
  probeTimeoutMs: 2_000,
  rpcTimeoutMs: 20_000,
  configValidateTimeoutMs: 60_000,
  stopGraceMs: 30_000,
  killGraceMs: 5_000,
});

const HEX64 = /^[0-9a-f]{64}$/u;

function isHex64(value) {
  return typeof value === 'string' && HEX64.test(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function finiteTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function planFreshInstall(overrides = {}) {
  const plan = { ...DEFAULT_PLAN };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!(key in DEFAULT_PLAN)) throw new Error(`unknown plan field: ${key}`);
    if (!positiveInteger(value)) throw new Error(`plan ${key} must be a positive integer`);
    plan[key] = value;
  }
  return plan;
}

/* ------------------------------------------------------------------------------------ */
/* Storage projections                                                                   */
/* ------------------------------------------------------------------------------------ */

/**
 * The authority table's projection from PRAGMA table_xinfo rows and PRAGMA table_list's flags,
 * in the shape of FIC_AUTHORITY_PROJECTION. Only names and declared types: no row is read.
 */
export function authorityProjection(xinfoRows, { strict, withoutRowid }) {
  return {
    table: FIC_AUTHORITY_TABLE,
    strict: strict === true,
    withoutRowid: withoutRowid === true,
    columns: [...(xinfoRows ?? [])]
      .sort((a, b) => Number(a.cid) - Number(b.cid))
      .map((row) => ({
        cid: Number(row.cid),
        name: String(row.name),
        type: String(row.type ?? '').toUpperCase(),
        notnull: Number(row.notnull),
        dflt_value: row.dflt_value ?? null,
        pk: Number(row.pk),
        hidden: Number(row.hidden ?? 0),
      })),
  };
}

export function projectionSha256(projection) {
  return sha256(canonicalJson(projection));
}

/**
 * Classify migration_runs rows ({ id, status, report }) against the fresh-install receipts. Only
 * counts and SHA-256s leave this function: an unexpected run is named by the hash of its id.
 */
export function classifyMigrationRuns(rows = []) {
  let freshInstallReceipts = 0;
  const unexpectedIdSha256s = [];
  for (const row of rows) {
    const known = FIC_FRESH_INSTALL_MIGRATION_RECEIPTS.find((receipt) => receipt.id === row?.id);
    if (known && row.status === known.status && row.report === known.report) freshInstallReceipts += 1;
    else unexpectedIdSha256s.push(sha256(String(row?.id ?? '')));
  }
  return {
    runs: rows.length,
    freshInstallReceipts,
    unexpected: unexpectedIdSha256s.length,
    unexpectedIdSha256s: unexpectedIdSha256s.sort(),
  };
}

/* ------------------------------------------------------------------------------------ */
/* Guard                                                                                 */
/* ------------------------------------------------------------------------------------ */

function within(parent, child, pathApi) {
  const relative = pathApi.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative));
}

/**
 * The live state directories a fresh-install run must never touch: ~/.openclaw, every profile
 * directory ~/.openclaw-<profile> (src/cli/profile-utils.ts:26-37), the legacy ~/.clawdbot
 * (src/config/state-dir.ts:10-12), and the operator's own OPENCLAW_STATE_DIR when set.
 */
export function liveStateDirs({ home, environment = {}, fsApi, pathApi }) {
  const dirs = new Set([pathApi.join(home, '.openclaw'), pathApi.join(home, '.clawdbot')]);
  try {
    for (const entry of fsApi.readdirSync(home)) {
      if (/^\.openclaw-/u.test(entry)) dirs.add(pathApi.join(home, entry));
    }
  } catch {
    // An unreadable home still refuses the default and legacy directories.
  }
  const override = environment.OPENCLAW_STATE_DIR?.trim();
  if (override && pathApi.isAbsolute(override)) dirs.add(pathApi.resolve(override));
  return [...dirs].sort();
}

/**
 * Decide whether a run may start. Every check fails closed; nothing is created here. `fsApi`
 * supplies existsSync/readFileSync/realpathSync/lstatSync/readdirSync so tests can point `home`
 * at a temporary tree.
 *
 * Returns { refusals, target }. `target` carries what the driver needs: the resolved state
 * directory (and whether it must be created), the stage and its build identity, the port and the
 * live ports refused.
 */
export function evaluateFreshInstallTarget({
  stateDir,
  stageDir,
  candidateSha,
  port,
  home,
  environment = {},
  fsApi,
  pathApi,
  portListening,
}) {
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  const target = {};
  const real = (file) => {
    try {
      return fsApi.realpathSync(file);
    } catch {
      return null;
    }
  };

  if (!isSha40(candidateSha)) refuse('candidate-sha-invalid', 'candidate SHA must be 40 lowercase hex');
  if (typeof home !== 'string' || !pathApi.isAbsolute(home)) {
    refuse('home-invalid', 'home must be an absolute path');
    return { refusals, target };
  }
  const homeReal = real(home) ?? home;
  const live = liveStateDirs({ home: homeReal, environment, fsApi, pathApi }).map((dir) => real(dir) ?? dir);

  /* model credentials: the operator's own environment, keys only */
  const credentialKeys = modelCredentialKeys(environment);
  if (credentialKeys.length) {
    refuse('model-credentials-in-environment', `the environment carries model credentials (${credentialKeys.join(', ')}); run from a shell without them`);
  }
  target.environmentCredentialKeys = credentialKeys;

  /* the fresh state directory */
  if (typeof stateDir !== 'string' || !pathApi.isAbsolute(stateDir)) {
    refuse('state-dir-invalid', '--state-dir must be an absolute path');
  } else {
    let stat = null;
    try {
      stat = fsApi.lstatSync(stateDir);
    } catch {
      stat = null;
    }
    // A missing directory is created by the control; its nearest existing ancestor is what the
    // live-state comparison resolves.
    let probe = stateDir;
    while (!real(probe) && pathApi.dirname(probe) !== probe) probe = pathApi.dirname(probe);
    const resolved = stat ? real(stateDir) : pathApi.join(real(probe) ?? probe, pathApi.relative(probe, stateDir));
    if (stat?.isSymbolicLink()) refuse('state-dir-symlinked', 'the state directory must not be a symlink');
    else if (stat && !stat.isDirectory()) refuse('state-dir-not-directory', 'the state directory exists and is not a directory');
    else if (stat) {
      let entries = [];
      try {
        entries = fsApi.readdirSync(stateDir);
      } catch {
        refuse('state-dir-unreadable', 'the state directory cannot be listed');
      }
      if (entries.length > 0) refuse('state-dir-not-empty', `the state directory holds ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}; a fresh install starts from an empty one`);
    }
    if (resolved && live.some((dir) => within(dir, resolved, pathApi) || within(resolved, dir, pathApi))) {
      refuse('state-dir-live', 'the state directory is, or overlaps, a live OpenClaw state directory (~/.openclaw, ~/.openclaw-<profile>, ~/.clawdbot or $OPENCLAW_STATE_DIR)');
    }
    if (resolved && within(resolved, homeReal, pathApi)) refuse('state-dir-live', 'the state directory must not contain the home directory');
    target.stateDir = resolved ?? stateDir;
    target.stateDirExisted = Boolean(stat);
  }

  /* the port */
  const livePorts = new Set([LIVE_GATEWAY_DEFAULT_PORT]);
  for (const dir of live) {
    try {
      const config = JSON.parse(fsApi.readFileSync(pathApi.join(dir, 'openclaw.json'), 'utf8'));
      if (positiveInteger(config?.gateway?.port)) livePorts.add(config.gateway.port);
    } catch {
      // No readable live config: the default port stays refused.
    }
  }
  target.livePorts = [...livePorts].sort((a, b) => a - b);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
    refuse('port-invalid', '--port must be an unprivileged TCP port (1024-65535)');
  } else if (livePorts.has(port)) {
    refuse('port-is-live', `port ${port} belongs to a live gateway`);
  } else if (portListening(port)) {
    refuse('port-in-use', `something already listens on ${port}`);
  }
  target.port = port;

  /* the staged runtime */
  if (typeof stageDir !== 'string' || !pathApi.isAbsolute(stageDir)) {
    refuse('stage-dir-invalid', '--stage-dir must be an absolute path');
  } else {
    const stageReal = real(stageDir);
    if (!stageReal) {
      refuse('stage-dir-missing', 'the stage directory does not exist');
    } else {
      if (live.some((dir) => within(dir, stageReal, pathApi))) refuse('stage-dir-live', 'the stage must not live under a live state directory');
      let buildInfo = null;
      try {
        buildInfo = JSON.parse(fsApi.readFileSync(pathApi.join(stageReal, 'dist', 'build-info.json'), 'utf8'));
      } catch {
        refuse('stage-build-info-missing', 'dist/build-info.json is missing from the stage');
      }
      if (buildInfo && buildInfo.commit !== candidateSha) {
        refuse('stage-build-mismatch', 'the stage dist/build-info.json commit is not the candidate SHA');
      }
      if (!fsApi.existsSync(pathApi.join(stageReal, 'dist', 'index.js'))) refuse('stage-entry-missing', 'dist/index.js is missing from the stage');
      target.stageDir = stageReal;
      target.stageBuild = {
        commit: typeof buildInfo?.commit === 'string' ? buildInfo.commit : null,
        buildId: typeof buildInfo?.buildId === 'string' ? buildInfo.buildId : null,
        version: typeof buildInfo?.version === 'string' ? buildInfo.version : null,
      };
      if (target.stateDir && within(stageReal, target.stateDir, pathApi)) refuse('state-dir-in-stage', 'the state directory must not live inside the stage');
    }
  }
  target.liveStateDirCount = live.length;
  return { refusals, target };
}

/* ------------------------------------------------------------------------------------ */
/* Grader                                                                                */
/* ------------------------------------------------------------------------------------ */

const VERDICT_RANK = Object.freeze({ 'FAIL-candidate': 0, 'MISSING-candidate': 1, 'PARTIAL-candidate': 2, 'PASS-candidate': 3 });

export function lowerVerdict(a, b) {
  return VERDICT_RANK[a] <= VERDICT_RANK[b] ? a : b;
}

/**
 * Grade one fresh-install record. Every receipt is judged on its own: `present` (the record
 * carries it) and `holds` (it shows what a fresh install must). The verdict starts at PASS and
 * only moves down:
 * - FAIL-candidate when a present receipt contradicts a fresh install (wrong schema version, an
 *   upgrade path in the journal, a drifted authority table, not exactly one epoch row, a model
 *   credential, an invalid config, an unclean stop, residue after cleanup, a gateway that never
 *   served);
 * - MISSING-candidate when a receipt is absent: there is nothing to judge;
 * - PARTIAL-candidate when everything holds but a bound is missing (unsigned record, dirty docs
 *   harness, no staged buildId to compare, timings not recorded).
 * Any missing receipt therefore keeps the record below PASS-candidate.
 */
export function gradeFreshInstallControl(record) {
  const failures = [];
  const missing = [];
  const partials = [];
  const fail = (code, detail) => failures.push({ code, detail });
  const miss = (code, detail) => missing.push({ code, detail });
  const partial = (code, detail) => partials.push({ code, detail });
  const observations = {};
  const observe = (name, present, holds) => {
    observations[name] = { present: Boolean(present), holds: Boolean(present && holds) };
  };

  if (record?.schema !== FIC_SCHEMA || record?.row !== FIC_ROW) fail('record-identity', 'record schema or row is not this control');
  if (!isSha40(record?.candidateSha) || !isSha40(record?.docsSha)) fail('sha-identity', 'candidate and docs SHAs must both be 40-hex');
  if (record?.docs?.clean !== true || record?.docs?.sha !== record?.docsSha) partial('docs-harness-dirty', 'the docs harness was not the clean checkout the record names');

  const target = record?.target ?? {};
  const gateway = record?.gateway ?? {};
  const storage = record?.storage ?? {};
  const authority = record?.authority ?? {};

  /* runtime-build-info */
  {
    const build = target.stageBuild ?? {};
    const present = typeof build.commit === 'string';
    observe('runtime-build-info', present, present && build.commit === record?.candidateSha);
    if (!present) miss('runtime-build-info-missing', 'the staged runtime build-info was not recorded');
    else if (build.commit !== record?.candidateSha) fail('runtime-not-candidate', 'the staged runtime build-info commit is not the candidate');
  }

  /* state-dir-empty-proof */
  {
    const state = target.stateDir ?? {};
    const home = target.home ?? {};
    const config = target.config ?? {};
    const present = typeof state.emptyAtStart === 'boolean' && nonNegativeInteger(state.entriesAtStart);
    const keysMatch = Array.isArray(config.keys) && canonicalJson(config.keys) === canonicalJson([...FIC_CONFIG_KEYS]);
    const holds =
      state.emptyAtStart === true &&
      state.entriesAtStart === 0 &&
      home.controlOwned === true &&
      home.entriesAtStart === 0 &&
      config.mode === '0600' &&
      keysMatch &&
      isHex64(config.sha256);
    observe('state-dir-empty-proof', present, holds);
    if (!present) miss('state-dir-proof-missing', 'no listing of the state directory before the first boot was recorded');
    else if (!holds) fail('state-not-fresh', 'the state directory, the gateway home or the minimal config was not fresh and control-owned at start');
  }

  /* readiness */
  const ready = finiteTime(gateway.readyAtMs);
  {
    const stageBuildId = target.stageBuild?.buildId ?? null;
    const holds =
      ready &&
      positiveInteger(gateway.listen?.inode) &&
      gateway.readyz?.status === 200 &&
      gateway.readyz?.ready === true &&
      gateway.startupz?.status === 200 &&
      gateway.startupz?.startup === 'started' &&
      isHex64(gateway.hello?.bootIdSha256) &&
      (stageBuildId === null || gateway.hello?.buildId === stageBuildId);
    observe('readiness', ready, holds);
    if (!ready) {
      if (gateway.started === true) fail('gateway-not-ready', `the fresh gateway never served (${gateway.failure?.kind ?? 'not ready'})`);
      else miss('gateway-not-started', 'no gateway process was started');
    } else if (!holds) {
      fail('readiness-incomplete', 'the gateway did not own the listener with /readyz, /startupz and hello-ok all passing, or reported another buildId');
    } else if (stageBuildId === null) {
      partial('build-id-unbound', 'the stage carries no buildId, so hello-ok cannot be bound to the staged build');
    }
  }

  /* agent-schema-version */
  {
    const agent = storage.agentDatabase ?? {};
    const meta = agent.schemaMeta ?? {};
    const present = agent.present === true && Number.isSafeInteger(agent.userVersion);
    const holds =
      agent.userVersion === FIC_AGENT_SCHEMA_VERSION &&
      meta.present === true &&
      meta.role === 'agent' &&
      meta.schemaVersion === FIC_AGENT_SCHEMA_VERSION &&
      meta.agentIdMatches === true &&
      meta.createdEqualsUpdated === true;
    observe('agent-schema-version', present, holds);
    if (!present) miss('agent-database-unread', `the fresh agent database was not read${agent.error ? ` (${agent.error})` : ''}`);
    else if (!holds) fail('agent-schema-not-canonical', `the agent database is not at schema ${FIC_AGENT_SCHEMA_VERSION} by canonical creation (user_version ${agent.userVersion}, schema_meta ${meta.schemaVersion ?? 'absent'})`);
  }

  /* no-upgrade-path */
  {
    const state = storage.stateDatabase ?? {};
    const runs = state.migrationRuns ?? {};
    const present =
      state.present === true &&
      nonNegativeInteger(runs.runs) &&
      nonNegativeInteger(runs.unexpected) &&
      nonNegativeInteger(state.migrationSources) &&
      nonNegativeInteger(state.backupRuns) &&
      nonNegativeInteger(state.agentRegistry?.mismatched);
    const holds = runs.unexpected === 0 && state.migrationSources === 0 && state.backupRuns === 0 && state.agentRegistry?.mismatched === 0;
    observe('no-upgrade-path', present, holds);
    if (!present) miss('migration-journal-unread', `the state database's migration journal was not read${state.error ? ` (${state.error})` : ''}`);
    else if (!holds) {
      fail('upgrade-path-recorded', `the journal shows an upgrade or import path (${runs.unexpected} unexpected run(s), ${state.migrationSources} source(s), ${state.backupRuns} backup run(s), ${state.agentRegistry?.mismatched} agent database(s) registered below schema ${FIC_AGENT_SCHEMA_VERSION})`);
    }
  }

  /* authority-table-column-hash */
  {
    const table = storage.authorityTable ?? {};
    const present = typeof table.present === 'boolean';
    const holds = table.present === true && table.columnsSha256 === FIC_AUTHORITY_COLUMNS_SHA256;
    observe('authority-table-column-hash', present, holds);
    if (!present) miss('authority-table-unread', 'the agent database schema was not read for session_recipient_authority');
    else if (table.present !== true) fail('authority-table-missing', 'the fresh agent database has no session_recipient_authority table');
    else if (!holds) fail('authority-table-drift', 'session_recipient_authority does not have the byte-walked columns');
  }

  /* authority-epoch-row-hash */
  {
    const established = authority.createOk === true && authority.visibilityOk === true;
    const present = established && Number.isSafeInteger(authority.rowsAfterNarrowing);
    const holds =
      authority.readOnly === true &&
      authority.rowsBeforeCreate === 0 &&
      authority.rowsAfterNarrowing === 1 &&
      authority.keyRow?.present === true &&
      isHex64(authority.sessionKeySha256) &&
      isHex64(authority.epochSha256);
    observe('authority-epoch-row-hash', present, holds);
    if (!established) miss('authority-not-established', `sessions.create and the narrowing did not both succeed${authority.error ? ` (${authority.error})` : ''}`);
    else if (!present) miss('authority-rows-unread', 'the epoch rows were not read after the narrowing');
    else if (!holds) {
      fail('epoch-row-not-single', `sessions.create then the narrowing did not write exactly one epoch row bound to the created session (before ${authority.rowsBeforeCreate}, after ${authority.rowsAfterNarrowing})`);
    }
  }

  /* no-model-sign-in */
  {
    const environ = gateway.environ ?? {};
    const agent = storage.agentDatabase ?? {};
    const present = Array.isArray(environ.credentialKeys) && typeof environ.homeControlOwned === 'boolean' && nonNegativeInteger(agent.authProfileRows);
    const holds =
      present &&
      environ.credentialKeys.length === 0 &&
      environ.homeControlOwned === true &&
      agent.authProfileRows === 0 &&
      Array.isArray(target.environmentCredentialKeys) &&
      target.environmentCredentialKeys.length === 0;
    observe('no-model-sign-in', present, holds);
    if (!present) miss('model-sign-in-unobserved', 'the gateway environment or the agent auth profiles were not read');
    else if (!holds) fail('model-credentials-present', 'a model credential reached the gateway or an auth profile exists');
  }

  /* config-validate */
  {
    const validate = record?.configValidate ?? {};
    const present = validate.ran === true;
    const holds = validate.exit?.code === 0 && validate.valid === true && validate.pathMatches === true;
    observe('config-validate', present, holds);
    if (!present) miss('config-validate-not-run', 'openclaw config validate was not run on the fresh config');
    else if (!holds) fail('config-invalid', `openclaw config validate did not pass (exit ${validate.exit?.code ?? 'none'}, valid ${validate.valid})`);
  }

  /* clean-stop */
  {
    const stop = record?.stop ?? {};
    const present = finiteTime(stop.signalledAtMs);
    const holds =
      stop.exit?.code === 0 &&
      stop.escalatedToSigkill === false &&
      stop.shutdownDeadlineReached === false &&
      stop.portReleased === true &&
      stop.leftoverProcesses === 0;
    observe('clean-stop', present, holds);
    if (!present) miss('stop-not-requested', 'the gateway was not stopped by the control');
    else if (!holds) {
      fail('stop-not-clean', `the gateway did not stop cleanly on SIGTERM (exit ${JSON.stringify(stop.exit ?? null)}, SIGKILL ${stop.escalatedToSigkill}, leftover processes ${stop.leftoverProcesses})`);
    }
  }

  /* timings */
  {
    const timings = record?.timings ?? {};
    const present = ['bootMs', 'establishMs', 'stopMs', 'totalMs'].every((key) => finiteTime(timings[key]));
    observe('timings', present, present);
    if (!present) partial('timings-missing', 'the run timings were not recorded');
  }

  /* signed-cleanup-receipt */
  {
    const cleanup = record?.cleanup ?? {};
    const present = cleanup.completed === true;
    const holds =
      Array.isArray(cleanup.residualPids) &&
      cleanup.residualPids.length === 0 &&
      Array.isArray(cleanup.unverifiedPids) &&
      cleanup.unverifiedPids.length === 0 &&
      cleanup.portReleased === true &&
      cleanup.stateRemoved === true &&
      cleanup.homeRemoved === true &&
      cleanup.configRemoved === true;
    const signed = record?.observerKey?.available === true;
    observe('signed-cleanup-receipt', present && signed, holds);
    if (!present) miss('cleanup-not-recorded', 'no cleanup record');
    else if (!holds) fail('cleanup-residue', 'cleanup left a process, the listener, the disposable state, the gateway home or the config behind');
    if (present && !signed) partial('receipt-unsigned', 'the cleanup record is not signed with the observer key');
  }

  for (const error of Array.isArray(record?.errors) ? record.errors : []) {
    partial('control-error', `the control recorded an error at ${error?.at ?? 'unknown'}`);
  }

  const missingReceipts = FIC_RECEIPTS.filter((name) => !observations[name]?.present);
  let verdict = 'PASS-candidate';
  if (partials.length) verdict = lowerVerdict(verdict, 'PARTIAL-candidate');
  if (missing.length || missingReceipts.length) verdict = lowerVerdict(verdict, 'MISSING-candidate');
  if (failures.length) verdict = lowerVerdict(verdict, 'FAIL-candidate');
  return {
    row: FIC_ROW,
    verdict,
    corpusStateCeiling: CORPUS_STATE_CEILING[verdict],
    observations,
    missingReceipts,
    failures,
    missing,
    partials,
    namedLimits: [...FIC_NAMED_LIMITS],
  };
}

/** What this row never claims, listed on every grade. */
export const FIC_NAMED_LIMITS = Object.freeze(['no-upgrade-path-exercised', 'no-model-turn', 'no-delegate-delivery']);

/* ------------------------------------------------------------------------------------ */
/* Observer receipt                                                                      */
/* ------------------------------------------------------------------------------------ */

export function observerKeyFingerprint(key) {
  return sha256(`${FIC_OBSERVER_ALGORITHM}\0${key}`).slice(0, 16);
}

// The signature covers every field except the integrity block itself.
function unsignedCanonical(value) {
  const { integrity: _integrity, ...unsigned } = value;
  return canonicalJson(unsigned);
}

export function sealObserverReceipt(receipt, key) {
  return sealSignedObserverReceipt({ receipt, signingKey: key, canonicalize: unsignedCanonical, algorithm: FIC_OBSERVER_ALGORITHM });
}

export function verifyObserverReceipt(receipt, key) {
  if (!receipt || typeof receipt !== 'object') return false;
  return validateSignedObserverReceiptIntegrity({ receipt, signingKey: key, canonicalize: unsignedCanonical, algorithm: FIC_OBSERVER_ALGORITHM });
}
