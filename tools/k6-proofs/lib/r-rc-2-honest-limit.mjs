export const RRC2_HONEST_LIMIT_TEMPO_RECEIPTS = new Set([
  'tempo-trace-json',
  'continuation-trace-correlation',
  'trace-id',
  'tool-trace-correlation',
]);

export function verifiedRrc2ThresholdEvidence(evidence) {
  return evidence?.row === 'R-RC-2' &&
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
    evidence.guard === 'context_threshold';
}

export function verifiedRrc2AcceptedEvidence(evidence) {
  return evidence?.row === 'R-RC-2' &&
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
    evidence.request_compaction_accepted === true;
}

export function hasVerifiedRrc2Outcome(rowId, verdict, evidence) {
  if (rowId !== 'R-RC-2') return verdict !== 'HONEST-LIMIT-candidate';
  if (verdict === 'HONEST-LIMIT-candidate') return verifiedRrc2ThresholdEvidence(evidence);
  if (verdict === 'PASS-candidate') return verifiedRrc2AcceptedEvidence(evidence);
  return true;
}

export function rrc2HonestLimitReceiptsSufficient({ rowId, verdict, evidence } = {}) {
  return rowId === 'R-RC-2' &&
    verdict === 'HONEST-LIMIT-candidate' &&
    verifiedRrc2ThresholdEvidence(evidence);
}

export function filterHonestLimitReviewDebt(pendingReceipts, context = {}) {
  const pending = Array.isArray(pendingReceipts) ? pendingReceipts : [];
  if (!rrc2HonestLimitReceiptsSufficient(context)) return pending;
  return pending.filter((receipt) => !RRC2_HONEST_LIMIT_TEMPO_RECEIPTS.has(receipt));
}
