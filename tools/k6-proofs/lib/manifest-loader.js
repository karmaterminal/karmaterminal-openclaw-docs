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
  const raw = open(manifestPath);
  const parsed = JSON.parse(raw);
  return resolveManifest(parsed);
}

/**
 * Validate a resolved manifest has the required fields for a live run.
 */
export function validateManifest(manifest) {
  const errors = [];
  if (!manifest.rowId) errors.push('missing rowId');
  if (!manifest.candidateSha || manifest.candidateSha.length !== 40) {
    errors.push(`candidateSha must be a 40-char hex SHA (got: "${manifest.candidateSha}")`);
  }
  if (!manifest.seat) errors.push('missing seat');
  if (!manifest.sessionKey) errors.push('missing sessionKey');
  if ((manifest.review && manifest.review.candidateOnly) !== true) errors.push('review.candidateOnly must be true');
  if ((manifest.review && manifest.review.foldRequiresReview) !== true) errors.push('review.foldRequiresReview must be true');
  return errors;
}
