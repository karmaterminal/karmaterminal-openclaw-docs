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
// and consumer contract, the review-debt summary, the run report, both metrics
// exporters and the manifest checker all call it; none of them restates the
// predicate.
//
// A receipt name is not a receipt. A row holds its trace only when the trace
// JSON and correlation receipt its result names are regular files in its run
// directory that bind to its trace ID, checked whenever completion is decided,
// not only when the runner wrote them.
//
// Node only, dependency-free.

import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';

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

/** The public trace projection both trace writers emit (lib/public-tempo-trace.mjs). */
const PUBLIC_TEMPO_TRACE_SCHEMA = 'openclaw.k6.public-tempo-trace.v1';

/**
 * A receipt name resolves only to a file directly in the run directory: the
 * envelope's artifact-name rule (no separator, no leading dot, so no `..` and
 * no absolute path).
 */
const RUN_DIR_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** fetch-tempo-trace.mjs's trace ID rule; both trace writers store the ID lowercased. */
function traceIdKey(value) {
  return typeof value === 'string' && /^[0-9a-f]{8,64}$/iu.test(value) ? value.toLowerCase() : null;
}

/**
 * Read receipt `name` from the run directory as `{ value }`, or `{ reason }`
 * when it is not a regular file there holding JSON. A symlink is refused
 * wherever it points; O_NOFOLLOW also refuses one swapped in after the lstat.
 * Reasons are a fixed public-safe vocabulary, never a path or an error text.
 */
function readRunDirJson(runDir, name) {
  if (typeof name !== 'string' || !name) return { reason: 'not-named' };
  if (!RUN_DIR_FILE_NAME.test(name)) return { reason: 'unsafe-name' };
  const file = path.join(runDir, name);
  let fd;
  try {
    let stat;
    try {
      stat = lstatSync(file);
    } catch (error) {
      return { reason: error?.code === 'ENOENT' ? 'missing' : 'unreadable' };
    }
    if (stat.isSymbolicLink()) return { reason: 'symlink' };
    if (!stat.isFile()) return { reason: 'not-a-regular-file' };
    try {
      fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (error?.code === 'ELOOP') return { reason: 'symlink' };
      return { reason: error?.code === 'ENOENT' ? 'missing' : 'unreadable' };
    }
    if (!fstatSync(fd).isFile()) return { reason: 'not-a-regular-file' };
    let raw;
    try {
      raw = readFileSync(fd, 'utf8');
    } catch {
      return { reason: 'unreadable' };
    }
    try {
      return { value: JSON.parse(raw) };
    } catch {
      return { reason: 'not-json' };
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Why the trace JSON does not hold `traceId`, or null when it does. */
function traceJsonProblem(runDir, name, traceId) {
  const read = readRunDirJson(runDir, name);
  if (read.reason) return read.reason;
  const trace = read.value;
  if (trace?.schema !== PUBLIC_TEMPO_TRACE_SCHEMA || !Array.isArray(trace.spans)) return 'not-public-trace-projection';
  // The public projection of `traceId`: at the top and on every span.
  if (traceIdKey(trace.traceId) !== traceId || !trace.spans.every((span) => traceIdKey(span?.traceId) === traceId)) {
    return 'trace-id-mismatch';
  }
  return null;
}

/**
 * Why the correlation receipt does not bind, or null when it does: it must be
 * the file the collector writes for this row's tool, naming `traceId` and the
 * trace JSON it wrote beside it.
 */
function correlationProblem(runDir, name, expectedName, traceId, traceJson) {
  if (typeof name === 'string' && RUN_DIR_FILE_NAME.test(name) && name !== expectedName) return 'wrong-receipt-name';
  const read = readRunDirJson(runDir, name);
  if (read.reason) return read.reason;
  const receipt = read.value;
  if (traceIdKey(receipt?.traceId) !== traceId) return 'trace-id-mismatch';
  if (typeof receipt.traceJson !== 'string' || receipt.traceJson !== traceJson) return 'trace-json-mismatch';
  return null;
}

/**
 * Whether a run holds each trace receipt it owes, given its raw run-result
 * observability block (`traceId`, `tempoTraceJson`, `correlationReceipt`) and
 * the run directory those names resolve in: `[{ receipt, held, reason }]` in
 * the order of `traceRequirement(manifest).receipts`, `reason` null when held.
 * Empty when the row owes no trace or its authority holds it.
 *
 * The trace JSON is held only when it is a regular file in `runDir` whose
 * public projection carries the result's `traceId`. The correlation receipt is
 * held only when it is the file the collector writes for this row's tool, a
 * regular file in `runDir`, naming that same trace ID and that trace JSON. A
 * deleted, replaced, stale, escaping or symlinked receipt is not held. Whether
 * a trace-required row holds its receipts cannot be decided without its run
 * directory, so a missing `runDir` throws rather than trusting the names.
 *
 * `traceHeldByAuthority` is for a row whose signed authoritative receipt
 * consumed the trace and correlation and deliberately withholds them from the
 * public result (R-CD-2). Its owner decides; this module only honours it.
 */
export function traceReceiptFindings(manifest, observability, { runDir, traceHeldByAuthority = false } = {}) {
  const requirement = traceRequirement(manifest);
  if (!requirement.required || traceHeldByAuthority === true) return [];
  if (typeof runDir !== 'string' || !runDir) {
    throw new TypeError('trace receipts need the run directory: a trace receipt counts only as a file there');
  }
  const traceId = traceIdKey(observability?.traceId);
  const traceJson = observability?.tempoTraceJson;
  const findings = [{
    receipt: TEMPO_TRACE_RECEIPT,
    reason: traceId ? traceJsonProblem(runDir, traceJson, traceId) : 'no-trace-id',
  }];
  if (requirement.continuation) {
    findings.push({
      receipt: requirement.correlationReceipt,
      reason: traceId
        ? correlationProblem(runDir, observability?.correlationReceipt, `${requirement.correlationReceipt}.json`, traceId, traceJson)
        : 'no-trace-id',
    });
  }
  return findings.map(({ receipt, reason }) => ({ receipt, held: reason === null, reason }));
}

/** Trace receipts a run still owes: the receipts traceReceiptFindings does not find held. */
export function traceReviewDebt(manifest, observability, options = {}) {
  return traceReceiptFindings(manifest, observability, options)
    .filter((finding) => !finding.held)
    .map((finding) => finding.receipt);
}

/**
 * Manifest checker rule. Returns failure strings, empty when compliant.
 *
 * Every receipt name must be its canonical spelling, so `tempo-trace` and
 * `tempo-trace-json` can never again be two requirements. A continuation row
 * must declare, in both liveRunSafety.requiredReceipts and expectedReceipts
 * (required: true), exactly the trace receipts the harness will hold it to.
 */
// The continue_delegate tool's modes (continue-delegate-tool.ts DELEGATE_MODES); `normal` is the default.
const DELEGATE_MODES = ['normal', 'silent', 'silent-wake', 'post-compaction'];

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

  // The collector attributes a continue_delegate fire by reason hash, length and
  // delegate mode (scripts/collect-continuation-trace.mjs), so a manifest that
  // leaves the mode implicit can never produce its trace receipts.
  const invocation = manifest?.invocation;
  if (invocation?.tool === 'continue_delegate' && !DELEGATE_MODES.includes(invocation.mode)) {
    failures.push(
      `continue_delegate row must declare invocation.mode (one of ${DELEGATE_MODES.join(', ')}); the trace collector attributes the fire by mode`,
    );
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
