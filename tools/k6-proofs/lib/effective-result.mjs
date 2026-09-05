export function effectiveFailure(result) {
  return ['effectiveExitCode', 'k6ExitCode', 'postprocessExitCode'].some((key) =>
    result?.[key] !== undefined && (!Number.isInteger(result[key]) || result[key] !== 0));
}
export function effectiveOutcome(result, fallback = 'PARTIAL-candidate') {
  return effectiveFailure(result) ? 'FAIL-candidate' : (result?.verdict || fallback);
}
