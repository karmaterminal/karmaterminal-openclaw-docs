#!/usr/bin/env node
/**
 * Review helper for Project 81 R-CW-3 reason telemetry/redaction receipts.
 *
 * This script does not run Gateway work. It inspects an existing R-CW-3 run
 * directory and its fetched Tempo trace JSON, then writes a public-safe review
 * receipt recording what it could and could not prove.
 *
 * The receipt is JOINED, not merely adjacent to the run (#1727). Attribute
 * presence alone cannot show that a trace belongs to this candidate, this run
 * and this fire, so the helper binds the exact candidate SHA, run ID, matrix ID,
 * trace ID and chain ID against externally supplied anchors, compares the
 * exported reason hash/length against the run's own evidence, rebinds the
 * reason fingerprint to the digest-checked manifest, re-walks the tool/work/fire
 * span topology recorded by the correlation receipt, scans the public artifacts
 * themselves for raw reason material, and pins the SHA-256 of every source
 * artifact it read. Trace identity comes from the correlation receipt because
 * public evidence deliberately leaves `trace_id` null.
 *
 * Collector and sanitizer rules are reused, not restated: evidence cardinality
 * and the continuation reason contract come from collect-continuation-trace.mjs,
 * span walking and status semantics from lib/public-tempo-trace.mjs, and the
 * public-surface redaction invariant from sanitize-k6-artifacts.mjs.
 *
 * A passing receipt is mechanical verification only. It never asserts
 * coordinator acceptance, never lifts the row's PARTIAL-candidate verdict, and
 * never discharges the manual `reason-telemetry-redaction-review` debt.
 */
import { readFile, writeFile, mkdir, readdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  allTempoSpans,
  publicTempoStatusCode,
  tempoAttributeValue,
} from '../lib/public-tempo-trace.mjs';
import { sanitizeEvidenceRecords } from './sanitize-k6-artifacts.mjs';
import {
  readEvidence as readSingleEvidenceRecord,
  traceContract,
} from './collect-continuation-trace.mjs';

const RAW_SENTINEL_PREFIX = 'RAW-RCW3-';
const REASON_PREFIX = 'k6-proof-R-CW-3-redaction';
const NONCE_PLACEHOLDER = '{{nonce}}';
const ROW_ID = 'R-CW-3';
const WORK_SPAN_NAME = 'continuation.work';
const FIRE_SPAN_NAME = 'continuation.work.fire';
const TOOL_SPAN_NAME = 'openclaw.tool.execution';
const CONTINUATION_TOOL = 'continue_work';
const PENDING_REVIEW_RECEIPT = 'reason-telemetry-redaction-review';
const CORRELATION_FILE = 'continuation-trace-correlation.json';
const METADATA_FILE = 'runner-metadata.json';
const MANIFEST_COPY = 'row-manifest.json';
const SCENARIO_COPY = 'row-scenario.js';
const SUMMARY_FILE = 'r-cw-3-reason-telemetry-summary.json';
const EVIDENCE_FILE = 'evidence.jsonl';
const RECEIPT_BASENAME = 'r-cw-3-reason-telemetry-review.json';
const REVIEW_RECEIPT_SCHEMA = 'openclaw.k6.r-cw-3-reason-telemetry-review.v2';
const SHA40 = /^[0-9a-f]{40}$/iu;
const TRACE_ID_RE = /^[0-9a-f]{32}$/iu;
const SPAN_ID_RE = /^[0-9a-f]{16}$/iu;
const REASON_HASH_RE = /^[0-9a-f]{16}$/iu;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Additional public text surfaces to scan for raw reason material. The run
 * directory's `row-manifest.json` and `row-scenario.js` copies are deliberately
 * excluded: they are the contract bytes and necessarily contain the literal
 * reason template, which is not executed reason telemetry.
 */
const PUBLIC_TEXT_SURFACES = ['evidence-lines.log', 'k6.log', 'gateway-journal.log'];
const RAW_SCAN_EXCLUDED = [MANIFEST_COPY, SCENARIO_COPY];

const FLAGS = [
  '--run-dir',
  '--tempo-trace',
  '--correlation',
  '--metadata',
  '--manifest',
  '--nonce',
  '--out',
  '--expect-candidate-sha',
  '--expect-run-id',
  '--expect-matrix-id',
  '--expect-trace-id',
];

function usage() {
  console.error([
    'Usage: node review-r-cw-3-reason-telemetry.mjs --run-dir <R-CW-3 run dir>',
    '         --expect-candidate-sha <sha> --expect-run-id <id>',
    '         --expect-matrix-id <id> --expect-trace-id <traceId>',
    '         [--tempo-trace <trace.json>] [--correlation <continuation-trace-correlation.json>]',
    '         [--metadata <runner-metadata.json>] [--manifest <row-manifest.json>]',
    '         [--nonce <row nonce>] [--out <receipt.json>]',
    '',
    'The four --expect-* anchors are required for a joined-success verdict. They',
    'must come from the authorizing record of the run, not from the run directory',
    'being reviewed; without them the helper reports internal consistency only and',
    'the verdict stays review-pending.',
  ].join('\n'));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FLAGS.includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function sha256OrNull(file) {
  return sha256(file).catch(() => null);
}

async function findTempoTrace(runDir, explicit) {
  if (explicit) return path.resolve(explicit);
  const entries = await readdir(runDir).catch(() => []);
  const matches = entries.filter((name) => /^tempo-trace-[A-Fa-f0-9]{8,64}\.json$/.test(name)).sort();
  if (matches.length === 1) return path.join(runDir, matches[0]);
  if (matches.length > 1) throw new Error(`multiple tempo trace JSON files found in ${runDir}; pass --tempo-trace explicitly`);
  throw new Error(`no tempo-trace-<trace>.json found in ${runDir}; fetch it first or pass --tempo-trace`);
}

function extractAttributes(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const item of obj) extractAttributes(item, out);
    return out;
  }
  if (typeof obj.key === 'string' && obj.value && typeof obj.value === 'object') {
    out.push({ key: obj.key, value: tempoAttributeValue(obj) });
  }
  for (const value of Object.values(obj)) extractAttributes(value, out);
  return out;
}

function spanAttributes(span) {
  return new Map((span?.attributes || []).map((attribute) => [attribute.key, tempoAttributeValue(attribute)]));
}

function allStrings(obj, out = []) {
  if (obj == null) return out;
  if (typeof obj === 'string') { out.push(obj); return out; }
  if (typeof obj === 'number' || typeof obj === 'boolean') { out.push(String(obj)); return out; }
  if (Array.isArray(obj)) { for (const item of obj) allStrings(item, out); return out; }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      out.push(key);
      allStrings(value, out);
    }
  }
  return out;
}

function rawReasonHits(value) {
  const strings = allStrings(value);
  return {
    rawSentinelPrefixHits: strings.filter((s) => s.includes(RAW_SENTINEL_PREFIX)).length,
    rawReasonPrefixHits: strings.filter((s) => s.includes(REASON_PREFIX)).length,
  };
}

function status(ok, evidence) {
  return { ok, evidence };
}

function hex(value) {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

function sortedHex(values) {
  return (Array.isArray(values) ? values : []).map(hex).filter(Boolean).sort();
}

function sameSet(left, right) {
  return left.length > 0 && left.length === right.length && left.every((value, index) => value === right[index]);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Finding 2: the row's whole subject matter is redaction, so absence of raw
 * reason material must be observed in the public artifacts themselves. The
 * producer's `public_artifact_raw_reason_absent` boolean is recorded as a claim,
 * never used as the proof.
 */
function checkRawReasonAbsentFromPublicArtifacts({ surfaces }) {
  const scanned = {};
  let sentinel = 0;
  let prefix = 0;
  for (const [name, value] of Object.entries(surfaces)) {
    if (value === undefined) continue;
    const hits = rawReasonHits(value);
    scanned[name] = hits;
    sentinel += hits.rawSentinelPrefixHits;
    prefix += hits.rawReasonPrefixHits;
  }
  return status(sentinel === 0 && prefix === 0, {
    scanned,
    excluded: RAW_SCAN_EXCLUDED,
    excludedReason: 'contract bytes: the manifest and scenario copies necessarily carry the literal reason template and are not executed reason telemetry',
    producerClaimOnly: 'evidence.public_artifact_raw_reason_absent is recorded as a producer claim and is checked separately',
  });
}

/**
 * Finding 1a: the sanitizer drops every nonce / run-id / session-key /
 * idempotency-key field and scrubs their values, so a genuine public evidence
 * record is a fixed point of `sanitizeEvidenceRecords`. Anything else was not
 * produced by the sanitizer and cannot be reviewed as a public artifact.
 */
function checkPublicEvidenceSanitized({ evidence }) {
  let sanitized = null;
  let error = null;
  try {
    ({ sanitized: [sanitized] } = sanitizeEvidenceRecords([evidence]));
  } catch (cause) {
    error = cause && cause.message ? cause.message : String(cause);
  }
  const fixedPoint = error === null && JSON.stringify(sanitized) === JSON.stringify(evidence);
  const residualKeys = sanitized === null
    ? null
    : Object.keys(evidence).filter((key) => !Object.prototype.hasOwnProperty.call(sanitized, key)).sort();
  return status(fixedPoint, {
    fixedPoint,
    error,
    droppedByResanitize: residualKeys,
    note: 'public evidence must already be a fixed point of sanitize-k6-artifacts.mjs; a surviving nonce, run id or session key means the document is not sanitizer-produced',
  });
}

/**
 * Finding 1b, narrowed by parent semantic review.
 *
 * The producer collector derives the reason fingerprint from the digest-bound
 * manifest template and this fire's nonce. Public evidence is nonce-redacted by
 * policy (sanitize-k6-artifacts.mjs drops every `nonce` key), so an offline
 * review of public artifacts CANNOT independently recompute that derivation.
 *
 * What it can bind is the contract: the run directory's digest-checked manifest
 * copy must be the R-CW-3 `continue_work` contract whose reason template is
 * nonce-bearing, and the correlation receipt must record that its fingerprint
 * came from that manifest and nonce. The recorded fingerprint is then required
 * to agree across evidence, correlation and spans by
 * `reasonTelemetryMatchesEvidence`. No length heuristic is used and no
 * provenance is manufactured; the gap is stated in `limits`.
 */
function checkManifestContractBound({ manifest, correlation }) {
  const problems = [];
  const template = manifest?.invocation?.reason;
  let placeholders = 0;

  if (manifest?.rowId !== ROW_ID) problems.push('run-directory manifest copy is not the R-CW-3 manifest');
  if (manifest?.invocation?.tool !== CONTINUATION_TOOL) problems.push(`manifest invocation.tool is not ${CONTINUATION_TOOL}`);
  if (!isNonEmptyString(template)) {
    problems.push('manifest invocation.reason template is missing or not a string');
  } else {
    placeholders = template.split(NONCE_PLACEHOLDER).length - 1;
    if (placeholders < 1) problems.push('manifest reason template carries no {{nonce}} placeholder');
  }
  if (correlation?.reason?.source !== 'manifest-nonce') {
    problems.push('correlation receipt does not record a manifest-nonce reason fingerprint');
  }

  return status(problems.length === 0, {
    manifestRowId: manifest?.rowId ?? null,
    manifestTool: manifest?.invocation?.tool ?? null,
    templateLength: isNonEmptyString(template) ? template.length : null,
    noncePlaceholders: placeholders,
    correlationFingerprintSource: correlation?.reason?.source ?? null,
    scope: 'binds the reason contract and the collector-declared fingerprint source; it does not recompute the fingerprint',
    problems,
  });
}

/**
 * Only present when a nonce is supplied out of band. The collector owns the
 * continuation reason contract, so the derivation is reused from it rather than
 * restated here. The nonce itself is never written into the receipt.
 */
function checkReasonFingerprintRecomputedFromNonce({ manifest, evidence, correlation, nonce }) {
  const problems = [];
  const reasonHash = hex(evidence.reason_hash);
  const reasonLength = Number(evidence.reason_length);
  let contract = null;
  try {
    contract = traceContract(manifest, { ...evidence, nonce });
  } catch (cause) {
    problems.push(`collector reason contract rejected this run: ${cause && cause.message ? cause.message : String(cause)}`);
    return status(false, { recomputed: false, problems });
  }
  if (contract.fingerprintSource !== 'manifest-nonce') problems.push('collector did not derive the reason from the manifest and nonce');
  if (hex(contract.hash) !== reasonHash) problems.push('reason hash does not match the manifest reason rendered with the supplied nonce');
  if (contract.length !== reasonLength) problems.push('reason length does not match the manifest reason rendered with the supplied nonce');
  if (hex(correlation?.reason?.hash) !== hex(contract.hash)) problems.push('correlation reason hash does not match the manifest-derived digest');
  return status(problems.length === 0, {
    recomputed: problems.length === 0,
    method: 'collect-continuation-trace.mjs traceContract(manifest, evidence+nonce)',
    derivedReasonHash: contract.hash,
    note: 'the supplied nonce is used only for this derivation and is never written into the receipt',
    problems,
  });
}

/**
 * Every exported reason attribute on the row's own work/fire spans must carry
 * the digest and length this run actually recorded. Presence of the keys is not
 * evidence: a trace from a different fire has the same keys.
 */
function checkReasonTelemetryMatchesEvidence({ evidence, correlation, workSpans, fireSpans }) {
  const reasonHash = hex(evidence.reason_hash);
  const reasonLength = Number(evidence.reason_length);
  const detail = {
    evidenceReasonHash: reasonHash,
    evidenceReasonLength: Number.isFinite(reasonLength) ? reasonLength : null,
    correlationReasonHash: hex(correlation?.reason?.hash),
    correlationReasonLength: correlation?.reason?.length ?? null,
    correlationRawPersisted: correlation?.reason?.rawPersisted ?? null,
    workSpans: workSpans.length,
    fireSpans: fireSpans.length,
    mismatchedSpans: [],
  };
  if (!reasonHash || !REASON_HASH_RE.test(reasonHash) || !Number.isInteger(reasonLength) || reasonLength <= 0) {
    return status(false, { ...detail, reason: 'public evidence lacks a usable reason hash/length' });
  }
  if (workSpans.length !== 1 || fireSpans.length === 0) {
    return status(false, { ...detail, reason: 'trace does not carry exactly one work span and at least one fire span' });
  }
  for (const span of [...workSpans, ...fireSpans]) {
    const attrs = spanAttributes(span);
    const present = attrs.get('reason.present');
    const spanHash = hex(attrs.get('reason.hash'));
    const spanLength = Number(attrs.get('reason.length'));
    if (present !== true && present !== 'true') {
      detail.mismatchedSpans.push({ span: span.name, field: 'reason.present', observed: present ?? null });
    }
    if (spanHash !== reasonHash) {
      detail.mismatchedSpans.push({ span: span.name, field: 'reason.hash', matchesEvidence: false });
    }
    if (spanLength !== reasonLength) {
      detail.mismatchedSpans.push({ span: span.name, field: 'reason.length', observed: Number.isFinite(spanLength) ? spanLength : null });
    }
  }
  if (detail.correlationReasonHash !== reasonHash || detail.correlationReasonLength !== reasonLength) {
    detail.mismatchedSpans.push({ span: CORRELATION_FILE, field: 'reason', matchesEvidence: false });
  }
  if (detail.correlationRawPersisted !== false) {
    detail.mismatchedSpans.push({ span: CORRELATION_FILE, field: 'reason.rawPersisted', observed: detail.correlationRawPersisted });
  }
  return status(detail.mismatchedSpans.length === 0, detail);
}

/**
 * The correlation receipt is the row's identity join. Re-derive its topology
 * from the trace rather than trusting its own booleans, under the collector's
 * own rules: for this typed-tool row exactly one originating `continue_work`
 * tool span, work and fire parented to that same span, accept and fire status
 * OK, and the tool span neither errored nor blocked (finding 3).
 */
function checkTraceTopologyBound({ correlation, trace, workSpans, fireSpans, toolSpans }) {
  const traceId = hex(correlation?.traceId);
  const chainId = hex(correlation?.chainId);
  const declaredTools = sortedHex(correlation?.toolSpanIds);
  const declaredFires = sortedHex(correlation?.fireSpanIds?.length ? correlation.fireSpanIds : [correlation?.fireSpanId]);
  const observedTools = sortedHex(toolSpans.map((span) => span.spanId));
  const observedFires = sortedHex(fireSpans.map((span) => span.spanId));
  const workSpanId = hex(workSpans[0]?.spanId);
  const workParent = hex(workSpans[0]?.parentSpanId);
  const fireParents = [...new Set(fireSpans.map((span) => hex(span.parentSpanId)))];
  const spanTraceIds = [...new Set([...workSpans, ...fireSpans, ...toolSpans].map((span) => hex(span.traceId)))];
  const chainAttrs = [...new Set([...workSpans, ...fireSpans].map((span) => hex(spanAttributes(span).get('chain.id'))))];
  const lifecycleSpanIds = [workSpanId, ...observedFires, ...observedTools].filter(Boolean);
  const problems = [];

  if (correlation?.row !== ROW_ID) problems.push('correlation receipt is not an R-CW-3 receipt');
  if (correlation?.attribution !== 'reason-hash-length') problems.push('correlation receipt was not attributed by reason hash/length');
  if (correlation?.resultClass !== 'unique') problems.push('correlation receipt did not resolve a unique trace');
  if (correlation?.sameTrace !== true || correlation?.sameChain !== true || correlation?.distinctSpans !== true) {
    problems.push('correlation receipt does not assert one trace, one chain and distinct spans');
  }
  if (correlation?.continuation?.tool !== CONTINUATION_TOOL) problems.push(`correlation receipt is not a ${CONTINUATION_TOOL} join`);
  if (correlation?.continuation?.originSurface !== 'typed-tool') problems.push('correlation receipt does not record a typed-tool origin surface');
  if (correlation?.continuation?.acceptSpan !== WORK_SPAN_NAME || correlation?.continuation?.fireSpan !== FIRE_SPAN_NAME) {
    problems.push('correlation receipt names unexpected accept/fire spans');
  }
  if (!traceId || !TRACE_ID_RE.test(traceId)) problems.push('correlation receipt lacks a well-formed trace id');
  if (!chainId || !UUID_V4_RE.test(chainId)) problems.push('correlation receipt lacks a public-safe UUIDv4 chain id');
  if (trace?.traceId !== undefined && hex(trace.traceId) !== traceId) problems.push('trace JSON trace id does not match the correlation receipt');
  if (spanTraceIds.length !== 1 || spanTraceIds[0] !== traceId) problems.push('tool/work/fire spans do not all carry the correlated trace id');

  // A typed continue_work row has exactly one originating tool span, and both
  // continuation spans hang off that one span (collect-continuation-trace.mjs).
  if (toolSpans.length !== 1) {
    problems.push(`trace carries ${toolSpans.length} originating ${CONTINUATION_TOOL} tool spans; exactly one is required`);
  }
  if (declaredTools.length !== 1) problems.push('correlation receipt declares more than one originating tool span');
  if (!workSpanId || workSpanId !== hex(correlation?.workSpanId)) problems.push('work span id does not match the correlation receipt');
  if (!sameSet(observedFires, declaredFires)) problems.push('fire span ids do not match the correlation receipt');
  if (!sameSet(observedTools, declaredTools)) problems.push('tool span ids do not match the correlation receipt');
  if (!workParent || workParent !== hex(correlation?.workParentSpanId)) problems.push('work parent span id does not match the correlation receipt');
  if (fireParents.length !== 1 || fireParents[0] !== hex(correlation?.fireParentSpanId)) {
    problems.push('fire parent span id does not match the correlation receipt');
  }
  if (!workParent || fireParents.length !== 1 || workParent !== fireParents[0]) {
    problems.push('work and fire spans do not share one originating tool span');
  }
  if (!declaredTools.includes(workParent)) problems.push('work span is not parented to the originating tool span');
  if (!declaredTools.includes(fireParents[0])) problems.push('fire span is not parented to the originating tool span');
  if (correlation?.fireAttemptCount !== observedFires.length) problems.push('fire attempt count does not match the trace');
  if (new Set(lifecycleSpanIds).size !== lifecycleSpanIds.length) problems.push('tool/work/fire span ids are not distinct');
  if (!lifecycleSpanIds.every((id) => SPAN_ID_RE.test(id))) problems.push('a lifecycle span id is not a well-formed span id');
  if (chainAttrs.length !== 1 || chainAttrs[0] !== chainId) problems.push('work and fire spans do not share the correlated chain id');

  const workStatus = publicTempoStatusCode(workSpans[0]?.status?.code);
  if (workStatus !== 'OK') problems.push(`${WORK_SPAN_NAME} span is not status OK`);
  for (const span of fireSpans) {
    if (publicTempoStatusCode(span.status?.code) !== 'OK') problems.push(`${FIRE_SPAN_NAME} span is not status OK`);
  }
  for (const span of toolSpans) {
    const attrs = spanAttributes(span);
    if (attrs.get('gen_ai.tool.name') !== CONTINUATION_TOOL) {
      problems.push(`tool span is not a ${CONTINUATION_TOOL} execution`);
    }
    if (!['UNSET', 'OK'].includes(publicTempoStatusCode(span.status?.code)) || attrs.get('openclaw.outcome') === 'blocked') {
      problems.push(`originating ${CONTINUATION_TOOL} tool span is error, blocked, or has unknown status`);
    }
  }

  return status(problems.length === 0, {
    traceId,
    chainId,
    workSpanId,
    workParentSpanId: workParent,
    fireSpanIds: observedFires,
    fireParentSpanIds: fireParents,
    toolSpanIds: observedTools,
    workSpanStatus: workStatus,
    fireSpanStatuses: fireSpans.map((span) => publicTempoStatusCode(span.status?.code)),
    toolSpanStatuses: toolSpans.map((span) => publicTempoStatusCode(span.status?.code)),
    problems,
  });
}

/**
 * Finding 4: self-consistency is not provenance. A joined-success verdict needs
 * all four anchors, supplied from outside the run directory under review.
 */
function checkExternalAnchorsBound({ expectations, metadata, correlation, runDir }) {
  const problems = [];
  const { candidateSha, runId, matrixId, traceId } = expectations;
  if (!isNonEmptyString(candidateSha)) problems.push('--expect-candidate-sha is required');
  else if (!SHA40.test(candidateSha)) problems.push('--expect-candidate-sha is not a 40-hex commit SHA');
  else if (hex(candidateSha) !== hex(metadata?.candidateSha)) problems.push('candidate SHA does not match the expected candidate');

  if (!isNonEmptyString(runId)) problems.push('--expect-run-id is required');
  else if (runId !== metadata?.runId) problems.push('run id does not match the expected run');
  else if (runId !== path.basename(runDir)) problems.push('expected run id does not match the run directory');

  if (!isNonEmptyString(matrixId)) problems.push('--expect-matrix-id is required');
  else if (matrixId !== metadata?.matrixId) problems.push('matrix id does not match the expected matrix');

  if (!isNonEmptyString(traceId)) problems.push('--expect-trace-id is required');
  else if (!TRACE_ID_RE.test(traceId)) problems.push('--expect-trace-id is not a 32-hex trace id');
  else if (hex(traceId) !== hex(correlation?.traceId)) problems.push('trace id does not match the expected collected trace');

  return status(problems.length === 0, {
    supplied: {
      candidateSha: isNonEmptyString(candidateSha),
      runId: isNonEmptyString(runId),
      matrixId: isNonEmptyString(matrixId),
      traceId: isNonEmptyString(traceId),
    },
    note: 'anchors must come from the authorizing record of the run, not from the run directory under review',
    problems,
  });
}

/** Bind the receipt to one candidate, one matrix, one run and one seat. */
function checkIdentityBound({ evidence, metadata, correlation, runDir }) {
  const candidateSha = hex(metadata?.candidateSha);
  const runtimeBuildSha = hex(metadata?.runtimeBuildSha);
  const problems = [];

  if (evidence.row !== ROW_ID) problems.push('public evidence row is not R-CW-3');
  if (metadata?.row !== ROW_ID) problems.push('runner metadata row is not R-CW-3');
  if (correlation?.row !== ROW_ID) problems.push('correlation receipt row is not R-CW-3');
  if (!isNonEmptyString(metadata?.candidateSha) || !SHA40.test(candidateSha || '')) {
    problems.push('runner metadata lacks a well-formed candidate SHA');
  }
  if (candidateSha !== hex(evidence.candidateSha)) problems.push('public evidence candidate SHA does not match runner metadata');
  if (!isNonEmptyString(metadata?.runtimeBuildSha) || !SHA40.test(runtimeBuildSha || '')) {
    problems.push('runner metadata lacks a well-formed runtime build SHA');
  } else if (runtimeBuildSha !== candidateSha) {
    problems.push('runtime build SHA does not equal the candidate SHA; this run is not build-identity bound');
  }
  if (!isNonEmptyString(metadata?.runId)) problems.push('runner metadata run id is missing or not a string');
  else if (metadata.runId !== path.basename(runDir)) problems.push('runner metadata run id does not match the run directory');
  if (!isNonEmptyString(metadata?.matrixId)) problems.push('runner metadata matrix id is missing or not a string');
  if (!isNonEmptyString(metadata?.seat)) problems.push('runner metadata seat is missing or not a string');
  if (metadata?.seat !== evidence.seat) problems.push('public evidence seat does not match runner metadata');
  if (metadata?.seat !== correlation?.seat) problems.push('correlation receipt seat does not match runner metadata');

  return status(problems.length === 0, {
    candidateSha,
    runtimeBuildSha,
    runId: metadata?.runId ?? null,
    matrixId: metadata?.matrixId ?? null,
    seat: metadata?.seat ?? null,
    problems,
  });
}

/** The reviewed bytes must be the digest-bound bytes the runner fired. */
function checkSourceDigestsBound({ metadata, digests }) {
  const problems = [];
  const manifestSha = digests[MANIFEST_COPY];
  const scenarioSha = digests[SCENARIO_COPY];
  if (!manifestSha) problems.push(`${MANIFEST_COPY} is missing from the run directory`);
  else if (manifestSha !== metadata?.manifestSha256) problems.push(`${MANIFEST_COPY} digest does not match runner metadata`);
  if (!scenarioSha) problems.push(`${SCENARIO_COPY} is missing from the run directory`);
  else if (scenarioSha !== metadata?.scenarioSha256) problems.push(`${SCENARIO_COPY} digest does not match runner metadata`);
  if (!String(metadata?.manifestPath || '').endsWith('manifests/r-cw-3.json')) {
    problems.push('runner metadata does not name the R-CW-3 manifest');
  }
  if (!String(metadata?.scenarioPath || '').endsWith('scenarios/r-cw-3-reason-telemetry.js')) {
    problems.push('runner metadata does not name the R-CW-3 scenario');
  }
  return status(problems.length === 0, {
    manifestSha256: manifestSha,
    scenarioSha256: scenarioSha,
    declaredManifestSha256: metadata?.manifestSha256 ?? null,
    declaredScenarioSha256: metadata?.scenarioSha256 ?? null,
    note: 'only the manifest and scenario copies have producer-frozen expected digests; the other recorded digests are custody of the bytes reviewed, not an authority comparison',
    problems,
  });
}

/**
 * Finding 5: `--out` must not be able to replace an input or an immutable
 * original, directly or through an alias. The guard is identity-aware rather
 * than lexical: it refuses a symlink, a hard-linked target or a non-regular
 * file at the output path, refuses any path that resolves onto an existing run
 * artifact or a declared input, and refuses any device+inode alias of one. A
 * fresh filename — inside the run directory or beside it — stays allowed, and
 * the helper may always replace its own previous receipt.
 */
async function isOwnReceipt(file) {
  const parsed = await readJson(file).catch(() => null);
  return parsed?.schema === REVIEW_RECEIPT_SCHEMA && parsed?.row === ROW_ID;
}

async function assertOutputPathSafe(outPath, runDir, inputPaths = []) {
  const existing = await lstat(outPath).catch(() => null);
  if (existing) {
    if (existing.isSymbolicLink()) throw new Error(`refusing to write the review receipt through a symlink: ${outPath}`);
    if (!existing.isFile()) throw new Error(`refusing to write the review receipt over a non-regular file: ${outPath}`);
    if (existing.nlink > 1) throw new Error(`refusing to write the review receipt over a hard-linked file (nlink=${existing.nlink}): ${outPath}`);
  }
  const resolve = async (file) => {
    const dir = await realpath(path.dirname(file)).catch(() => path.dirname(file));
    return path.join(dir, path.basename(file));
  };
  const resolvedOut = await resolve(outPath);
  const resolvedRunDir = await realpath(runDir).catch(() => runDir);

  const protectedPaths = new Set();
  for (const input of inputPaths) {
    if (input) protectedPaths.add(await resolve(input));
  }
  for (const name of await readdir(resolvedRunDir).catch(() => [])) {
    // The helper owns its own receipts and may rewrite them; every other
    // artifact already in the run directory is immutable to this review.
    if (name === RECEIPT_BASENAME) continue;
    protectedPaths.add(path.join(resolvedRunDir, name));
  }
  // A re-run may replace a receipt this helper wrote earlier under any name,
  // identified by its own schema rather than by its filename.
  if (existing && await isOwnReceipt(outPath)) protectedPaths.delete(resolvedOut);

  for (const candidate of protectedPaths) {
    if (candidate === resolvedOut) {
      throw new Error(`refusing to overwrite immutable run artifact ${path.basename(candidate)}`);
    }
    if (!existing) continue;
    const info = await lstat(candidate).catch(() => null);
    if (info && info.dev === existing.dev && info.ino === existing.ino) {
      throw new Error(`--out aliases immutable run artifact ${path.basename(candidate)}; refusing to write`);
    }
  }
}

const REDACTED_PLACEHOLDER = '<redacted-raw-reason>';

/**
 * The receipt is itself a public artifact, and most of what it reports is read
 * from untrusted run-directory bytes: a poisoned `runner-metadata.matrixId`, a
 * correlation field or a thrown error message would otherwise be copied into a
 * refused receipt that still declares `publicSafe: true`.
 *
 * Every outgoing string is therefore scrubbed of raw reason material — and of
 * an out-of-band nonce, which must never be echoed — immediately before the
 * receipt is written or printed. The count of replacements is reported so a
 * reviewer can see that something unsafe was encountered rather than silently
 * dropped.
 */
function redactOutgoing(value, tokens, counter) {
  if (typeof value === 'string') {
    // The whole value is dropped, not just the matched token: the tail of a
    // poisoned string is untrusted material too.
    if (tokens.some((token) => token && value.includes(token))) {
      counter.count += 1;
      return REDACTED_PLACEHOLDER;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redactOutgoing(item, tokens, counter));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      const safeKey = redactOutgoing(key, tokens, counter);
      out[safeKey] = redactOutgoing(child, tokens, counter);
    }
    return out;
  }
  return value;
}

function publicSafeReceipt(receipt, nonce) {
  const counter = { count: 0 };
  const tokens = [RAW_SENTINEL_PREFIX, REASON_PREFIX];
  if (isNonEmptyString(nonce)) tokens.push(nonce);
  const scrubbed = redactOutgoing(receipt, tokens, counter);
  return { ...scrubbed, publicSafe: true, redactedOutgoingValues: counter.count };
}

function acceptanceBlock() {
  return {
    manualAcceptanceRequired: true,
    coordinatorAccepted: false,
    canonicalFoldForbidden: true,
    liveReRun: false,
    pendingReceipt: PENDING_REVIEW_RECEIPT,
    note: 'Mechanical offline verification of preserved public artifacts. Helper success is not coordinator acceptance, not a live re-run, and not a canonical PASS fold; the row keeps its reason-telemetry-redaction-review debt.',
  };
}

async function reconciliationBlock(runDir) {
  const summary = await readJson(path.join(runDir, SUMMARY_FILE)).catch(() => null);
  const runResult = await readJson(path.join(runDir, 'run-result.json')).catch(() => null);
  return {
    source: 'review-r-cw-3-reason-telemetry.mjs',
    sourceKind: 'offline-review-helper',
    historicalVerdict: summary?.verdict ?? runResult?.verdict ?? null,
    historicalVerdictSource: summary ? SUMMARY_FILE : (runResult ? 'run-result.json' : null),
    overwritesOriginalEvidence: false,
    note: 'Original VU/summary evidence is read-only here; this receipt is an additional, named artifact beside it.',
  };
}

/** Every file this review reads, resolved once so the output guard can see them. */
async function resolveInputs(args, runDir) {
  return {
    tempoTracePath: await findTempoTrace(runDir, args.tempoTrace).catch(() => null),
    correlationPath: path.resolve(args.correlation || path.join(runDir, CORRELATION_FILE)),
    metadataPath: path.resolve(args.metadata || path.join(runDir, METADATA_FILE)),
    manifestPath: path.resolve(args.manifest || path.join(runDir, MANIFEST_COPY)),
    evidencePath: path.join(runDir, EVIDENCE_FILE),
  };
}

async function buildReceipt({ args, runDir }) {
  const tempoTracePath = await findTempoTrace(runDir, args.tempoTrace);
  const { correlationPath, metadataPath, manifestPath, evidencePath } = await resolveInputs(args, runDir);

  // Finding 6: the collector's own "exactly one evidence record" rule, reused.
  const evidence = await readSingleEvidenceRecord(evidencePath);
  const trace = await readJson(tempoTracePath);
  const correlation = await readJson(correlationPath);
  const metadata = await readJson(metadataPath);
  const manifest = await readJson(manifestPath);

  const digests = {
    [EVIDENCE_FILE]: await sha256OrNull(evidencePath),
    [path.basename(tempoTracePath)]: await sha256OrNull(tempoTracePath),
    [CORRELATION_FILE]: await sha256OrNull(correlationPath),
    [METADATA_FILE]: await sha256OrNull(metadataPath),
    [MANIFEST_COPY]: await sha256OrNull(manifestPath),
    [SCENARIO_COPY]: await sha256OrNull(path.join(runDir, SCENARIO_COPY)),
  };

  const spans = allTempoSpans(trace);
  const workSpans = spans.filter((span) => span.name === WORK_SPAN_NAME);
  const fireSpans = spans.filter((span) => span.name === FIRE_SPAN_NAME);
  const toolSpans = spans.filter((span) => span.name === TOOL_SPAN_NAME);

  const attrs = extractAttributes(trace);
  const attrKeys = new Set(attrs.map((a) => a.key));
  const hasReasonPresent = attrs.some((a) => a.key === 'reason.present' && (a.value === true || a.value === 'true'));
  const hasReasonLength = attrKeys.has('reason.length');
  const hasReasonHash = attrKeys.has('reason.hash');
  const hasSafeReasonAttrs = hasReasonPresent && hasReasonLength && hasReasonHash;

  const publicSurfaces = { [EVIDENCE_FILE]: evidence, [CORRELATION_FILE]: correlation, [METADATA_FILE]: metadata };
  for (const name of [SUMMARY_FILE, 'run-result.json']) {
    const value = await readJson(path.join(runDir, name)).catch(() => undefined);
    if (value !== undefined) publicSurfaces[name] = value;
  }
  for (const name of PUBLIC_TEXT_SURFACES) {
    const value = await readFile(path.join(runDir, name), 'utf8').catch(() => undefined);
    if (value !== undefined) publicSurfaces[name] = value;
  }

  const expectations = {
    candidateSha: args.expectCandidateSha || null,
    runId: args.expectRunId || null,
    matrixId: args.expectMatrixId || null,
    traceId: args.expectTraceId || null,
  };
  const nonce = args.nonce || null;

  const checks = {
    row: status(evidence.row === ROW_ID, evidence.row || null),
    dispatchAccepted: status(evidence.dispatch_accepted === true, evidence.dispatch_accepted === true),
    scheduledSentinel: status(evidence.scheduled_sentinel === true, evidence.scheduled_sentinel === true),
    wakeObserved: status(evidence.wake_observed === true, evidence.wake_observed === true),
    publicArtifactRawReasonAbsentClaimed: status(evidence.public_artifact_raw_reason_absent === true, {
      producerClaim: evidence.public_artifact_raw_reason_absent === true,
      note: 'producer claim only; rawReasonAbsentFromPublicArtifacts observes the bytes',
    }),
    tempoTraceJson: status(Boolean(trace), path.basename(tempoTracePath)),
    safeReasonAttrsPresent: status(hasSafeReasonAttrs, {
      'reason.present': hasReasonPresent,
      'reason.length': hasReasonLength,
      'reason.hash': hasReasonHash,
    }),
    rawReasonAbsentFromTempo: status(
      rawReasonHits(trace).rawSentinelPrefixHits === 0 && rawReasonHits(trace).rawReasonPrefixHits === 0,
      rawReasonHits(trace),
    ),
    rawReasonAbsentFromPublicArtifacts: checkRawReasonAbsentFromPublicArtifacts({ surfaces: publicSurfaces }),
    publicEvidenceSanitized: checkPublicEvidenceSanitized({ evidence }),
    manifestContractBound: checkManifestContractBound({ manifest, correlation }),
    // Present only when a nonce is supplied out of band; its absence is stated
    // in `limits` rather than shown as a satisfied check.
    ...(nonce === null
      ? {}
      : { reasonFingerprintRecomputedFromNonce: checkReasonFingerprintRecomputedFromNonce({ manifest, evidence, correlation, nonce }) }),
    reasonTelemetryMatchesEvidence: checkReasonTelemetryMatchesEvidence({ evidence, correlation, workSpans, fireSpans }),
    traceTopologyBound: checkTraceTopologyBound({ correlation, trace, workSpans, fireSpans, toolSpans }),
    externalAnchorsBound: checkExternalAnchorsBound({ expectations, metadata, correlation, runDir }),
    identityBound: checkIdentityBound({ evidence, metadata, correlation, runDir }),
    sourceDigestsBound: checkSourceDigestsBound({ metadata, digests }),
  };
  const passed = Object.values(checks).every((check) => check.ok);

  return {
    receipt: {
      schema: REVIEW_RECEIPT_SCHEMA,
      generatedAt: new Date().toISOString(),
      runDir,
      tempoTraceJson: tempoTracePath,
      row: ROW_ID,
      // Public evidence is nonce-sanitized by policy, so a nonce here would mean
      // the document was not sanitizer-produced; publicEvidenceSanitized checks it.
      nonceSuppliedOutOfBand: nonce !== null,
      // Public evidence deliberately leaves trace_id null, so the joined
      // identity comes from the correlation receipt, not from evidence.
      traceId: hex(correlation?.traceId) || null,
      traceIdSource: correlation?.traceId ? CORRELATION_FILE : null,
      verdict: passed ? 'reason-telemetry-redaction-review-passed' : 'review-pending',
      binding: {
        candidateSha: hex(metadata?.candidateSha) || null,
        runtimeBuildSha: hex(metadata?.runtimeBuildSha) || null,
        runId: metadata?.runId ?? null,
        matrixId: metadata?.matrixId ?? null,
        seat: metadata?.seat ?? null,
        docsRef: metadata?.docsRef ?? null,
        traceId: hex(correlation?.traceId) || null,
        chainId: hex(correlation?.chainId) || null,
        expectations,
        sources: digests,
        digestAuthority: {
          [MANIFEST_COPY]: 'compared against runner-metadata.manifestSha256',
          [SCENARIO_COPY]: 'compared against runner-metadata.scenarioSha256',
          other: 'recorded custody of the exact bytes this review read; no producer-frozen expected digest exists for them',
        },
      },
      checks,
      safeReasonAttributeKeys: attrs.map((a) => a.key).filter((key) => key.startsWith('reason.')).sort(),
      limits: [
        nonce === null
          ? {
            claim: 'reason-fingerprint-recomputation',
            available: false,
            reason: 'public evidence is nonce-redacted by policy (sanitize-k6-artifacts.mjs drops every nonce key), so this offline review cannot independently recompute SHA256(manifest reason rendered with this fire\'s nonce). It checks that the manifest copy is the R-CW-3 continue_work contract, that the correlation receipt declares a manifest-nonce fingerprint, and that the recorded fingerprint agrees across evidence, correlation and spans. The producer collector performed the derivation at collection time; pass --nonce to repeat it here.',
          }
          : {
            claim: 'reason-fingerprint-recomputation',
            available: true,
            reason: 'a nonce was supplied out of band and the collector derivation was repeated; see checks.reasonFingerprintRecomputedFromNonce',
          },
        {
          claim: 'source-digest-authority',
          available: 'partial',
          reason: 'only row-manifest.json and row-scenario.js have producer-frozen expected digests in runner-metadata.json. Every other recorded digest is custody of the exact bytes this review read, not a comparison against a trusted prior value.',
        },
        {
          claim: 'live-execution',
          available: false,
          reason: 'offline inspection of preserved public artifacts; no gateway, Tempo query or re-fire occurred.',
        },
      ],
      acceptance: acceptanceBlock(),
      reconciliation: await reconciliationBlock(runDir),
      publicSafe: true,
    },
    passed,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if (!args.runDir) throw new Error('--run-dir is required');
  const runDir = path.resolve(args.runDir);
  const outPath = path.resolve(args.out || path.join(runDir, RECEIPT_BASENAME));

  // The output guard runs before anything is built: an unsafe --out must not
  // produce a receipt at all, because writing one is the harm.
  const inputs = await resolveInputs(args, runDir);
  try {
    await assertOutputPathSafe(outPath, runDir, Object.values(inputs));
  } catch (error) {
    // Refused before any write: no receipt is produced, because producing one
    // at this path is itself the harm the guard exists to prevent.
    console.error(`r-cw-3 review refused: ${error && error.message ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  let receipt;
  let passed;
  try {
    ({ receipt, passed } = await buildReceipt({ args, runDir }));
  } catch (error) {
    // A missing or malformed input is an explicit review failure, not a silent
    // absence: the receipt is still written so the debt has a named artifact.
    passed = false;
    receipt = {
      schema: REVIEW_RECEIPT_SCHEMA,
      generatedAt: new Date().toISOString(),
      runDir,
      row: ROW_ID,
      verdict: 'review-pending',
      error: error && error.message ? error.message : String(error),
      checks: {},
      acceptance: acceptanceBlock(),
      reconciliation: await reconciliationBlock(runDir),
      publicSafe: true,
    };
  }

  const published = publicSafeReceipt(receipt, args.nonce || null);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(published, null, 2)}\n`);
  console.log(JSON.stringify({
    out: outPath,
    verdict: published.verdict,
    passed,
    redactedOutgoingValues: published.redactedOutgoingValues,
    ...(published.error ? { error: published.error } : {}),
  }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  usage();
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
