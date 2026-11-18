// Why a run still owes its trace receipts, read from the run's own record.
//
// summarize-review-debt.mjs routed every pending trace receipt without a trace
// ID to `tempo-trace-unfetchable: rerun with trace emission or explicitly
// accept trace-missing as an honest review limit`. In live run 44245772142
// (emeric, openclaw ab5a30ea, docs fe8e3c21) that sent seven rows to a Tempo
// investigation, and none of them was a Tempo miss:
//   - R-CD-3, R-CD-MODEL-CHAINED-ALT, R-CD-MODEL-TOKEN and R-CD-MODEL-TOOL
//     refused or stopped before dispatch, so they recorded no reason
//     fingerprint and the collector refused (`invalid evidence reason hash:
//     (empty)`) without querying Tempo;
//   - R-CD-TOKEN stopped at its pre-dispatch surface gate;
//   - R-CD-COLLECTION-ON-COLLAPSE is a static validator that fires nothing;
//   - R-CD-MODEL-DEFAULT dispatched, but its parent relayed a rewritten task,
//     so Tempo held the dispatch span under another reason fingerprint.
//
// What decides the route is already in the run directory: the row manifest
// the runner copies there and the public evidence record run-proofs.sh embeds
// in run-result.json. This module reads nothing else. It only routes debt: it
// never holds, clears or adds a receipt, and it reads no trace.

import { traceRequirement } from './continuation-trace-requirement.mjs';
import { isoSeconds, traceCorrelationWindow } from './trace-correlation-window.mjs';

// The tools whose trace collect-continuation-trace.mjs attributes by the reason
// fingerprint the scenario records (traceContract), with the accepted-entry
// span it searches for. Every other continuation row is attributed by a tool
// window and keeps the generic route.
const FINGERPRINT_ACCEPT_SPANS = Object.freeze({
  continue_delegate: 'continuation.delegate.dispatch',
  continue_work: 'continuation.work',
});

// Evidence fields in which a scenario names why it stopped before dispatch,
// and the booleans in which it says whether it dispatched (sent, or had the
// send accepted), in the order read.
const ROW_REASON_FIELDS = ['dispatch_refused', 'verdict_reason'];
const ROW_DISPATCH_FIELDS = ['dispatched', 'proof_dispatched', 'dispatch_accepted'];
const ROW_REASON_MAX_CHARS = 240;
const TOKEN = /^[a-z][a-z0-9-]{0,63}$/u;

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function oneLine(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]+/gu, ' ').trim();
  if (!text) return null;
  return text.length > ROW_REASON_MAX_CHARS ? `${text.slice(0, ROW_REASON_MAX_CHARS - 1)}…` : text;
}

// True when any field says the row dispatched, false only when none does and
// one says it did not: conflicting fields (a proof sent but an earlier send
// refused) never read as "no continuation ran".
function rowDispatched(evidence) {
  const values = ROW_DISPATCH_FIELDS.map((field) => evidence[field]).filter((value) => typeof value === 'boolean');
  if (values.includes(true)) return true;
  return values.includes(false) ? false : null;
}

// The scenario's own reason, or, for a row its runner stopped before the
// scenario ran (R-CD-TOKEN's pre-dispatch gate), the runner's verdict source.
function rowReason(evidence, runResult, dispatched) {
  for (const field of ROW_REASON_FIELDS) {
    const text = oneLine(evidence[field]);
    if (text) return text;
  }
  const source = runResult.verdictSource;
  return dispatched === false && typeof source === 'string' && TOKEN.test(source) ? `verdict source ${source}` : null;
}

// The collector's own fingerprint rule (traceContract, safeHex).
function reasonFingerprint(evidence) {
  const hash = typeof evidence.reason_hash === 'string' ? evidence.reason_hash.toLowerCase() : '';
  const length = evidence.reason_length;
  if (!/^[0-9a-f]{16}$/u.test(hash) || /^0+$/u.test(hash)) return null;
  if (!Number.isInteger(length) || length < 1) return null;
  return { hash, length };
}

function withReason(text, reason) {
  return reason ? `${text} (row reason: ${reason})` : text;
}

/**
 * The route for one pending receipt of a run, or null to keep the generic
 * route. Only the trace receipts a fingerprint-attributed continuation row owes
 * (traceRequirement) are routed, and only when the run carries its row
 * manifest and its runner-recorded evidence.
 */
export function traceDebtRoute({ manifest, runResult, receipt }) {
  if (!plainObject(manifest)) return null;
  const requirement = traceRequirement(manifest);
  if (!requirement.continuation || !requirement.receipts.includes(receipt)) return null;
  const acceptSpan = FINGERPRINT_ACCEPT_SPANS[requirement.tool];
  if (!acceptSpan) return null;

  if (manifest.transport === 'offline') {
    return {
      class: 'trace-static-row',
      action: 'this row validates committed receipts offline and fires nothing, so no run of it can produce a trace: confirm the committed live run\'s trace at fold review',
    };
  }

  // Every run-result writer in run-proofs.sh records `evidence`, null when the
  // row has no public evidence record (since 891831e4). A result without the
  // key predates that or was not written by the runner: it says nothing.
  if (!plainObject(runResult) || !Object.hasOwn(runResult, 'evidence')) return null;
  // A failed public redaction also leaves `evidence` null, but the collector
  // had already run on the private record, so its absence says nothing here.
  const pending = Array.isArray(runResult.review?.pendingReceipts) ? runResult.review.pendingReceipts : [];
  if (pending.includes('public-safe-evidence')) return null;
  const evidence = runResult.evidence;
  if (evidence === null) {
    return {
      class: 'trace-no-row-evidence',
      action: 'the row wrote no evidence record, so the collector had no dispatch to attribute: resolve the row\'s own failure, then refire the row',
    };
  }
  if (!plainObject(evidence)) return null;
  // A row whose public evidence is a signed authoritative receipt (R-CD-2)
  // withholds its acquisition fields by design; their absence says nothing.
  if (Object.hasOwn(evidence, 'authoritativeReceipt')) return null;

  const dispatched = rowDispatched(evidence);
  const reason = rowReason(evidence, runResult, dispatched);
  const fingerprint = reasonFingerprint(evidence);
  if (!fingerprint) {
    return {
      class: 'trace-no-reason-fingerprint',
      rowReason: reason,
      rowDispatched: dispatched,
      action: withReason(dispatched === true
        ? 'the row records a dispatch but no reason fingerprint, so the collector had nothing to search Tempo by: ' +
          'a scenario defect (#600); fix the scenario, then refire the row'
        : 'the row recorded no reason fingerprint, so the collector had nothing to search Tempo by and queried nothing: ' +
          'a row that refused or stopped before dispatch owes its behavior first, so clear its own reason and refire it; ' +
          'a row that dispatched without recording one has a scenario defect (#600)', reason),
    };
  }
  // Scenarios record the fingerprint as they send the instruction, so a row
  // whose own record says the dispatch was not made or not accepted has one
  // and still ran no continuation.
  if (dispatched === false) {
    return {
      class: 'trace-not-dispatched',
      reasonHash: fingerprint.hash,
      reasonLength: fingerprint.length,
      rowReason: reason,
      rowDispatched: dispatched,
      action: withReason(`the row recorded the fingerprint of the task it meant to dispatch (${fingerprint.hash}/${fingerprint.length}), ` +
        'but its own record says the dispatch was not made or not accepted, so no continuation ran to trace: ' +
        'clear its own reason and refire the row', reason),
    };
  }

  const mode = requirement.tool === 'continue_delegate'
    ? (typeof evidence.delegate_mode === 'string' && evidence.delegate_mode) || manifest.invocation?.mode
    : undefined;
  const delegateMode = typeof mode === 'string' && TOKEN.test(mode) ? mode : null;
  const searched = traceCorrelationWindow(evidence);
  const window = searched && isoSeconds(searched.start) && isoSeconds(searched.end)
    ? { start: isoSeconds(searched.start), end: isoSeconds(searched.end) }
    : null;
  return {
    class: 'tempo-trace-uncorrelated',
    reasonHash: fingerprint.hash,
    reasonLength: fingerprint.length,
    delegateMode,
    acceptSpan,
    window,
    action: `the row recorded reason fingerprint ${fingerprint.hash}/${fingerprint.length}` +
      (delegateMode ? ` (mode ${delegateMode})` : '') +
      ' but no trace was correlated: read continuation-trace-collector.error.log first. If it reads "no Tempo trace matched", search Tempo for ' +
      `${acceptSpan} spans in the collector's window ${window ? `${window.start}..${window.end}` : '(none recorded)'} and compare reason.hash/reason.length before any refire: ` +
      'a span there under another fingerprint means the agent relayed different task bytes than the scenario fingerprinted. ' +
      'Any other collector error names its own cause',
  };
}
