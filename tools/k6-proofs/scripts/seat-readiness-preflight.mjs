#!/usr/bin/env node
/**
 * seat-readiness-preflight.mjs — public-safe seat/tooling readiness report.
 *
 * This is intentionally a Node helper, not a k6 row. It runs before proof rows
 * so a bad seat/tooling environment becomes HONEST-LIMIT-candidate instead of
 * being confused with product behavior.
 */
import { execFileSync } from 'node:child_process';

const DEFAULT_EXPECTED_K6_VERSION = 'v2.0.0';
const SECRET_ENV = new Set(['OPENCLAW_GATEWAY_TOKEN']);
const REQUIRED_ENV = [
  'OPENCLAW_GATEWAY_TOKEN',
  'OPENCLAW_GATEWAY_WS',
  'OPENCLAW_SESSION_KEY',
  'OPENCLAW_CANDIDATE_SHA',
  'OPENCLAW_SEAT_NAME',
];

function parseArgs(argv) {
  const out = { gateway: true };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--no-gateway') out.gateway = false;
    else if (arg === '--expected-k6-version') out.expectedK6Version = argv[++i];
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`unknown arg: ${arg}`);
  }
  return out;
}

function usage() {
  console.log(`Usage: node tools/k6-proofs/scripts/seat-readiness-preflight.mjs [--json] [--no-gateway] [--expected-k6-version v2.0.0]\n\nEmits no secret values. Exit 0 only for PASS-candidate.`);
}

function commandOrNull(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function detectK6() {
  const path = commandOrNull('which', ['k6']);
  if (!path) return { ok: false, path: null, version: null, rawVersion: null };
  const rawVersion = commandOrNull('k6', ['version']);
  const version = rawVersion && rawVersion.match(/\bv\d+\.\d+\.\d+\b/)?.[0] || null;
  return { ok: Boolean(version), path, version, rawVersion };
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

function envReport() {
  return REQUIRED_ENV.map((name) => ({
    name,
    present: Boolean(process.env[name]),
    secret: SECRET_ENV.has(name),
    required: name !== 'OPENCLAW_GATEWAY_WS',
  }));
}

function printText(report) {
  console.log(`seat readiness: ${report.outcome}`);
  console.log(`k6: ${report.k6.version || 'missing'} at ${report.k6.path || '(not found)'} (expected ${report.expectedK6Version})`);
  console.log(`gateway: ${report.gateway.mode}; health=${report.gateway.healthReachable}; status=${report.gateway.statusReachable}; url=${report.gateway.url}`);
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

  const expectedK6Version = args.expectedK6Version || process.env.OPENCLAW_EXPECTED_K6_VERSION || DEFAULT_EXPECTED_K6_VERSION;
  const k6 = detectK6();
  k6.matchesExpected = k6.version === expectedK6Version;

  const gatewayWs = process.env.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
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

  const candidateSha = process.env.OPENCLAW_CANDIDATE_SHA || null;
  const env = envReport();
  const requiredMissing = env.filter((e) => e.required && !e.present).map((e) => e.name);
  const notes = [];
  if (!k6.ok) notes.push('k6 is not installed or did not report a parseable version.');
  else if (!k6.matchesExpected) notes.push(`k6 version mismatch: expected ${expectedK6Version}, got ${k6.version}.`);
  if (gateway.mode === 'checked' && (!gateway.healthReachable || !gateway.statusReachable)) notes.push('gateway health/status not reachable from this seat.');
  if (gateway.mode === 'skipped-no-token') notes.push('gateway reachability skipped because OPENCLAW_GATEWAY_TOKEN is absent; token value was not printed.');
  if (requiredMissing.length) notes.push(`missing required env: ${requiredMissing.join(', ')}.`);

  const valid40Hex = typeof candidateSha === 'string' && /^[0-9a-f]{40}$/.test(candidateSha);
  if (!valid40Hex) notes.push('OPENCLAW_CANDIDATE_SHA is missing or not a 40-char lowercase hex SHA.');

  const pass = k6.ok && k6.matchesExpected && valid40Hex && requiredMissing.length === 0 && (gateway.mode !== 'checked' || (gateway.healthReachable && gateway.statusReachable));

  const report = {
    schema: 'openclaw.k6.seat-readiness.v1',
    generatedAt: new Date().toISOString(),
    outcome: pass ? 'PASS-candidate' : 'HONEST-LIMIT-candidate',
    expectedK6Version,
    k6,
    gateway,
    candidate: { sha: candidateSha, valid40Hex },
    seat: {
      name: process.env.OPENCLAW_SEAT_NAME || 'unknown-seat',
      class: process.env.OPENCLAW_SEAT_CLASS || 'message-body',
    },
    session: { scope: sessionScope(process.env.OPENCLAW_SESSION_KEY) },
    env,
    concurrency: {
      safeToRunConcurrently: true,
      reason: 'read-only seat readiness preflight; no continuation/delegate/compaction calls are fired',
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
