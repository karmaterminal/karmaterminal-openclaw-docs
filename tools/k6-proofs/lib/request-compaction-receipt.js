function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonText(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function receiptFromContent(content) {
  if (isRecord(content)) return content;
  if (typeof content === 'string') return parseJsonText(content);
  if (!Array.isArray(content)) return null;

  for (const part of content) {
    if (isRecord(part?.details)) return part.details;
    if (typeof part?.text === 'string') {
      const parsed = parseJsonText(part.text);
      if (parsed) return parsed;
    }
  }
  return null;
}

export function effectiveToolNames(payload) {
  const names = [];
  for (const group of Array.isArray(payload?.groups) ? payload.groups : []) {
    for (const tool of Array.isArray(group?.tools) ? group.tools : []) {
      const name = typeof tool === 'string' ? tool : tool?.id || tool?.name;
      if (typeof name === 'string' && name) names.push(name);
    }
  }
  return [...new Set(names)];
}

export function hasEffectiveTool(payload, expectedName) {
  return effectiveToolNames(payload).includes(expectedName);
}

function toolCallArguments(part) {
  if (isRecord(part?.arguments)) return part.arguments;
  if (typeof part?.arguments === 'string') return parseJsonText(part.arguments);
  if (isRecord(part?.input)) return part.input;
  if (typeof part?.input === 'string') return parseJsonText(part.input);
  return null;
}

export const REQUEST_COMPACTION_THRESHOLD_PERCENT = 70;
export const RRC2_PARENT_DELEGATE_ARGUMENT_KEYS = ['delaySeconds', 'mode', 'task'];

export function hasExactRrc2ParentDelegateArguments(evidence) {
  return Boolean(
    evidence?.parent_delegate_argument_policy_valid === true &&
    evidence?.parent_delegate_tool_call_count === 1 &&
    evidence?.parent_delegate_arguments_exact === true &&
    Array.isArray(evidence?.parent_delegate_argument_keys) &&
    evidence.parent_delegate_argument_keys.length ===
      RRC2_PARENT_DELEGATE_ARGUMENT_KEYS.length &&
    evidence.parent_delegate_argument_keys.every(
      (key, index) => key === RRC2_PARENT_DELEGATE_ARGUMENT_KEYS[index],
    )
  );
}

function canonicalObject(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalObject).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalObject(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function observeRrc2ParentDelegateCall(state, { toolCallId, args }) {
  const current = state?.fingerprints && typeof state.fingerprints === 'object'
    ? state.fingerprints
    : {};
  const id = typeof toolCallId === 'string' ? toolCallId.trim() : '';
  if (!id || !args || typeof args !== 'object' || Array.isArray(args)) {
    return {
      state: { fingerprints: { ...current } },
      count: Object.keys(current).length,
      keys: [],
      exact: false,
      violation: true,
    };
  }
  const fingerprint = canonicalObject(args);
  const existing = current[id];
  if (existing !== undefined && existing !== fingerprint) {
    return {
      state: { fingerprints: { ...current } },
      count: Object.keys(current).length,
      keys: Object.keys(args).sort(),
      exact: false,
      violation: true,
    };
  }
  const fingerprints = existing === fingerprint ? current : { ...current, [id]: fingerprint };
  const keys = Object.keys(args).sort();
  const count = Object.keys(fingerprints).length;
  const exact =
    count === 1 &&
    keys.length === RRC2_PARENT_DELEGATE_ARGUMENT_KEYS.length &&
    keys.every((key, index) => key === RRC2_PARENT_DELEGATE_ARGUMENT_KEYS[index]) &&
    args.mode === 'normal' &&
    args.delaySeconds === 0;
  return {
    state: { fingerprints },
    count,
    keys,
    exact,
    violation: !exact,
  };
}

// The single authoritative HONEST-LIMIT/PASS evidence predicates for R-RC-2.
// Every consumer (the postprocessor, the candidate-run-result contract, and
// its validator) must agree on exactly what "verified" means for each
// verdict, so these live in one place instead of three copies drifting apart.
export function isVerifiedRrc2HonestLimitEvidence(evidence) {
  return (
    evidence?.row === 'R-RC-2' &&
    hasExactRrc2ParentDelegateArguments(evidence) &&
    evidence.parent_dispatch_accepted === true &&
    evidence.delegate_requested === true &&
    evidence.child_session_observed === true &&
    evidence.delegate_child_report_observed === true &&
    evidence.child_reported_context_threshold === true &&
    evidence.request_compaction_tool_result_observed === true &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'rejected' &&
    evidence.request_compaction_invocation_bound === true &&
    evidence.request_compaction_rejected_context_threshold === true &&
    evidence.guard === 'context_threshold' &&
    isCanonicalThresholdRejectionReceipt({
      status: evidence.request_compaction_receipt_status,
      guard: evidence.guard,
      contextUsage: evidence.context_usage,
      threshold: evidence.threshold,
    }) &&
    evidence.reported_context_usage === evidence.context_usage &&
    evidence.reported_threshold === evidence.threshold
  );
}

export function isVerifiedRrc2PassEvidence(evidence) {
  return (
    evidence?.row === 'R-RC-2' &&
    hasExactRrc2ParentDelegateArguments(evidence) &&
    evidence.parent_dispatch_accepted === true &&
    evidence.delegate_requested === true &&
    evidence.child_session_observed === true &&
    evidence.delegate_child_report_observed === true &&
    evidence.post_compaction_path_observed === true &&
    evidence.request_compaction_tool_result_observed === true &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'accepted' &&
    evidence.request_compaction_invocation_bound === true &&
    evidence.request_compaction_accepted === true
  );
}

// rowId/verdict gate: only R-RC-2 requires the row-specific evidence checks
// above; every other row's HONEST-LIMIT-candidate verdict is refused outright
// (R-RC-2 is the only row with an honest-limit path), and any other verdict
// on any other row is left to its own row-scoped checks.
export function hasVerifiedRrc2Outcome(rowId, verdict, evidence) {
  if (rowId !== 'R-RC-2') return verdict !== 'HONEST-LIMIT-candidate';
  if (verdict === 'HONEST-LIMIT-candidate') return isVerifiedRrc2HonestLimitEvidence(evidence);
  if (verdict === 'PASS-candidate') return isVerifiedRrc2PassEvidence(evidence);
  return true;
}

export function isCanonicalThresholdRejectionReceipt(receipt) {
  return Boolean(
    isRecord(receipt) &&
    receipt.status === 'rejected' &&
    receipt.guard === 'context_threshold' &&
    typeof receipt.contextUsage === 'number' &&
    Number.isFinite(receipt.contextUsage) &&
    typeof receipt.threshold === 'number' &&
    Number.isFinite(receipt.threshold) &&
    receipt.threshold === REQUEST_COMPACTION_THRESHOLD_PERCENT &&
    receipt.contextUsage >= 0 &&
    receipt.contextUsage < receipt.threshold
  );
}

export function requestCompactionToolCallIdForNonce(messages, rowNonce) {
  if (typeof rowNonce !== 'string' || !rowNonce) return null;
  const matchingCallIds = new Set();
  let unidentifiedMatch = false;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part?.type !== 'toolCall') continue;
      if ((part.name || part.toolName) !== 'request_compaction') continue;
      const reason = toolCallArguments(part)?.reason;
      if (typeof reason === 'string' && reason.includes(rowNonce)) {
        if (typeof part.id === 'string' && part.id) matchingCallIds.add(part.id);
        else unidentifiedMatch = true;
      }
    }
  }
  if (unidentifiedMatch || matchingCallIds.size !== 1) return null;
  return [...matchingCallIds][0];
}

/**
 * Classify one sessions.messages session.message event for an authoritative
 * request_compaction tool-result receipt. Assistant prose is intentionally not
 * accepted here: only role=toolResult + toolName=request_compaction can pass.
 */
export function classifyRequestCompactionReceipt(
  eventPayload,
  { requireCanonicalNumericThreshold = false } = {},
) {
  const message = eventPayload?.message || eventPayload?.payload?.message || eventPayload;
  if (!isRecord(message) || message.role !== 'toolResult') return { kind: 'unrelated' };
  if (message.toolName !== 'request_compaction') return { kind: 'unrelated' };

  const receipt = isRecord(message.details)
    ? message.details
    : receiptFromContent(message.content);
  if (!receipt) {
    return {
      kind: 'invalid',
      error: 'request_compaction tool result did not contain a structured receipt',
      toolCallId: message.toolCallId || null,
    };
  }

  if (receipt.status === 'rejected' && receipt.guard === 'context_threshold') {
    if (requireCanonicalNumericThreshold && !isCanonicalThresholdRejectionReceipt(receipt)) {
      return {
        kind: 'invalid',
        error:
          'request_compaction context-threshold rejection requires finite numeric contextUsage below canonical threshold 70',
        receipt,
        toolCallId: message.toolCallId || null,
      };
    }
    return {
      kind: 'threshold_rejected',
      receipt,
      toolCallId: message.toolCallId || null,
    };
  }

  return {
    kind: 'non_threshold_result',
    receipt,
    toolCallId: message.toolCallId || null,
  };
}

export function findRequestCompactionReceipt(
  messages,
  { rowNonce, toolCallId, requireCanonicalNumericThreshold = false } = {},
) {
  const items = Array.isArray(messages) ? messages : [];
  const expectedToolCallId = toolCallId || requestCompactionToolCallIdForNonce(items, rowNonce);
  if (!expectedToolCallId) return { kind: 'missing' };

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const result = classifyRequestCompactionReceipt(items[index], {
      requireCanonicalNumericThreshold,
    });
    if (result.kind === 'unrelated' || result.toolCallId !== expectedToolCallId) continue;
    return { ...result, nonceBound: true };
  }
  return { kind: 'missing' };
}
