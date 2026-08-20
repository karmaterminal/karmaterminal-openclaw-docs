const EXACT_SHA = /^[a-f0-9]{40}$/;
const SHORT_SHA = /^[a-f0-9]{7,39}$/;
const RECEIPT_SCHEMAS = new Set([
  'openclaw.k6.runtime-build-receipt.v1',
  'openclaw.runtime-build-receipt.v1',
]);

export const RUNTIME_IDENTITY_SCHEMA = 'openclaw.k6.runtime-identity.v1';

export function exactRuntimeSha(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return EXACT_SHA.test(text) ? text : null;
}

function firstExact(...values) {
  for (const value of values) {
    const sha = exactRuntimeSha(value);
    if (sha) return sha;
  }
  return null;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function extractExactShaFromStructured(value) {
  const object = asObject(value);
  if (!object) return null;
  return firstExact(
    object.sha,
    object.commit,
    object.buildSha,
    object.runtimeBuildSha,
    object.build?.sha,
    object.build?.commit,
    object.git?.sha,
    object.git?.commit,
    object.version?.sha,
    object.version?.commit,
  );
}

export function parseRuntimeBuildReceipt(value, { source = 'runtime-build-receipt', path = null } = {}) {
  const object = asObject(value);
  if (!object) return { ok: false, reason: 'malformed', source, path };
  if (object.schema && !RECEIPT_SCHEMAS.has(object.schema)) {
    return { ok: false, reason: 'malformed', source, path };
  }
  const sha = extractExactShaFromStructured(object);
  if (!sha) {
    return {
      ok: false,
      reason: firstExact(object.sha, object.build?.sha) ? 'malformed' : 'absent',
      source,
      path,
    };
  }
  return { ok: true, sha, source, path, schema: object.schema || null };
}

export function classifyRuntimeStamp(value) {
  if (value == null || value === '') return { kind: 'absent', value: null };
  const text = String(value).trim();
  if (!text || text === 'unknown') return { kind: 'absent', value: null };
  const exact = exactRuntimeSha(text);
  if (exact) return { kind: 'exact-sha', value: exact };
  if (SHORT_SHA.test(text.toLowerCase())) return { kind: 'short-only', value: text };
  const shortFromStamp = text.match(/\(([a-f0-9]{7,39})\)/i)?.[1];
  if (shortFromStamp) return { kind: 'version-stamp', value: text, shortSha: shortFromStamp.toLowerCase() };
  return { kind: 'version-stamp', value: text };
}

/**
 * Fail-closed merge of independently observed runtime identity sources.
 * Never accepts the candidate SHA as a source and never expands a short SHA.
 */
export function resolveExactRuntimeIdentity(sources = []) {
  const observed = [];
  const exact = [];
  let versionStamp = null;
  let shortOnly = false;
  let malformed = false;

  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || source.kind === 'candidate-sha') continue;
    const label = source.source || source.kind || 'unknown';
    const path = source.path || null;
    if (source.receipt != null) {
      const parsed = parseRuntimeBuildReceipt(source.receipt, { source: label, path });
      observed.push({ source: label, path, result: parsed.ok ? 'exact-sha' : parsed.reason });
      if (parsed.ok) exact.push({ sha: parsed.sha, source: label, path });
      else if (parsed.reason === 'malformed') malformed = true;
      continue;
    }
    if (source.sha != null) {
      const sha = exactRuntimeSha(source.sha);
      observed.push({ source: label, path, result: sha ? 'exact-sha' : 'malformed' });
      if (sha) exact.push({ sha, source: label, path });
      else malformed = true;
      continue;
    }
    if (source.stamp != null) {
      const classified = classifyRuntimeStamp(source.stamp);
      observed.push({ source: label, path, result: classified.kind });
      if (classified.kind === 'exact-sha') exact.push({ sha: classified.value, source: label, path });
      else if (classified.kind === 'short-only') shortOnly = true;
      else if (classified.kind === 'version-stamp') {
        versionStamp = versionStamp || classified.value;
        if (classified.shortSha) shortOnly = true;
      }
    }
  }

  const unique = [...new Set(exact.map((entry) => entry.sha))];
  if (unique.length > 1) {
    return {
      schema: RUNTIME_IDENTITY_SCHEMA,
      ok: false,
      exact: false,
      reason: 'ambiguous',
      sha: null,
      source: null,
      path: null,
      versionStamp,
      observed,
    };
  }
  if (unique.length === 1) {
    const chosen = exact.find((entry) => entry.sha === unique[0]);
    return {
      schema: RUNTIME_IDENTITY_SCHEMA,
      ok: true,
      exact: true,
      reason: null,
      sha: chosen.sha,
      source: chosen.source,
      path: chosen.path,
      versionStamp,
      observed,
    };
  }

  let reason = 'absent';
  if (malformed) reason = 'malformed';
  else if (shortOnly) reason = 'short-only';
  else if (versionStamp) reason = 'short-only';

  return {
    schema: RUNTIME_IDENTITY_SCHEMA,
    ok: false,
    exact: false,
    reason,
    sha: null,
    source: null,
    path: null,
    versionStamp,
    observed,
  };
}

export function publicRuntimeIdentity(identity, { candidateSha = null } = {}) {
  const sha = identity?.exact ? identity.sha : null;
  return {
    schema: RUNTIME_IDENTITY_SCHEMA,
    exact: identity?.exact === true,
    runtimeBuildSha: sha,
    runtimeBuildShaSource: identity?.exact ? identity.source : null,
    runtimeBuildReceiptPath: identity?.exact ? identity.path : null,
    versionStamp: identity?.versionStamp || null,
    reason: identity?.ok ? null : (identity?.reason || 'absent'),
    candidateMatchesRuntime: Boolean(sha && candidateSha && sha === candidateSha),
  };
}
