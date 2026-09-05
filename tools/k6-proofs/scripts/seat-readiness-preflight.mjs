#!/usr/bin/env node
/**
 * Public-safe, authenticated readiness report for an explicitly supplied target.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTarget,
  inspectTarget,
  observedContinuation,
  observedDepths,
  READINESS_SCHEMA,
  readinessBinding,
  sealReadinessReceipt,
  selectedRows,
  sha256,
  validateReadinessReceipt,
} from './target-readiness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const DEFAULT_POLICY_PATH = join(REPO_ROOT, 'tools/k6-proofs/seat-readiness.policy.json');
const SECRET_NAME_PATTERN = /(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|COOKIE|AUTH)/iu;
const SHA = /^[0-9a-f]{40}$/u;
const PUBLIC_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u;

function loadPolicy(policyPath = DEFAULT_POLICY_PATH) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
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
  console.log('Usage: node tools/k6-proofs/scripts/seat-readiness-preflight.mjs [--json] [--no-gateway] [--policy path] [--expected-k6-version v2.0.0]');
}

function commandOrNull(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function redactRawVersion(rawVersion) {
  if (!rawVersion) return null;
  return rawVersion.replace(
    /(token|secret|password|authorization|bearer)=[^\s]+/giu,
    '$1=<redacted>',
  );
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
    const version = rawVersion?.match(/\bv\d+\.\d+\.\d+\b/u)?.[0] || null;
    checked.push({ path, exists: true, version, rawVersion: redactRawVersion(rawVersion) });
    if (version) {
      return {
        ok: true,
        path,
        version,
        rawVersion: redactRawVersion(rawVersion),
        checked,
      };
    }
  }
  return { ok: false, path: null, version: null, rawVersion: null, checked };
}

async function fetchHealth(wsUrl) {
  let url;
  try {
    url = new URL(wsUrl);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = '/health';
    url.search = '';
    url.hash = '';
  } catch {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    return (await fetch(url, { signal: controller.signal })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function sessionScope(sessionKey) {
  if (!sessionKey) return 'missing';
  if (sessionKey === 'main') return 'main';
  if (/^agent:main(:|$)/u.test(sessionKey)) return 'main-agent-session';
  if (/^agent:/u.test(sessionKey)) return 'agent-session';
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

function printText(report) {
  console.log(`seat readiness: ${report.outcome}`);
  console.log(`target RPC: authenticated=${report.target.authentication.authenticated}; client=${report.target.authentication.request?.client?.id || 'none'}; method=${report.target.authentication.request?.method || 'none'}`);
  console.log(`gateway fingerprint: ${report.target.gatewayUrlFingerprint || 'invalid'}`);
  console.log(`depth: configured=${report.target.configuredMaxSpawnDepth ?? 'unknown'}; effective=${report.target.effectiveMaxSpawnDepth ?? 'unknown'}; required=${report.target.requiredMaxSpawnDepth ?? 'invalid'}; expected=${report.target.expectedMaxSpawnDepth ?? 'invalid'}`);
  console.log(`binding digest: ${report.bindingDigest || 'unsigned'}`);
  for (const note of report.notes) console.log(`note: ${note}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return 0;
  }

  const policy = loadPolicy(args.policyPath);
  const expectedK6Version =
    args.expectedK6Version ||
    process.env.OPENCLAW_EXPECTED_K6_VERSION ||
    policy.k6.expectedVersion;
  const k6 = detectK6(policy);
  k6.matchesExpected = k6.version === expectedK6Version;

  const gatewayWs = process.env.OPENCLAW_GATEWAY_WS || '';
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || '';
  const rpc = args.gateway
    ? await inspectTarget(gatewayWs, token)
    : {
        authenticated: false,
        error: 'gateway-check-disabled',
        config: null,
        requestIdentity: null,
        responseIdentity: null,
      };
  const depths = observedDepths(rpc.config);
  const continuation = observedContinuation(rpc.config);
  const targetCheck = evaluateTarget({
    wsUrl: gatewayWs,
    configuredDepth: depths.configured,
    effectiveDepth: depths.effective,
    requiredDepth: process.env.OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH,
    expectedDepth: process.env.OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH,
    rpc,
    runtimeSha: process.env.OPENCLAW_RUNTIME_SHA || process.env.OPENCLAW_RUNTIME_BUILD_SHA,
    continuation,
  });
  const rows = selectedRows(process.env.OPENCLAW_SELECTED_ROWS);
  const candidateSha = process.env.OPENCLAW_CANDIDATE_SHA || null;
  const runtimeSha =
    process.env.OPENCLAW_RUNTIME_SHA ||
    process.env.OPENCLAW_RUNTIME_BUILD_SHA ||
    null;
  const docsSha =
    process.env.OPENCLAW_DOCS_SHA ||
    process.env.OPENCLAW_PROOFS_DOCS_REF ||
    null;
  const seat = process.env.OPENCLAW_SEAT_NAME || null;
  const unit = process.env.OPENCLAW_GATEWAY_UNIT || null;
  const env = envReport(policy);
  const requiredMissing = env.filter((entry) => entry.required && !entry.present);
  const notes = [...targetCheck.notes];
  if (!k6.ok) notes.push('k6-unavailable');
  else if (!k6.matchesExpected) notes.push('k6-version-mismatch');
  if (!SHA.test(candidateSha || '')) notes.push('candidate-sha-invalid');
  if (!SHA.test(runtimeSha || '')) notes.push('runtime-sha-invalid');
  if (!SHA.test(docsSha || '')) notes.push('docs-sha-invalid');
  if (candidateSha !== runtimeSha) notes.push('candidate-runtime-sha-mismatch');
  if (!PUBLIC_ID.test(seat || '')) notes.push('seat-invalid');
  if (!PUBLIC_ID.test(unit || '')) notes.push('gateway-unit-invalid');
  if (!rows) notes.push('selected-rows-invalid');
  if (sessionScope(process.env.OPENCLAW_SESSION_KEY) === 'main') notes.push('session-not-disposable');
  if (requiredMissing.length > 0) {
    notes.push(`missing-required-env:${requiredMissing.map((entry) => entry.name).join(',')}`);
  }

  const pass = notes.length === 0;
  const baseReceipt = {
    schema: READINESS_SCHEMA,
    generatedAt: new Date().toISOString(),
    outcome: pass ? 'PASS-candidate' : 'PARTIAL-candidate',
    policy: {
      name: policy.name,
      version: policy.version,
      source: args.policyPath || 'tools/k6-proofs/seat-readiness.policy.json',
    },
    expectedK6Version,
    k6,
    gateway: {
      mode: args.gateway ? 'authenticated-rpc' : 'skipped-by-flag',
      healthReachable: args.gateway ? await fetchHealth(gatewayWs) : false,
    },
    target: {
      gatewayUrlFingerprint: targetCheck.fingerprint,
      configuredMaxSpawnDepth: depths.configured,
      effectiveMaxSpawnDepth: depths.effective,
      requiredMaxSpawnDepth: targetCheck.required,
      expectedMaxSpawnDepth: targetCheck.expected,
      continuation,
      authentication: {
        scheme: 'gateway-token',
        authenticated: rpc.authenticated,
        request: rpc.requestIdentity,
        response: rpc.responseIdentity,
      },
    },
    bindings: {
      candidateSha,
      runtimeSha,
      docsSha,
      gatewayUrlFingerprint: targetCheck.fingerprint,
      seat,
      unit,
      selectedRows: rows,
      requiredMaxSpawnDepth: targetCheck.required,
      expectedMaxSpawnDepth: targetCheck.expected,
    },
    candidate: { sha: candidateSha, valid40Hex: SHA.test(candidateSha || '') },
    seat: {
      name: seat,
      class: process.env.OPENCLAW_SEAT_CLASS || policy.seat?.defaultClass || 'message-body',
    },
    session: { scope: sessionScope(process.env.OPENCLAW_SESSION_KEY) },
    env,
    concurrency: {
      safeToRunConcurrently: true,
      reason: policy.concurrency?.reason ||
        'read-only authenticated target readiness; no model or row dispatch',
    },
    notes,
  };

  let report = {
    ...baseReceipt,
    bindingDigest: sha256(JSON.stringify(readinessBinding(baseReceipt))),
    integrity: { algorithm: 'hmac-sha256-gateway-token-v1', signature: null },
  };
  if (pass) {
    report = sealReadinessReceipt(baseReceipt, token);
    const verified = validateReadinessReceipt(report, {
      signingKey: token,
      candidateSha,
      runtimeSha,
      docsSha,
      gatewayWs,
      seat,
      unit,
      rows,
      requiredDepth: targetCheck.required,
      expectedDepth: targetCheck.expected,
    });
    if (!verified.valid) {
      throw new Error(`generated readiness receipt failed verification: ${verified.reason}`);
    }
  }

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printText(report);
  return pass ? 0 : 2;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`seat readiness failed: ${error.message}`);
    process.exit(1);
  });
