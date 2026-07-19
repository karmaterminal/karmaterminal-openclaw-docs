#!/usr/bin/env node
/**
 * seat-readiness-preflight.mjs — public-safe seat/tooling readiness report.
 *
 * This is intentionally a Node helper, not a k6 row. It runs before proof rows
 * so a bad seat/tooling environment becomes PARTIAL-candidate instead of
 * being confused with product behavior.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const DEFAULT_POLICY_PATH = join(REPO_ROOT, 'tools/k6-proofs/seat-readiness.policy.json');
const SECRET_NAME_PATTERN = /(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|COOKIE|AUTH)/i;

function loadPolicy(policyPath = DEFAULT_POLICY_PATH) {
  const raw = readFileSync(policyPath, 'utf8');
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const out = { gateway: true };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--no-gateway') out.gateway = false;
    else if (arg === '--expected-k6-version') out.expectedK6Version = argv[++i];
    else if (arg === '--policy') out.policyPath = argv[++i];
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`unknown arg: ${arg}`);
  }
  return out;
}

function usage() {
  console.log(`Usage: node tools/k6-proofs/scripts/seat-readiness-preflight.mjs [--json] [--no-gateway] [--policy path] [--expected-k6-version v2.0.0]\n\nEmits no secret values. Exit 0 only for PASS-candidate. Version/env defaults come from tools/k6-proofs/seat-readiness.policy.json.`);
}

function commandOrNull(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function jsonCommandOrNull(cmd, args) {
  const run = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.status !== 0) return { ok: false, data: null, error: 'command-failed' };
  try {
    return { ok: true, data: JSON.parse(run.stdout), error: null };
  } catch {
    return { ok: false, data: null, error: 'json-parse-failed' };
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function detectK6(policy) {
  const candidates = unique([
    process.env.K6_BIN,
    ...(policy.k6?.binaryCandidates || []),
    commandOrNull('which', ['k6']),
  ]);

  const checked = [];
  for (const path of candidates) {
    if (!existsSync(path)) {
      checked.push({ path, exists: false, version: null, rawVersion: null });
      continue;
    }
    const rawVersion = commandOrNull(path, ['version']);
    const version = rawVersion && rawVersion.match(/\bv\d+\.\d+\.\d+\b/)?.[0] || null;
    checked.push({ path, exists: true, version, rawVersion });
    if (version) return { ok: true, path, version, rawVersion, checked };
  }

  return { ok: false, path: null, version: null, rawVersion: null, checked };
}

async function fetchOk(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function httpBaseFromWs(wsUrl) {
  if (!wsUrl) return 'http://127.0.0.1:18789';
  try {
    const url = new URL(wsUrl);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'http://127.0.0.1:18789';
  }
}

function sessionScope(sessionKey) {
  if (!sessionKey) return 'missing';
  if (sessionKey === 'main') return 'main';
  if (/^agent:main(:|$)/.test(sessionKey)) return 'main-agent-session';
  if (/^agent:/.test(sessionKey)) return 'agent-session';
  return 'configured-session';
}

function envReport(policy) {
  return (policy.env || []).map((entry) => ({
    name: entry.name,
    present: Boolean(process.env[entry.name]),
    secret: Boolean(entry.secret) || SECRET_NAME_PATTERN.test(entry.name),
    required: entry.required !== false,
    purpose: entry.purpose || null,
  }));
}

function redactRawVersion(rawVersion) {
  // k6 version output is public-safe today; keep this guard so future tooling
  // that appends build metadata cannot accidentally leak shell/env material.
  if (!rawVersion) return null;
  return rawVersion.replace(/(token|secret|password|authorization|bearer)=[^\s]+/gi, '$1=<redacted>');
}

function readContinuationConfig() {
  const out = jsonCommandOrNull('openclaw', ['config', 'get', 'agents.defaults.continuation', '--json']);
  const config = out.data && typeof out.data === 'object' ? out.data : null;
  return {
    mode: out.ok ? 'checked' : 'unavailable',
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : null,
    maxChainLengthPresent: config && Object.prototype.hasOwnProperty.call(config, 'maxChainLength'),
    maxDelegatesPerTurnPresent: config && Object.prototype.hasOwnProperty.call(config, 'maxDelegatesPerTurn'),
    costCapTokensPresent: config && Object.prototype.hasOwnProperty.call(config, 'costCapTokens'),
    error: out.error,
  };
}

function printText(report) {
  console.log(`seat readiness: ${report.outcome}`);
  console.log(`policy: ${report.policy.name} ${report.policy.version}`);
  console.log(`k6: ${report.k6.version || 'missing'} at ${report.k6.path || '(not found)'} (expected ${report.expectedK6Version})`);
  console.log(`gateway: ${report.gateway.mode}; health=${report.gateway.healthReachable}; status=${report.gateway.statusReachable}; url=${report.gateway.url}`);
  console.log(`continuation: ${report.continuation.mode}; enabled=${report.continuation.enabled}; defaults=${report.continuation.defaultsPresent}`);
  console.log(`candidate sha: ${report.candidate.valid40Hex ? 'valid' : 'missing/invalid'}`);
  console.log(`seat: ${report.seat.name}; session scope: ${report.session.scope}`);
  console.log(`concurrency: ${report.concurrency.safeToRunConcurrently ? 'safe' : 'serialized'} — ${report.concurrency.reason}`);
  const missing = report.env.filter((e) => e.required && !e.present).map((e) => e.name);
  if (missing.length) console.log(`missing required env: ${missing.join(', ')}`);
  for (const note of report.notes) console.log(`note: ${note}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return 0;
  }

  const policy = loadPolicy(args.policyPath);
  const expectedK6Version = args.expectedK6Version || process.env.OPENCLAW_EXPECTED_K6_VERSION || policy.k6.expectedVersion;
  const k6 = detectK6(policy);
  k6.matchesExpected = k6.version === expectedK6Version;
  k6.rawVersion = redactRawVersion(k6.rawVersion);
  k6.checked = k6.checked.map((item) => ({ ...item, rawVersion: redactRawVersion(item.rawVersion) }));

  const gatewayWs = process.env.OPENCLAW_GATEWAY_WS || policy.gateway.defaultWsUrl || 'ws://127.0.0.1:18789';
  const gatewayBase = httpBaseFromWs(gatewayWs);
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  let gateway = { url: gatewayWs, healthReachable: false, statusReachable: false, mode: 'skipped-by-flag' };
  if (args.gateway && !token) {
    gateway = { ...gateway, mode: 'skipped-no-token' };
  } else if (args.gateway) {
    gateway = {
      url: gatewayWs,
      healthReachable: await fetchOk(`${gatewayBase}/health`, token),
      statusReachable: await fetchOk(`${gatewayBase}/status`, token),
      mode: 'checked',
    };
  }

  const continuation = readContinuationConfig();
  continuation.defaultsPresent = Boolean(continuation.maxChainLengthPresent && continuation.maxDelegatesPerTurnPresent && continuation.costCapTokensPresent);

  const candidateSha = process.env.OPENCLAW_CANDIDATE_SHA || null;
  const env = envReport(policy);
  const requiredMissing = env.filter((e) => e.required && !e.present).map((e) => e.name);
  const notes = [];
  if (!k6.ok) notes.push('k6 is not installed or did not report a parseable version.');
  else if (!k6.matchesExpected) notes.push(`k6 version mismatch: expected ${expectedK6Version}, got ${k6.version}.`);
  if (gateway.mode === 'checked' && (!gateway.healthReachable || !gateway.statusReachable)) notes.push('gateway health/status not reachable from this seat.');
  if (gateway.mode === 'skipped-no-token') notes.push('gateway reachability skipped because OPENCLAW_GATEWAY_TOKEN is absent; token value was not printed.');
  if (continuation.mode !== 'checked') notes.push('continuation config could not be read with openclaw config get agents.defaults.continuation --json.');
  else if (continuation.enabled !== true) notes.push('agents.defaults.continuation.enabled is not true; live continuation proof rows must not run.');
  else if (!continuation.defaultsPresent) notes.push('continuation config is missing one or more required default fields.');
  if (requiredMissing.length) notes.push(`missing required env: ${requiredMissing.join(', ')}.`);

  const valid40Hex = typeof candidateSha === 'string' && /^[0-9a-f]{40}$/.test(candidateSha);
  if (!valid40Hex) notes.push('OPENCLAW_CANDIDATE_SHA is missing or not a 40-char lowercase hex SHA.');

  const continuationReady = continuation.mode === 'checked' && continuation.enabled === true && continuation.defaultsPresent;
  const pass = k6.ok && k6.matchesExpected && continuationReady && valid40Hex && requiredMissing.length === 0 && (gateway.mode !== 'checked' || (gateway.healthReachable && gateway.statusReachable));

  const report = {
    schema: 'openclaw.k6.seat-readiness.v1',
    generatedAt: new Date().toISOString(),
    outcome: pass ? 'PASS-candidate' : 'PARTIAL-candidate',
    policy: {
      name: policy.name,
      version: policy.version,
      source: args.policyPath || 'tools/k6-proofs/seat-readiness.policy.json',
    },
    expectedK6Version,
    k6,
    gateway,
    continuation,
    candidate: { sha: candidateSha, valid40Hex },
    seat: {
      name: process.env.OPENCLAW_SEAT_NAME || policy.seat?.defaultName || 'unknown-seat',
      class: process.env.OPENCLAW_SEAT_CLASS || policy.seat?.defaultClass || 'message-body',
    },
    session: { scope: sessionScope(process.env.OPENCLAW_SESSION_KEY) },
    env,
    concurrency: {
      safeToRunConcurrently: true,
      reason: policy.concurrency?.reason || 'read-only seat readiness preflight; no continuation/delegate/compaction calls are fired',
    },
    notes,
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printText(report);
  return pass ? 0 : 2;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
