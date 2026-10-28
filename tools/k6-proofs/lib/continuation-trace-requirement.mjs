// Continuation trace requirement (karmaterminal-openclaw-docs#600).
//
// openclaw-bootstrap RUNBOOKS/PROOF-CORPUS-METHOD.md § "Tempo trace
// requirement": a continuation-tool PASS without its Tempo trace JSON is
// INCOMPLETE. Whether a row owes that trace is a property of the surface the
// row fires, not of how its manifest happens to spell a receipt name. The old
// gate keyed on the receipt names `trace-id` / `tempo-trace-json`, so a row
// spelled `tempo-trace` (R-CW-TOKEN) or one that named no trace receipt at all
// (R-CW-DELEGATE-SELF-CONTINUATION and twelve more) skipped the collector and
// reported review complete with no trace and no pending receipt.
//
// This module is the one owner of that decision. run-proofs.sh (through
// scripts/continuation-trace-requirement.mjs), the candidate-run-result writer
// and consumer contract, the review-debt summary and the manifest checker all
// call it; none of them restates the predicate.
//
// Node only, dependency-free.

/** Typed continuation tools. Firing one is what makes a row owe a trace. */
export const CONTINUATION_TOOLS = Object.freeze(['continue_work', 'continue_delegate', 'request_compaction']);

/**
 * Manifest tool surfaces that drive a continuation wake by token
 * (`CONTINUE_WORK`, `CONTINUE_WORK:N`, `[[CONTINUE_DELEGATE: ...]]`), whatever
 * tool the harness uses to reach the token's origin (R-CW-TOKEN fires
 * `sessions_spawn`). row-manifest.schema.json has no non-continuation token
 * surface.
 */
export const CONTINUATION_TOKEN_SURFACES = Object.freeze(['token', 'bracket-token']);

export const TEMPO_TRACE_RECEIPT = 'tempo-trace-json';
export const CONTINUATION_TRACE_CORRELATION_RECEIPT = 'continuation-trace-correlation';
export const TOOL_TRACE_CORRELATION_RECEIPT = 'tool-trace-correlation';

/**
 * Tools whose trace collect-continuation-trace.mjs attributes by the
 * continuation accept/fire topology; it writes
 * continuation-trace-correlation.json for these and tool-trace-correlation.json
 * for every other tool.
 */
const CONTINUATION_CORRELATED_TOOLS = new Set(['continue_work', 'continue_delegate']);

/**
 * Receipt spellings that mean a canonical receipt. They name the same
 * requirement, and the manifest checker refuses them so the catalog carries
 * one spelling.
 */
export const TRACE_RECEIPT_ALIASES = Object.freeze({ 'tempo-trace': TEMPO_TRACE_RECEIPT });

/**
 * Receipt names (after normalization) that declare a Tempo trace receipt.
 * `trace-id` is the legacy declaration the old gate accepted.
 */
const DECLARED_TRACE_RECEIPTS = new Set(['trace-id', TEMPO_TRACE_RECEIPT]);

export function normalizeReceiptName(name) {
  const text = String(name ?? '').trim().toLowerCase();
  return Object.hasOwn(TRACE_RECEIPT_ALIASES, text) ? TRACE_RECEIPT_ALIASES[text] : text;
}

/** The correlation receipt the collector writes for a row firing `tool`. */
export function correlationReceiptFor(tool) {
  if (CONTINUATION_CORRELATED_TOOLS.has(tool)) return CONTINUATION_TRACE_CORRELATION_RECEIPT;
  // A token row with no tool cannot be attributed by the collector at all; it
  // still owes the continuation correlation its wake would produce.
  return tool ? TOOL_TRACE_CORRELATION_RECEIPT : CONTINUATION_TRACE_CORRELATION_RECEIPT;
}

function invocationTool(manifest) {
  const tool = manifest?.invocation?.tool;
  return typeof tool === 'string' && tool.trim() ? tool.trim() : null;
}

/**
 * What a row owes in trace receipts.
 *
 * `continuation` is structural: the row fires a continuation tool or drives a
 * continuation token. It owes the Tempo trace JSON and the correlation receipt
 * the collector produces, and the collector must run for it.
 *
 * `declared` is the old floor kept for rows outside that set: a manifest that
 * declares a trace receipt still owes the trace JSON, never less than before.
 */
export function traceRequirement(manifest) {
  const tool = invocationTool(manifest);
  const surface = typeof manifest?.toolSurface === 'string' ? manifest.toolSurface : null;
  const requiredReceipts = Array.isArray(manifest?.liveRunSafety?.requiredReceipts)
    ? manifest.liveRunSafety.requiredReceipts
    : [];
  const reasons = [];
  if (tool && CONTINUATION_TOOLS.includes(tool)) reasons.push(`continuation-tool:${tool}`);
  if (surface && CONTINUATION_TOKEN_SURFACES.includes(surface)) reasons.push(`continuation-token-surface:${surface}`);
  const continuation = reasons.length > 0;
  const declared = requiredReceipts.some((name) => DECLARED_TRACE_RECEIPTS.has(normalizeReceiptName(name)));
  if (declared) reasons.push('declared-trace-receipt');
  const correlationReceipt = continuation ? correlationReceiptFor(tool) : null;
  return {
    required: continuation || declared,
    continuation,
    reasons,
    tool,
    correlationReceipt,
    receipts: continuation
      ? [TEMPO_TRACE_RECEIPT, correlationReceipt]
      : declared ? [TEMPO_TRACE_RECEIPT] : [],
  };
}

export function isTraceRequired(manifest) {
  return traceRequirement(manifest).required;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Trace receipts a run still owes, given the raw run-result observability
 * block (`traceId`, `tempoTraceJson`, `correlationReceipt`).
 *
 * `traceHeldByAuthority` is for a row whose signed authoritative receipt
 * consumed the trace and correlation and deliberately withholds them from the
 * public result (R-CD-2). Its owner decides; this module only honours it.
 */
export function traceReviewDebt(manifest, observability, { traceHeldByAuthority = false } = {}) {
  const requirement = traceRequirement(manifest);
  if (!requirement.required || traceHeldByAuthority === true) return [];
  const debt = [];
  if (!nonEmptyString(observability?.traceId) || !nonEmptyString(observability?.tempoTraceJson)) {
    debt.push(TEMPO_TRACE_RECEIPT);
  }
  if (requirement.continuation && !nonEmptyString(observability?.correlationReceipt)) {
    debt.push(requirement.correlationReceipt);
  }
  return debt;
}

/**
 * Manifest checker rule. Returns failure strings, empty when compliant.
 *
 * Every receipt name must be its canonical spelling, so `tempo-trace` and
 * `tempo-trace-json` can never again be two requirements. A continuation row
 * must declare, in both liveRunSafety.requiredReceipts and expectedReceipts
 * (required: true), exactly the trace receipts the harness will hold it to.
 */
export function manifestTraceReceiptFailures(manifest) {
  const failures = [];
  const requiredReceipts = Array.isArray(manifest?.liveRunSafety?.requiredReceipts)
    ? manifest.liveRunSafety.requiredReceipts
    : [];
  const expectedReceipts = Array.isArray(manifest?.expectedReceipts) ? manifest.expectedReceipts : [];
  for (const [label, names] of [
    ['liveRunSafety.requiredReceipts', requiredReceipts],
    ['expectedReceipts', expectedReceipts.map((receipt) => receipt?.name)],
  ]) {
    for (const name of names) {
      if (typeof name !== 'string') continue;
      const canonical = normalizeReceiptName(name);
      if (canonical !== name) {
        failures.push(`${label} names '${name}'; declare the canonical receipt '${canonical}'`);
      }
    }
  }

  const requirement = traceRequirement(manifest);
  if (!requirement.continuation) return failures;
  const why = requirement.reasons.filter((reason) => reason !== 'declared-trace-receipt').join(', ');
  const required = new Set(requiredReceipts);
  for (const receipt of requirement.receipts) {
    if (!required.has(receipt)) {
      failures.push(`continuation row (${why}) must list '${receipt}' in liveRunSafety.requiredReceipts`);
    }
    const expected = expectedReceipts.filter((entry) => entry?.name === receipt);
    if (expected.length !== 1 || expected[0].required !== true) {
      failures.push(`continuation row (${why}) must declare exactly one expectedReceipts entry '${receipt}' with required: true`);
    }
  }
  return failures;
}
