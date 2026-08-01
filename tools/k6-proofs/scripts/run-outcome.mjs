const hasOwn = (value, key) => value !== null && typeof value === 'object' && Object.hasOwn(value, key);

function normalizeExplicitOutcome(value) {
  if (typeof value !== 'string') return 'NO-VERDICT';
  return value.trim() || 'NO-VERDICT';
}

export function resolveArtifactOutcome({ runResult = {}, summary = {} } = {}) {
  if (hasOwn(runResult, 'outcome')) return normalizeExplicitOutcome(runResult.outcome);
  if (hasOwn(runResult, 'verdict')) return normalizeExplicitOutcome(runResult.verdict);
  if (hasOwn(summary, 'verdict')) return normalizeExplicitOutcome(summary.verdict);
  return runResult.k6ExitCode === 0 ? 'PASS-candidate' : 'FAIL-candidate';
}
