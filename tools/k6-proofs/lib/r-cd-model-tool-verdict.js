export const RCD_MODEL_TOOL_REQUIRED_MODEL = 'openai/gpt-5.6-luna';

function normalizedModel(value) {
  return String(value || '')
    .trim()
    .replace(/[.,;:]+$/, '');
}

export function classifyRcdModelToolVerdict(evidence) {
  const execution = evidence?.modelExecution;
  const calls = Array.isArray(execution?.calls) ? execution.calls : [];
  if (execution?.bound !== true || calls.length === 0) {
    return {
      verdict: null,
      reason: 'authoritative execution-bound provider/model identity is absent or ambiguous',
    };
  }

  const identities = calls.map((call) => normalizedModel(call?.identity));
  if (identities.some((identity) => !identity.includes('/'))) {
    return {
      verdict: null,
      reason: 'authoritative execution-bound provider/model identity is incomplete',
    };
  }

  if (execution?.identityComplete !== true) {
    return {
      verdict: null,
      reason: 'authoritative child model-call identity telemetry is incomplete',
    };
  }

  const mismatches = [...new Set(
    identities.filter((identity) => identity !== RCD_MODEL_TOOL_REQUIRED_MODEL),
  )];
  if (mismatches.length > 0) {
    return {
      verdict: 'FAIL-candidate',
      reason: `authoritative child execution identity ${mismatches.join(', ')} does not match ${RCD_MODEL_TOOL_REQUIRED_MODEL}`,
    };
  }

  if (execution?.lifecycleComplete !== true) {
    return {
      verdict: null,
      reason: 'authoritative child execution telemetry is incomplete',
    };
  }

  const lifecycleComplete =
    evidence?.row === 'R-CD-MODEL-TOOL' &&
    evidence?.requested_model_byte === RCD_MODEL_TOOL_REQUIRED_MODEL &&
    evidence?.manifest_model_matches_required === true &&
    evidence?.dispatch_accepted === true &&
    evidence?.parent_scheduled_sentinel === true &&
    evidence?.child_session_observed === true &&
    evidence?.return_payload === true &&
    (evidence?.disposable_session_required !== true || evidence?.session_created === true);

  if (!lifecycleComplete) {
    return {
      verdict: null,
      reason: 'authoritative Luna identity observed but required lifecycle receipts are incomplete',
    };
  }

  return { verdict: 'PASS-candidate', reason: null };
}
