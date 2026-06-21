// verdict.js — PASS-CANDIDATE / HONEST-LIMIT / FAIL labelling, traced to the
// CONTINUATION-BEHAVIOR-SPEC. This is the heart of "receipts are the product,
// not a green exit code".
//
// ⚠️ The harness LABELS candidates. Humans VERDICT. Every function here returns
// one of the three labels plus the evidence it used and the spec anchor it
// traced to; it never asserts a final corpus verdict. See README "Human verdict
// required".
//
// Label semantics (from RUNBOOKS/PROOF-CORPUS-METHOD.md "Honest substrate-
// findings vs PASS-shapes"):
//   PASS-CANDIDATE  — the canonical behavior's receipts are all present; a human
//                     should confirm transcript meaning + trace, then mark ✅.
//   HONEST-LIMIT    — a substrate/policy condition blocked the PASS-shape; the
//                     condition itself is evidence (e.g. tool absent from a
//                     lightContext surface, threshold reject, saturation gate).
//                     NOT a failure.
//   FAIL-CANDIDATE  — the canonical behavior failed in a way that looks like a
//                     regression (e.g. tool accepted but NO successor turn / NO
//                     task ledger / NO return). A human escalates to Gate-1.
//   INCONCLUSIVE    — not enough receipts captured (timeout, lost frames). Re-run
//                     with longer waits; do not bank as FAIL.

export const PASS = 'PASS-CANDIDATE';
export const LIMIT = 'HONEST-LIMIT';
export const FAIL = 'FAIL-CANDIDATE';
export const INCONCLUSIVE = 'INCONCLUSIVE';

export function label(verdict, specAnchor, evidence, human) {
  return {
    verdict,
    specAnchor,                 // e.g. "CONTINUATION-BEHAVIOR-SPEC §test-1"
    evidence: evidence || {},   // the receipts that drove the label
    humanReviewRequired: true,  // ALWAYS — k6 never finalizes a verdict
    humanGuidance: human || 'Confirm transcript meaning + Tempo trace before finalizing.',
  };
}

// preflight tool-visibility: absent tool is NOT a fire-blind-anyway; it is an
// HONEST-LIMIT classification (spec §"4 surfaces × 2 contexts": lightContext
// leaf has NO tool — bracket is its only path; main has tool+bare-token).
export function classifyToolVisibility(toolName, visible, context) {
  if (visible) {
    return label(PASS, 'CONTINUATION-BEHAVIOR-SPEC §surfaces',
      { tool: toolName, visible: true, context },
      `${toolName} is in the effective surface for ${context}; tool-form rows can fire.`);
  }
  // absent — could be by-design (lightContext leaf) or a setup gap.
  return label(LIMIT, 'CONTINUATION-BEHAVIOR-SPEC §surfaces',
    { tool: toolName, visible: false, context },
    `${toolName} ABSENT from ${context} surface. If ${context} is a lightContext ` +
    `leaf this is BY-DESIGN (bracket-only path) → HONEST-LIMIT, fire the TOKEN form, ` +
    `do NOT blind-fire the tool. If ${context} is main/root, investigate policy.`);
}

// continue_work tool fire (test-1): exactly one successor turn at the delay.
// receipts: { accepted, successorTurnObserved, chainCorrelated, traceId }
export function classifyContinueWorkTool(r) {
  const ev = { ...r };
  if (r.accepted === false) {
    // a policy refusal could be a legit reject row (budget/depth) — but for the
    // plain R-CW-1 smoke a refusal is unexpected. Flag for human; lean FAIL.
    return label(FAIL, 'CONTINUATION-BEHAVIOR-SPEC §test-1', ev,
      'continue_work tool REFUSED on a plain smoke fire. Unexpected unless this is ' +
      'a budget/depth reject row — confirm the refusal shape, else escalate.');
  }
  if (r.accepted === true && r.successorTurnObserved && r.chainCorrelated) {
    return label(PASS, 'CONTINUATION-BEHAVIOR-SPEC §test-1', ev,
      'Tool accepted + successor turn observed + chain correlated. Confirm the ' +
      'trace (wake_event_trace.json) then mark ✅. ERRONEOUS would be 0 turns or >1.');
  }
  if (r.accepted === true && !r.successorTurnObserved) {
    return label(FAIL, 'CONTINUATION-BEHAVIOR-SPEC §test-1', ev,
      'Tool accepted but NO successor turn observed within the wait window. This is ' +
      'the test-1 ERRONEOUS shape (drop). If the seat was genuinely busy, re-run on a ' +
      'quiet seat before banking FAIL.');
  }
  return label(INCONCLUSIVE, 'CONTINUATION-BEHAVIOR-SPEC §test-1', ev,
    'Insufficient receipts (no tool response captured). Re-run with a longer wait.');
}

// continue_work TOKEN form (test-2 parity / R-CW-TOKEN): the bare CONTINUE_WORK:N
// at end of reply text DRIVES hop-2 (not merely stripped). The both-forms
// mandate: this is an INDEPENDENT code path from the tool (tokens.ts parser).
// receipts: { promptSent, hop2Observed, nonceEchoedInHop2, traceId }
export function classifyContinueWorkToken(r) {
  const ev = { ...r };
  if (r.promptSent && r.hop2Observed && r.nonceEchoedInHop2) {
    return label(PASS, 'CONTINUATION-BEHAVIOR-SPEC §test-2 (both-forms)', ev,
      'Bare-token CONTINUE_WORK drove hop-2 AND the nonce surfaced in hop-2 → the ' +
      'parsed response-token actually fired the continuation (not just stripped). ' +
      'This is the path #952 broke on; confirm the nonce + trace then ✅.');
  }
  if (r.promptSent && !r.hop2Observed) {
    return label(FAIL, 'CONTINUATION-BEHAVIOR-SPEC §test-2 (both-forms)', ev,
      'Prompt instructing terminal CONTINUE_WORK was sent but NO hop-2 fired. If the ' +
      'token was merely stripped with no continuation, this is the token-path break ' +
      '(#952 shape). Confirm the agent actually emitted the terminal token first ' +
      '(model-compliance), else re-run; if it emitted it and no hop-2 → FAIL.');
  }
  if (r.promptSent && r.hop2Observed && !r.nonceEchoedInHop2) {
    return label(INCONCLUSIVE, 'CONTINUATION-BEHAVIOR-SPEC §test-2 (both-forms)', ev,
      'A hop-2 turn occurred but the nonce was not detected — cannot confirm the ' +
      'continuation carried THIS election vs an unrelated turn. Inspect transcript.');
  }
  return label(INCONCLUSIVE, 'CONTINUATION-BEHAVIOR-SPEC §test-2 (both-forms)', ev,
    'Insufficient receipts. Confirm sessions.send landed + widen the observe window.');
}

// continue_delegate tool fire (test-5 / R-CD-1): schedule -> spawn -> return.
// receipts: { accepted, taskLedgerEntry, childKeyOrRunId, parentReturnObserved, traceId }
export function classifyContinueDelegateTool(r) {
  const ev = { ...r };
  if (r.accepted === false) {
    return label(FAIL, 'CONTINUATION-BEHAVIOR-SPEC §test-5', ev,
      'continue_delegate REFUSED on a plain smoke fire. Confirm the refusal shape ' +
      '(depth/cost-cap reject is a different row) else escalate.');
  }
  if (r.accepted && r.taskLedgerEntry && r.childKeyOrRunId && r.parentReturnObserved) {
    return label(PASS, 'CONTINUATION-BEHAVIOR-SPEC §test-5', ev,
      'Accepted + task-ledger entry + child run + parent return all present → full ' +
      'schedule→spawn→return. Confirm the trace (dispatch→child run stitch) then ✅.');
  }
  if (r.accepted && r.taskLedgerEntry && !r.parentReturnObserved) {
    return label(INCONCLUSIVE, 'CONTINUATION-BEHAVIOR-SPEC §test-5', ev,
      'Delegate spawned (task-ledger present) but the parent RETURN was not observed ' +
      'in the window. The child may still be running — extend the wait. Only bank FAIL ' +
      'if the child completed and the return never arrived.');
  }
  if (r.accepted && !r.taskLedgerEntry) {
    return label(FAIL, 'CONTINUATION-BEHAVIOR-SPEC §test-5', ev,
      'Tool accepted but NO task-ledger entry appeared → no spawn (test-5 ERRONEOUS). ' +
      'Verify tasks.list method name against the deployed SHA before banking FAIL.');
  }
  return label(INCONCLUSIVE, 'CONTINUATION-BEHAVIOR-SPEC §test-5', ev,
    'Insufficient receipts (no tool response). Re-run with longer waits.');
}

// continue_delegate TOKEN form (test-6 / R-CD-TOKEN): [[CONTINUE_DELEGATE: …]]
// bracket parser path, parity with the tool. Independent code path
// (subagent-announce.ts:453 / tokens.ts bracket parse).
// receipts: { promptSent, childObserved, parentReturnObserved, traceId }
export function classifyContinueDelegateToken(r) {
  const ev = { ...r };
  // R-CD-owner correction (🌊): under `silent-wake` the return is INTERNAL
  // CONTEXT + a FRESH PARENT TURN (the WAKE) — it is NOT channel-posted, so the
  // transcript-nonce (`parentReturnObserved`) is OPTIONAL and frequently ABSENT
  // on a correct silent-wake. The parent-side receipt is satisfied by EITHER the
  // wake (`parentWoke`) OR the transcript echo (`parentReturnObserved`).
  const parentSideReceipt = r.parentWoke || r.parentReturnObserved;
  if (r.promptSent && r.childObserved && parentSideReceipt) {
    const via = r.parentWoke ? 'parent WOKE (fresh turn — silent-wake receipt)'
                             : 'parent transcript echo';
    return label(PASS, 'CONTINUATION-BEHAVIOR-SPEC §test-6 (both-forms)', ev,
      'Bracket [[CONTINUE_DELEGATE | silent-wake]] spawned a child AND the parent-' +
      `side return landed via ${via} → bracket-parser path at parity with the tool. ` +
      'Confirm trace + the bracket appeared terminal in the reply, then ✅. NOTE: ' +
      'absence of the transcript echo under silent-wake is EXPECTED (silent return), ' +
      'not a failure — the WAKE is the correct receipt.');
  }
  if (r.promptSent && r.childObserved && !parentSideReceipt) {
    return label(LIMIT, 'CONTINUATION-BEHAVIOR-SPEC §test-6 (both-forms)', ev,
      'Bracket spawned a child but NEITHER a parent wake NOR a transcript return was ' +
      'observed in-window. Under silent-wake the wake can be the only parent signal — ' +
      'widen the observe window / confirm the wake event surfaces in the operator ' +
      'stream. HONEST-LIMIT (observation gap), not a confirmed break, until the wake ' +
      'is verified absent.');
  }
  if (r.promptSent && !r.childObserved) {
    return label(FAIL, 'CONTINUATION-BEHAVIOR-SPEC §test-6 (both-forms)', ev,
      'Prompt instructing terminal [[CONTINUE_DELEGATE]] sent but NO child spawned. ' +
      'Confirm the agent emitted the bracket terminally (model-compliance) first; if ' +
      'it did and no child → the bracket parser path is broken (the both-forms gap).');
  }
  return label(INCONCLUSIVE, 'CONTINUATION-BEHAVIOR-SPEC §test-6 (both-forms)', ev,
    'Insufficient receipts. Confirm sessions.send landed + widen the observe window.');
}

// Roll a set of per-step labels into a row-level candidate. The row is only a
// PASS-candidate if EVERY required step is a PASS-candidate; any FAIL dominates;
// otherwise HONEST-LIMIT/INCONCLUSIVE as appropriate. Humans still finalize.
export function rollup(stepLabels) {
  const verdicts = stepLabels.map((s) => s.verdict);
  let rowVerdict = PASS;
  if (verdicts.includes(FAIL)) rowVerdict = FAIL;
  else if (verdicts.includes(INCONCLUSIVE)) rowVerdict = INCONCLUSIVE;
  else if (verdicts.includes(LIMIT)) rowVerdict = LIMIT;
  return {
    rowVerdict,
    humanReviewRequired: true,
    steps: stepLabels,
  };
}
