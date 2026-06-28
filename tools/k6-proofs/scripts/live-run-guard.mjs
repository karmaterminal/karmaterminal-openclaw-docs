#!/usr/bin/env node
/**
 * live-run-guard.mjs — fail-closed preflight for manifest-declared live proof safety.
 *
 * This script is intentionally dependency-free so run-proof.sh and CI can call it
 * before k6 starts. It validates only the safety contract that affects live runs:
 * required env presence and same-session concurrency lock metadata.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function usage() {
  console.error('Usage: node tools/k6-proofs/scripts/live-run-guard.mjs --manifest <row-manifest.json> [--shell|--json]');
}

function parseArgs(argv) {
  const out = { mode: 'text' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--shell') {
      out.mode = 'shell';
      continue;
    }
    if (arg === '--json') {
      out.mode = 'json';
      continue;
    }
    if (arg === '--manifest') {
      out.manifest = argv[++i];
      continue;
    }
    throw new Error(`unexpected argument: ${arg}`);
  }
  return out;
}

function resolveEnvPlaceholders(value, env) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const [name, fallback] = expr.split(':-');
    return env[name] || fallback || '';
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function safetyErrors(manifest, env = process.env) {
  const errors = [];
  const safety = manifest.liveRunSafety;

  if (!safety) {
    errors.push('manifest missing liveRunSafety block');
    return errors;
  }

  if (manifest.review?.foldRequiresReview !== true || safety.foldRequiresReview !== true) {
    errors.push('liveRunSafety.foldRequiresReview and review.foldRequiresReview must both be true');
  }

  if (safety.requiresLiveGatewayToken && !env.OPENCLAW_GATEWAY_TOKEN) {
    errors.push('OPENCLAW_GATEWAY_TOKEN is required by liveRunSafety.requiresLiveGatewayToken');
  }

  if (safety.requiresTargetSessionKey && !env.OPENCLAW_SESSION_KEY) {
    errors.push('OPENCLAW_SESSION_KEY must be set explicitly when liveRunSafety.requiresTargetSessionKey=true');
  }

  if (safety.requiresCandidateSha && !/^[0-9a-f]{40}$/.test(env.OPENCLAW_CANDIDATE_SHA || '')) {
    errors.push('OPENCLAW_CANDIDATE_SHA must be a 40-character hex SHA when liveRunSafety.requiresCandidateSha=true');
  }

  if (safety.requiresLiveGatewayToken && manifest.transport === 'offline') {
    errors.push('offline transport cannot require a live gateway token');
  }

  if (safety.classification === 'k6-runnable' && manifest.scenario?.status !== 'runnable') {
    errors.push('liveRunSafety.classification=k6-runnable requires scenario.status=runnable');
  }

  if (safety.classification === 'construct-only' && manifest.scenario?.status === 'runnable') {
    errors.push('liveRunSafety.classification=construct-only cannot be paired with scenario.status=runnable');
  }

  if (safety.requiresExternalAgentOrToolInvocation && manifest.toolSurface === 'read-only') {
    errors.push('read-only toolSurface cannot require external agent/tool invocation');
  }

  if (!Array.isArray(safety.requiredReceipts) || safety.requiredReceipts.length === 0) {
    errors.push('liveRunSafety.requiredReceipts must list the receipts required for review');
  } else {
    const expected = new Set((manifest.expectedReceipts || []).map((receipt) => receipt.name));
    for (const receiptName of safety.requiredReceipts) {
      if (receiptName !== 'seat-readiness' && !expected.has(receiptName)) {
        errors.push(`liveRunSafety.requiredReceipts references '${receiptName}' but expectedReceipts has no matching receipt`);
      }
    }
  }

  return errors;
}

function buildResult(manifest, env = process.env) {
  const safety = manifest.liveRunSafety || {};
  const explicitSession = env.OPENCLAW_SESSION_KEY || '';
  const resolvedSession = explicitSession || resolveEnvPlaceholders(manifest.sessionKey || '', env) || 'unset';
  const rowId = manifest.rowId || 'unknown-row';
  const lockRequired = safety.sameSessionConcurrencySafe === false;
  const lockBasis = `${rowId}\0${resolvedSession}`;
  const lockHash = createHash('sha256').update(lockBasis).digest('hex').slice(0, 24);
  return {
    ok: true,
    rowId,
    classification: safety.classification || null,
    expectedArtifactClass: safety.expectedArtifactClass || null,
    foldRequiresReview: safety.foldRequiresReview === true,
    requiresLiveGatewayToken: safety.requiresLiveGatewayToken === true,
    requiresTargetSessionKey: safety.requiresTargetSessionKey === true,
    requiresCandidateSha: safety.requiresCandidateSha === true,
    requiresExternalAgentOrToolInvocation: safety.requiresExternalAgentOrToolInvocation === true,
    sameSessionConcurrencySafe: safety.sameSessionConcurrencySafe === true,
    lockRequired,
    lockPath: lockRequired ? `/tmp/openclaw-k6-proof-${lockHash}.lock` : '',
    lockLabel: lockRequired ? `${rowId}:${resolvedSession}` : '',
  };
}

let args;
try {
  args = parseArgs(process.argv);
  if (!args.manifest) {
    usage();
    process.exit(2);
  }
} catch (error) {
  usage();
  console.error(error.message);
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(args.manifest, 'utf8'));
const errors = safetyErrors(manifest);
if (errors.length) {
  const result = { ok: false, errors };
  if (args.mode === 'json') console.log(JSON.stringify(result, null, 2));
  else for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

const result = buildResult(manifest);
if (args.mode === 'json') {
  console.log(JSON.stringify(result, null, 2));
} else if (args.mode === 'shell') {
  console.log(`K6_PROOF_LOCK_REQUIRED=${result.lockRequired ? '1' : '0'}`);
  console.log(`K6_PROOF_LOCK_PATH=${shellQuote(result.lockPath)}`);
  console.log(`K6_PROOF_LOCK_LABEL=${shellQuote(result.lockLabel)}`);
} else {
  console.log(`live-run safety OK: ${result.rowId} (${result.classification}, expected ${result.expectedArtifactClass})`);
  if (result.lockRequired) console.log(`same-session lock: ${result.lockPath} (${result.lockLabel})`);
}
