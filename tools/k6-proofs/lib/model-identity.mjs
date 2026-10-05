// Model-identity receipts for the R-CD-MODEL-* rows (karmaterminal-openclaw-docs#559).
// The authoritative model byte always comes from gateway session metadata
// (sessions.describe → session.modelProvider/model). Text a child was asked to
// emit is never authority: a row that tells the child which model to print can
// only prove the child can repeat a string.

export function normalizeModel(value) {
  return String(value ?? '').trim().replace(/[.,;:]+$/, '');
}

/** provider/model from a sessions.describe `session` object, or null when absent. */
export function modelFromSessionMetadata(session) {
  const model = normalizeModel(session?.model);
  const provider = normalizeModel(session?.modelProvider || session?.provider);
  if (!model) return null;
  return model.includes('/') ? model : (provider ? `${provider}/${model}` : model);
}

/**
 * The explicit override model for a row, with no built-in default. It must be a
 * full provider/model so it can be compared byte-for-byte with session metadata;
 * a bare alias (e.g. "gpt") resolves differently per seat and is refused.
 */
export function resolveRequestedModel(...candidates) {
  const raw = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  if (raw === undefined) {
    return { model: null, refusal: 'no override model configured (set OPENCLAW_ALT_MODEL or manifest invocation.model to a provider/model)' };
  }
  const model = normalizeModel(raw);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:/-]+$/.test(model)) {
    return { model: null, refusal: `override model ${JSON.stringify(raw)} is not a provider/model; aliases resolve per seat and cannot be compared with session metadata` };
  }
  return { model, refusal: null };
}

/**
 * Verdict for one identity comparison.
 * - baseline: the model the row says the child must run (the parent's own
 *   session model for inheritance rows, the requested override otherwise)
 * - observed: the child's model from session metadata
 * - expected: optional seat pin (OPENCLAW_EXPECTED_MODEL); when set, the
 *   baseline must equal it, which is also the live negative control
 * - complete: every non-identity receipt the row requires was gathered
 * FAIL needs authoritative evidence of a mismatch. Missing evidence is PARTIAL,
 * never PASS.
 */
export function classifyModelIdentity({ baseline, observed, expected = null, complete }) {
  const b = baseline ? normalizeModel(baseline) : null;
  const o = observed ? normalizeModel(observed) : null;
  const e = expected ? normalizeModel(expected) : null;
  if (e && b && b !== e) {
    return { verdict: 'FAIL-candidate', modelMatches: false, reason: `baseline ${b} does not match the expected model ${e}` };
  }
  if (b && o && b !== o) {
    return { verdict: 'FAIL-candidate', modelMatches: false, reason: `child session model ${o} does not match baseline ${b}` };
  }
  if (!b) {
    return { verdict: 'PARTIAL-candidate', modelMatches: false, reason: 'no authoritative baseline model' };
  }
  if (!o) {
    return { verdict: 'PARTIAL-candidate', modelMatches: false, reason: 'no authoritative child-session model' };
  }
  if (!complete) {
    return { verdict: 'PARTIAL-candidate', modelMatches: true, reason: 'model identity matched but other required receipts are missing' };
  }
  return { verdict: 'PASS-candidate', modelMatches: true, reason: null };
}
