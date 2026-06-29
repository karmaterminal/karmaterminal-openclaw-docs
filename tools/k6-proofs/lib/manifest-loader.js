/**
 * Manifest loader for k6 proof scenarios.
 *
 * Resolves env-var placeholders (${VAR:-default}) in manifest fields at runtime.
 * Scenarios call loadManifest() to get their data-driven config.
 */
import { SharedArray } from 'k6/data';

/**
 * Resolve ${ENV_VAR:-default} patterns in a string using k6's __ENV.
 */
export function resolveEnvPlaceholders(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const [varName, defaultVal] = expr.split(':-');
    return __ENV[varName] || defaultVal || '';
  });
}

/**
 * Deep-resolve all string fields in an object.
 */
export function resolveManifest(manifest) {
  if (typeof manifest === 'string') return resolveEnvPlaceholders(manifest);
  if (Array.isArray(manifest)) return manifest.map(resolveManifest);
  if (typeof manifest === 'object' && manifest !== null) {
    const out = {};
    for (const [k, v] of Object.entries(manifest)) {
      out[k] = resolveManifest(v);
    }
    return out;
  }
  return manifest;
}

/**
 * Load and resolve a manifest from the tools/k6-proofs/manifests/ directory.
 * Call with the manifest filename (e.g. 'r-cd-1.json').
 *
 * Note: k6 doesn't support dynamic file reads at runtime in the same way Node does.
 * In k6, use open() at init time or SharedArray. This helper is for the
 * post-processor / Node-based validation; in k6 scenarios, inline the manifest
 * data or use open() + JSON.parse() at init time.
 */
export function loadManifestFromEnv() {
  const manifestPath = __ENV.OPENCLAW_ROW_MANIFEST;
  if (!manifestPath) {
    console.warn('OPENCLAW_ROW_MANIFEST env var not set; using scenario defaults');
    return null;
  }
  // k6 open() reads at init time
  const raw = open(manifestPath.startsWith('/') ? manifestPath : '../'+manifestPath);
  const parsed = JSON.parse(raw);
  return resolveManifest(parsed);
}

/**
 * Validate a resolved manifest has the required fields for a live run.
 */
export function validateManifest(manifest) {
  const errors = [];
  if (!manifest.rowId) errors.push('missing rowId');
  if (!manifest.candidateSha || !/^[0-9a-f]{40}$/.test(manifest.candidateSha)) {
    errors.push(`candidateSha must be a 40-char hex SHA (got: "${manifest.candidateSha}")`);
  }
  if (!manifest.seat) errors.push('missing seat');
  if (!manifest.sessionKey) errors.push('missing sessionKey');
  if ((manifest.review && manifest.review.candidateOnly) !== true) errors.push('review.candidateOnly must be true');
  if ((manifest.review && manifest.review.foldRequiresReview) !== true) errors.push('review.foldRequiresReview must be true');

  const safety = manifest.liveRunSafety;
  if (safety) {
    if (safety.foldRequiresReview !== true) errors.push('liveRunSafety.foldRequiresReview must be true');
    if (safety.requiresLiveGatewayToken && !__ENV.OPENCLAW_GATEWAY_TOKEN) {
      errors.push('OPENCLAW_GATEWAY_TOKEN is required by liveRunSafety');
    }
    if (safety.requiresTargetSessionKey && !__ENV.OPENCLAW_SESSION_KEY) {
      errors.push('OPENCLAW_SESSION_KEY must be explicitly set by liveRunSafety');
    }
    if (safety.requiresCandidateSha && !/^[0-9a-f]{40}$/.test(__ENV.OPENCLAW_CANDIDATE_SHA || '')) {
      errors.push('OPENCLAW_CANDIDATE_SHA must be a 40-character hex SHA by liveRunSafety');
    }
    if (safety.requiresLiveGatewayToken && manifest.transport === 'offline') {
      errors.push('offline transport cannot require a live gateway token');
    }
    if (safety.classification === 'k6-runnable' && manifest.scenario && manifest.scenario.status !== 'runnable') {
      errors.push('liveRunSafety.classification=k6-runnable requires scenario.status=runnable');
    }
    if (!Array.isArray(safety.requiredReceipts) || safety.requiredReceipts.length === 0) {
      errors.push('liveRunSafety.requiredReceipts must be a non-empty array');
    }
  }
  return errors;
}
