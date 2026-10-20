/**
 * isolated-gateway.mjs — pure contract for the scheduled exact-deployed-build
 * baseline (#587).
 *
 * The baseline never targets a prince's live gateway. It starts a second,
 * throwaway gateway process from the seat's own installed dist (so the bytes
 * under test are exactly the deployed build), with its own config file, state
 * directory, HOME, loopback port and ephemeral token, and no channels. This
 * module holds everything about that recipe that can be decided without a
 * process: build identity, the rendered config, the redacted public view, and
 * the post-launch isolation checks applied to the gateway's own config.get.
 *
 * The side-effecting half (systemd-run, health polling, teardown) lives in
 * scripts/isolated-gateway.mjs and is driven through injectable seams.
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';

export const PROFILE_SCHEMA = 'openclaw.k6.isolated-gateway-profile.v1';
export const RECEIPT_SCHEMA = 'openclaw.k6.isolated-gateway.v1';
export const TEARDOWN_SCHEMA = 'openclaw.k6.isolated-gateway-teardown.v1';
export const BUILD_SCHEMA = 'openclaw.k6.deployed-build.v1';

// Install dirs the fleet deploys to, in deploy-gateway.yml's probe order
// (openclaw-bootstrap). The first one with a dist/build-info.json is the build
// the live gateway runs; the baseline must prove that same directory.
export const DEFAULT_INSTALL_DIR_CANDIDATES = Object.freeze([
  '~/flesh_beast_tmp/openclaw',
  '~/.openclaw/workspace/openclaw',
  '~/flesh_beast_best_beast/openclaw',
]);

// The live gateway service on every seat. Teardown proves it was not touched.
export const LIVE_GATEWAY_UNIT = 'openclaw-gateway.service';

/**
 * The seat job's own budget (workflow timeout-minutes) and the transient unit's
 * finite backstop. RuntimeMaxSec must outlast a normal suite — a shorter one
 * would stop the gateway mid-run and turn a healthy night into a partial — but
 * must stay finite so a job that dies before teardown cannot leave the gateway
 * running forever. The grace is small enough that an orphan is gone well inside
 * the next run's peer wait (one hour), so it cannot block the following fire.
 * A contract test keeps these in step with the workflow.
 */
export const JOB_TIMEOUT_MINUTES = 150;
export const RUNTIME_GRACE_SEC = 900;
export const DEFAULT_RUNTIME_MAX_SEC = JOB_TIMEOUT_MINUTES * 60 + RUNTIME_GRACE_SEC;

/**
 * Environment the isolated unit sets for itself. Nothing else may define these:
 * a provider EnvironmentFile that did would point the gateway at the seat's live
 * config, state or HOME, or replace its ephemeral token.
 */
export const ISOLATION_ENV_KEYS = Object.freeze([
  'HOME',
  'OPENCLAW_CONFIG_PATH',
  'OPENCLAW_STATE_DIR',
  'OPENCLAW_GATEWAY_TOKEN',
  'OPENCLAW_GATEWAY_PORT',
]);

// Channel credentials a user manager may have imported. They are stripped from
// the isolated unit so no channel can connect even if config were wrong.
// UnsetEnvironment= is applied after EnvironmentFile=, so nothing the isolated
// unit sets for itself may appear here.
export const CHANNEL_ENV_DENYLIST = Object.freeze([
  'DISCORD_BOT_TOKEN',
  'DISCORD_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'OPENCLAW_GATEWAY_PASSWORD',
]);

const SHA = /^[0-9a-f]{40}$/u;
const PUBLIC_ID = /^[a-z0-9][a-z0-9-]{0,39}$/u;
const MODEL_REF = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._:/-]+$/u;
const SERVICE_NAME = /^[A-Za-z0-9._:/-]+$/u;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function expandHome(value, home) {
  if (typeof value !== 'string') return value;
  if (value === '~') return home;
  return value.startsWith('~/') ? `${home}${value.slice(1)}` : value;
}

/**
 * Validate a dist/build-info.json payload as the deployed runtime identity.
 * Returns { ok, commit, buildId, version, builtAt, notes }.
 */
export function evaluateBuildInfo(buildInfo, { packageDistCount = null, otelDistPresent = null } = {}) {
  const notes = [];
  const commit = typeof buildInfo?.commit === 'string' ? buildInfo.commit.trim().toLowerCase() : '';
  if (!SHA.test(commit)) notes.push('build-info-commit-invalid');
  // hello.server.buildId is read from build-info.buildId (src/version.ts); the
  // default buildId embeds commit[0:12]. Readiness binds the runtime SHA by that
  // prefix, so a build whose buildId lacks it can never prove its identity.
  // An absent buildId is the same dead end — refuse it here rather than after a
  // gateway has been started and failed `runtime-sha-not-observed`.
  const buildId = typeof buildInfo?.buildId === 'string' && buildInfo.buildId !== '' ? buildInfo.buildId : null;
  if (buildId === null) notes.push('build-info-buildid-missing');
  else if (SHA.test(commit) && !buildId.includes(commit.slice(0, 12))) {
    notes.push('build-info-buildid-lacks-commit');
  }
  if (packageDistCount !== null && packageDistCount < 1) notes.push('package-dists-missing');
  if (otelDistPresent === false) notes.push('diagnostics-otel-dist-missing');
  return {
    ok: notes.length === 0,
    commit: SHA.test(commit) ? commit : null,
    buildId,
    version: typeof buildInfo?.version === 'string' ? buildInfo.version : null,
    builtAt: typeof buildInfo?.builtAt === 'string' ? buildInfo.builtAt : null,
    packageDistCount,
    otelDistPresent,
    notes,
  };
}

/** Seat-local profile: model wiring the isolated gateway needs. Never committed. */
export function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') return ['profile-not-object'];
  if (profile.schema !== PROFILE_SCHEMA) errors.push('profile-schema-mismatch');
  if (!MODEL_REF.test(profile.model ?? '')) errors.push('profile-model-invalid');
  if (profile.altModel !== undefined && !MODEL_REF.test(profile.altModel)) errors.push('profile-alt-model-invalid');
  if (!profile.models || typeof profile.models !== 'object') errors.push('profile-models-missing');
  const continuation = profile.continuation;
  for (const key of ['maxChainLength', 'maxDelegatesPerTurn', 'costCapTokens']) {
    if (!Number.isInteger(continuation?.[key]) || continuation[key] < 1) errors.push(`profile-continuation-${key}-invalid`);
  }
  if (!Number.isInteger(profile.maxSpawnDepth) || profile.maxSpawnDepth < 2) errors.push('profile-max-spawn-depth-invalid');
  if (typeof profile.otel?.endpoint !== 'string' || !/^https?:\/\//u.test(profile.otel.endpoint)) {
    errors.push('profile-otel-endpoint-invalid');
  }
  if (profile.channels !== undefined) errors.push('profile-must-not-configure-channels');
  return errors;
}

export function unitName({ seat, runId }) {
  if (!PUBLIC_ID.test(seat ?? '')) throw new Error(`seat must match ${PUBLIC_ID}`);
  const id = String(runId ?? '').replace(/[^A-Za-z0-9]/gu, '').slice(0, 24);
  if (!id) throw new Error('runId is required');
  return `openclaw-k6-iso-${seat}-${id}.service`;
}

export function serviceName(seat) {
  const name = `${seat}-k6-isolated`;
  if (!SERVICE_NAME.test(name)) throw new Error('unsafe service name');
  return name;
}

/**
 * The isolated config. No `channels` key at all: nothing can connect to Discord
 * or any other channel. Continuation, spawn depth and diagnostics-otel are set
 * explicitly so readiness and trace receipts are obtainable.
 */
export function renderIsolatedConfig(profile, { port, token, workspaceDir, seat }) {
  return {
    gateway: {
      mode: 'local',
      bind: 'loopback',
      port,
      auth: { mode: 'token', token },
    },
    agents: {
      defaults: {
        model: profile.model,
        workspace: workspaceDir,
        subagents: { maxSpawnDepth: profile.maxSpawnDepth },
        continuation: {
          enabled: true,
          maxChainLength: profile.continuation.maxChainLength,
          maxDelegatesPerTurn: profile.continuation.maxDelegatesPerTurn,
          costCapTokens: profile.continuation.costCapTokens,
        },
      },
    },
    models: profile.models,
    diagnostics: {
      enabled: true,
      otel: {
        enabled: true,
        endpoint: profile.otel.endpoint,
        protocol: 'http/protobuf',
        serviceName: serviceName(seat),
        traces: true,
        metrics: true,
        logs: false,
      },
    },
    plugins: { entries: { 'diagnostics-otel': { enabled: true } } },
  };
}

/**
 * What may be published about the isolated config (the docs repository and
 * its artifacts are public): the settings rows depend on, never tokens,
 * provider URLs, endpoints or local paths.
 */
export function publicConfigSummary(config) {
  const defaults = config.agents?.defaults ?? {};
  return {
    gateway: { mode: config.gateway?.mode, bind: config.gateway?.bind, authMode: config.gateway?.auth?.mode },
    channels: config.channels === undefined ? 'none' : Object.keys(config.channels).sort(),
    model: defaults.model,
    providers: Object.keys(config.models?.providers ?? {}).sort(),
    maxSpawnDepth: defaults.subagents?.maxSpawnDepth,
    continuation: defaults.continuation,
    diagnosticsOtel: {
      enabled: config.diagnostics?.enabled === true && config.diagnostics?.otel?.enabled === true,
      plugin: config.plugins?.entries?.['diagnostics-otel']?.enabled === true,
      protocol: config.diagnostics?.otel?.protocol,
      serviceName: config.diagnostics?.otel?.serviceName,
    },
    digest: configDigest(config),
  };
}

export function configDigest(config) {
  return sha256(canonicalJson(config));
}

function enabledChannels(config) {
  const channels = config?.channels;
  if (!channels || typeof channels !== 'object') return [];
  return Object.entries(channels)
    .filter(([, entry]) => entry && typeof entry === 'object' && entry.enabled !== false)
    .map(([name]) => name)
    .sort();
}

/**
 * Checks on the isolated gateway's own authenticated config.get, run after
 * launch. `rpc` is the result of target-readiness.inspectTarget: it already
 * refuses a payload whose configRevisionHash differs from appliedConfigHash, so
 * an authenticated result means the applied config equals the persisted one.
 */
export function evaluateIsolation({ rpc, expectedSha, expectedServiceName, expectedDepth }) {
  const notes = [];
  if (rpc?.authenticated !== true) {
    notes.push(rpc?.error || 'isolated-rpc-unreachable');
    return { ok: false, notes, channels: null };
  }
  const effective = rpc.config?.config;
  const source = rpc.config?.sourceConfig;
  const buildId = rpc.responseIdentity?.buildId;
  if (!SHA.test(expectedSha ?? '') || typeof buildId !== 'string' || !buildId.includes(expectedSha.slice(0, 12))) {
    notes.push('runtime-sha-not-observed');
  }
  const channels = [...new Set([...enabledChannels(effective), ...enabledChannels(source)])];
  if (channels.length > 0) notes.push(`channels-enabled:${channels.join(',')}`);
  const otel = effective?.diagnostics?.otel;
  if (effective?.diagnostics?.enabled !== true || otel?.enabled !== true) notes.push('diagnostics-otel-config-disabled');
  if (otel?.serviceName !== expectedServiceName) notes.push('diagnostics-otel-service-name-mismatch');
  if (effective?.plugins?.entries?.['diagnostics-otel']?.enabled !== true) notes.push('diagnostics-otel-plugin-disabled');
  if (effective?.agents?.defaults?.subagents?.maxSpawnDepth !== expectedDepth) notes.push('effective-depth-unexpected');
  if (effective?.agents?.defaults?.continuation?.enabled !== true) notes.push('continuation-disabled');
  if (rpc.responseIdentity?.configRevisionHash !== rpc.responseIdentity?.appliedConfigHash) {
    notes.push('applied-config-differs-from-persisted');
  }
  return { ok: notes.length === 0, notes, channels };
}

/**
 * Lines for a 0600 env file read both by systemd (EnvironmentFile=) and by the
 * workflow's bash (`set -a; . file`). Values are double-quoted, so anything
 * either reader would expand or unescape is refused rather than escaped.
 */
export function environmentFile(vars) {
  return Object.entries(vars)
    .map(([key, value]) => {
      const text = String(value);
      if (!/^[A-Z_][A-Z0-9_]*$/u.test(key) || /[\n\r"\\$`%]/u.test(text)) throw new Error(`unsafe env entry ${key}`);
      return `${key}="${text}"`;
    })
    .join('\n')
    .concat('\n');
}

/**
 * Keys an EnvironmentFile= would define, by systemd's own syntax: KEY=VALUE
 * lines, `#`/`;` comments, an optional `export` prefix. Line continuations are
 * not followed, so a continued value that looks like an assignment is reported
 * as a key too: this feeds a refusal, and over-refusing a credentials file is
 * the safe direction.
 */
export function environmentFileKeys(text) {
  const keys = [];
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(trimmed);
    if (match) keys.push(match[1]);
  }
  return [...new Set(keys)];
}

/**
 * Keys in a seat's provider EnvironmentFile that the isolated unit must own.
 * UnsetEnvironment= already strips the channel credentials after every
 * EnvironmentFile=, but a file that carries them has no business near this
 * gateway either, so both sets are refused by name before anything starts.
 */
export function environmentFileConflicts(text) {
  const keys = new Set(environmentFileKeys(text));
  return {
    isolation: ISOLATION_ENV_KEYS.filter((key) => keys.has(key)),
    channels: CHANNEL_ENV_DENYLIST.filter((key) => keys.has(key)),
  };
}

/**
 * The systemd-run argv. RuntimeMaxSec is the backstop: even when the job dies
 * before teardown, systemd stops the isolated gateway on its own.
 *
 * The seat's optional provider EnvironmentFile comes first and the isolated
 * env file last, because systemd lets a later EnvironmentFile= override an
 * earlier one. The isolated HOME, config path, state dir, token and port are
 * therefore authoritative whatever the provider file says — and `up` refuses a
 * provider file that names them at all (environmentFileConflicts).
 */
export function systemdRunArgs({ unit, envFile, extraEnvFile, rootDir, node, entry, port, runtimeMaxSec = DEFAULT_RUNTIME_MAX_SEC }) {
  if (!Number.isInteger(runtimeMaxSec) || runtimeMaxSec <= JOB_TIMEOUT_MINUTES * 60) {
    throw new Error(`runtimeMaxSec must outlast the ${JOB_TIMEOUT_MINUTES}-minute job budget`);
  }
  const args = [
    '--user',
    `--unit=${unit}`,
    '--collect',
    '--quiet',
  ];
  if (extraEnvFile) args.push(`--property=EnvironmentFile=${extraEnvFile}`);
  args.push(
    `--property=EnvironmentFile=${envFile}`,
    `--property=UnsetEnvironment=${CHANNEL_ENV_DENYLIST.join(' ')}`,
    `--property=WorkingDirectory=${rootDir}`,
    `--property=RuntimeMaxSec=${runtimeMaxSec}`,
    '--property=TimeoutStopSec=30',
    node,
    entry,
    'gateway',
    'run',
    '--port',
    String(port),
    '--bind',
    'loopback',
  );
  return args;
}
