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

// The tools whose trace collect-continuation-trace.mjs attributes by the reason
// fingerprint the scenario records (traceContract), with the accepted-entry
// span it searches for. Every other continuation row is attributed by a tool
// window and keeps the generic route.
const FINGERPRINT_ACCEPT_SPANS = Object.freeze({
  continue_delegate: 'continuation.delegate.dispatch',
  continue_work: 'continuation.work',
});

// Evidence fields in which a scenario names why it stopped before dispatch,
// and the booleans in which it says whether it dispatched, in the order read.
const ROW_REASON_FIELDS = ['dispatch_refused', 'verdict_reason'];
const ROW_DISPATCH_FIELDS = ['dispatched', 'proof_dispatched', 'dispatch_accepted'];
const ROW_REASON_MAX_CHARS = 240;

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rowReason(evidence) {
  for (const field of ROW_REASON_FIELDS) {
    const value = evidence[field];
    if (typeof value !== 'string') continue;
    const text = value.replace(/[\u0000-\u001f\u007f]+/gu, ' ').trim();
    if (!text) continue;
    return text.length > ROW_REASON_MAX_CHARS ? `${text.slice(0, ROW_REASON_MAX_CHARS - 1)}…` : text;
  }
  return null;
}

function rowDispatched(evidence) {
  for (const field of ROW_DISPATCH_FIELDS) {
    if (typeof evidence[field] === 'boolean') return evidence[field];
  }
  return null;
}

// The collector's own fingerprint rule (traceContract, safeHex).
function reasonFingerprint(evidence) {
  const hash = typeof evidence.reason_hash === 'string' ? evidence.reason_hash.toLowerCase() : '';
  const length = evidence.reason_length;
  if (!/^[0-9a-f]{16}$/u.test(hash) || /^0+$/u.test(hash)) return null;
  if (!Number.isInteger(length) || length < 1) return null;
  return { hash, length };
}

function isoTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

/**
 * The route for one pending receipt of a run, or null to keep the generic
 * route. Only the trace receipts a continuation row owes (traceRequirement)
 * are routed, and only when the run carries its row manifest.
 */
export function traceDebtRoute({ manifest, runResult, receipt }) {
  if (!plainObject(manifest)) return null;
  const requirement = traceRequirement(manifest);
  if (!requirement.continuation || !requirement.receipts.includes(receipt)) return null;

  if (manifest.transport === 'offline') {
    return {
      class: 'trace-static-row',
      action: 'this row validates committed receipts offline and fires nothing, so no run of it can produce a trace: confirm the committed live run\'s trace at fold review',
    };
  }

  const evidence = runResult?.evidence;
  if (!plainObject(evidence)) {
    return {
      class: 'trace-no-row-evidence',
      action: 'the row wrote no evidence record, so the collector had no dispatch to attribute: resolve the row\'s own failure, then refire the row',
    };
  }
  // A row whose public evidence is a signed authoritative receipt (R-CD-2)
  // withholds its acquisition fields by design; their absence says nothing.
  if (Object.hasOwn(evidence, 'authoritativeReceipt')) return null;

  const acceptSpan = FINGERPRINT_ACCEPT_SPANS[requirement.tool];
  if (!acceptSpan) return null;

  const fingerprint = reasonFingerprint(evidence);
  if (!fingerprint) {
    const reason = rowReason(evidence);
    return {
      class: 'trace-no-reason-fingerprint',
      rowReason: reason,
      rowDispatched: rowDispatched(evidence),
      action: 'the row recorded no reason fingerprint, so the collector had nothing to search Tempo by and queried nothing: ' +
        'a row that refused or stopped before dispatch owes its behavior first, so clear its own reason and refire it; ' +
        'a row that dispatched without recording one has a scenario defect (#600)' +
        (reason ? ` (row reason: ${reason})` : ''),
    };
  }

  const delegateMode = requirement.tool === 'continue_delegate'
    ? (typeof evidence.delegate_mode === 'string' && evidence.delegate_mode) || manifest.invocation?.mode || null
    : null;
  const window = { start: isoTime(evidence.started), end: isoTime(evidence.ended) };
  return {
    class: 'tempo-trace-uncorrelated',
    reasonHash: fingerprint.hash,
    reasonLength: fingerprint.length,
    delegateMode,
    acceptSpan,
    window,
    action: `the row recorded reason fingerprint ${fingerprint.hash}/${fingerprint.length}` +
      (delegateMode ? ` (mode ${delegateMode})` : '') +
      ' but no trace was correlated: read continuation-trace-collector.error.log, then search Tempo for ' +
      `${acceptSpan} spans in the row window ${window.start ?? '?'}..${window.end ?? '?'} and compare reason.hash/reason.length before any refire; ` +
      'a span there under another fingerprint means the agent relayed different task bytes than the scenario fingerprinted',
  };
}
