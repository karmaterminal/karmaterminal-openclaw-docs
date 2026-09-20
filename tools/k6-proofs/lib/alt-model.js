// Single owner for the k6 proof rows' "alternate model" selection.
//
// Rows that prove model routing (R-CD-MODEL-TOOL / -TOKEN / -CHAINED-ALT) must request a model
// that is NOT the seat's primary, otherwise a pass cannot distinguish "the override routed" from
// "the session used its default anyway".
//
// The default below must also not be the seat's configured fallback, so that observing it in the
// child's session metadata proves the override routed rather than a fallback having been taken.
// Fleet state 2026-09-20 (`openclaw models list --json` on a prince):
//   primary  openai/gpt-5.6-sol
//   fallback openai/gpt-5.6-terra
//   also available: openai/gpt-5.6-luna, openai/gpt-6-astra, openai/gpt-5.5
//
// History: these rows previously defaulted to the bare alias `gpt`, which resolved to
// `openai/gpt-5.4`. That model was retired from the ChatGPT-account Codex route, so every dispatch
// came back `sessions_spawn model "openai/gpt-5.4" is not usable`. A bare alias ages out silently
// because it is resolved seat-side; a fully qualified provider/model does not.
//
// Override per run with OPENCLAW_ALT_MODEL=<provider/model>.
export const DEFAULT_ALT_MODEL = 'openai/gpt-5.6-luna';

/** Trim stray trailing punctuation a model string can pick up when echoed inside prose. */
export function normalizeModel(value) {
  return String(value || '').trim().replace(/[.,;:]+$/, '');
}

/**
 * Resolve the alternate model for a row.
 * Precedence: OPENCLAW_ALT_MODEL env -> manifest invocation.model -> DEFAULT_ALT_MODEL.
 */
export function resolveAltModel(env, manifestModel) {
  const fromEnv = normalizeModel(env && env.OPENCLAW_ALT_MODEL);
  if (fromEnv) return fromEnv;
  const fromManifest = normalizeModel(manifestModel);
  // A manifest may still carry an unexpanded ${OPENCLAW_ALT_MODEL:-...} template or a bare alias;
  // neither is a usable fully-qualified model, so fall through to the owned default.
  if (fromManifest && !fromManifest.includes('$') && fromManifest.includes('/')) return fromManifest;
  return DEFAULT_ALT_MODEL;
}
