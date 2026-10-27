#!/usr/bin/env node
/**
 * Review helper for Project 81 R-CW-3 reason telemetry/redaction receipts.
 *
 * This script does not run Gateway work. It inspects an existing R-CW-3 run
 * directory and its fetched Tempo trace JSON, then writes a public-safe review
 * receipt. It automates the repeatable part of the manual review:
 *   - schedule + wake evidence exists
 *   - public k6 artifact says the raw reason was not preserved
 *   - Tempo trace contains safe reason telemetry attrs
 *   - Tempo trace does not contain the raw reason sentinel/prefix
 *
 * The receipt is JOINED, not merely adjacent to the run (#1727).  Attribute
 * presence alone cannot show that a trace belongs to this candidate, this run
 * and this fire: the helper therefore binds the exact candidate SHA, run ID,
 * matrix ID, trace ID and chain ID, compares the exported reason hash/length
 * against the run's own evidence, re-walks the tool/work/fire span topology
 * recorded by the correlation receipt, and pins the SHA-256 of every source
 * artifact it read.  The correlation receipt carries trace identity because
 * public evidence deliberately leaves `trace_id` null.
 *
 * A passing receipt is mechanical verification only.  It never asserts
 * coordinator acceptance, never lifts the row's PARTIAL-candidate verdict, and
 * never discharges the manual `reason-telemetry-redaction-review` debt.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const RAW_SENTINEL_PREFIX = 'RAW-RCW3-';
const REASON_PREFIX = 'k6-proof-R-CW-3-redaction';
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
const SHA40 = /^[0-9a-f]{40}$/iu;
const TRACE_ID_RE = /^[0-9a-f]{32}$/iu;
const SPAN_ID_RE = /^[0-9a-f]{16}$/iu;
const REASON_HASH_RE = /^[0-9a-f]{16}$/iu;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const FLAGS = [
  '--run-dir',
  '--tempo-trace',
  '--correlation',
  '--metadata',
  '--out',
  '--expect-candidate-sha',
  '--expect-run-id',
  '--expect-matrix-id',
  '--expect-trace-id',
];

function usage() {
  console.error([
    'Usage: node review-r-cw-3-reason-telemetry.mjs --run-dir <R-CW-3 run dir>',
    '         [--tempo-trace <trace.json>] [--correlation <continuation-trace-correlation.json>]',
    '         [--metadata <runner-metadata.json>] [--out <receipt.json>]',
    '         [--expect-candidate-sha <sha>] [--expect-run-id <id>]',
    '         [--expect-matrix-id <id>] [--expect-trace-id <traceId>]',
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

async function readEvidence(runDir) {
  const evidencePath = path.join(runDir, 'evidence.jsonl');
  const text = await readFile(evidencePath, 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  if (!rows.length) throw new Error(`no evidence rows in ${evidencePath}`);
  return rows[rows.length - 1];
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
    out.push({ key: obj.key, value: otelValueToScalar(obj.value) });
  }
  for (const value of Object.values(obj)) extractAttributes(value, out);
  return out;
}

function otelValueToScalar(value) {
  if (!value || typeof value !== 'object') return value;
  for (const key of ['stringValue', 'intValue', 'doubleValue', 'boolValue']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  }
  if (value.arrayValue) return JSON.stringify(value.arrayValue);
  if (value.kvlistValue) return JSON.stringify(value.kvlistValue);
  return JSON.stringify(value);
}

/**
 * Collect span objects from either the public projection
 * (`openclaw.k6.public-tempo-trace.v1`, a flat `spans` array) or a raw OTLP
 * `batches[].scopeSpans[].spans[]` document.
 */
function collectSpans(node, seen = new Set(), out = []) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectSpans(item, seen, out);
    return out;
  }
  if (Array.isArray(node.spans)) {
    for (const span of node.spans) {
      if (span && typeof span === 'object' && !out.includes(span)) out.push(span);
    }
  }
  for (const value of Object.values(node)) collectSpans(value, seen, out);
  return out;
}

function spanAttributes(span) {
  const map = new Map();
  for (const attr of extractAttributes(span.attributes || [])) map.set(attr.key, attr.value);
  return map;
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

/**
 * Every exported reason attribute on the row's own work/fire spans must carry
 * the digest and length this run actually recorded.  Presence of the keys is
 * not evidence: a trace from a different fire has the same keys.
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
 * The correlation receipt is the row's identity join.  Re-derive its topology
 * from the trace rather than trusting its own booleans.
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
  if (correlation?.continuation?.acceptSpan !== WORK_SPAN_NAME || correlation?.continuation?.fireSpan !== FIRE_SPAN_NAME) {
    problems.push('correlation receipt names unexpected accept/fire spans');
  }
  if (!traceId || !TRACE_ID_RE.test(traceId)) problems.push('correlation receipt lacks a well-formed trace id');
  if (!chainId || !UUID_V4_RE.test(chainId)) problems.push('correlation receipt lacks a public-safe UUIDv4 chain id');
  if (trace?.traceId !== undefined && hex(trace.traceId) !== traceId) problems.push('trace JSON trace id does not match the correlation receipt');
  if (spanTraceIds.length !== 1 || spanTraceIds[0] !== traceId) problems.push('tool/work/fire spans do not all carry the correlated trace id');
  if (!workSpanId || workSpanId !== hex(correlation?.workSpanId)) problems.push('work span id does not match the correlation receipt');
  if (!sameSet(observedFires, declaredFires)) problems.push('fire span ids do not match the correlation receipt');
  if (!sameSet(observedTools, declaredTools)) problems.push('tool span ids do not match the correlation receipt');
  if (!workParent || workParent !== hex(correlation?.workParentSpanId)) problems.push('work parent span id does not match the correlation receipt');
  if (!declaredTools.includes(workParent)) problems.push('work span is not parented to the originating tool span');
  if (fireParents.length !== 1 || fireParents[0] !== hex(correlation?.fireParentSpanId)) {
    problems.push('fire parent span id does not match the correlation receipt');
  }
  if (!declaredTools.includes(fireParents[0])) problems.push('fire span is not parented to the originating tool span');
  if (correlation?.fireAttemptCount !== observedFires.length) problems.push('fire attempt count does not match the trace');
  if (new Set(lifecycleSpanIds).size !== lifecycleSpanIds.length) problems.push('tool/work/fire span ids are not distinct');
  if (!lifecycleSpanIds.every((id) => SPAN_ID_RE.test(id))) problems.push('a lifecycle span id is not a well-formed span id');
  if (chainAttrs.length !== 1 || chainAttrs[0] !== chainId) problems.push('work and fire spans do not share the correlated chain id');
  for (const span of toolSpans) {
    if (spanAttributes(span).get('gen_ai.tool.name') !== CONTINUATION_TOOL) {
      problems.push(`tool span is not a ${CONTINUATION_TOOL} execution`);
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
    problems,
  });
}

/** Bind the receipt to one candidate, one matrix, one run and one seat. */
function checkIdentityBound({ evidence, metadata, correlation, runDir, expectations }) {
  const candidateSha = hex(metadata?.candidateSha);
  const runId = metadata?.runId || null;
  const matrixId = metadata?.matrixId || null;
  const problems = [];

  if (evidence.row !== ROW_ID) problems.push('public evidence row is not R-CW-3');
  if (metadata?.row !== ROW_ID) problems.push('runner metadata row is not R-CW-3');
  if (correlation?.row !== ROW_ID) problems.push('correlation receipt row is not R-CW-3');
  if (!candidateSha || !SHA40.test(candidateSha)) problems.push('runner metadata lacks a well-formed candidate SHA');
  if (candidateSha !== hex(evidence.candidateSha)) problems.push('public evidence candidate SHA does not match runner metadata');
  if (!metadata?.runtimeBuildSha || !SHA40.test(String(metadata.runtimeBuildSha))) {
    problems.push('runner metadata lacks a well-formed runtime build SHA');
  }
  if (!runId) problems.push('runner metadata lacks a run id');
  else if (runId !== path.basename(runDir)) problems.push('runner metadata run id does not match the run directory');
  if (!matrixId) problems.push('runner metadata lacks a matrix id');
  if (!metadata?.seat) problems.push('runner metadata lacks a seat');
  if (metadata?.seat !== evidence.seat) problems.push('public evidence seat does not match runner metadata');
  if (metadata?.seat !== correlation?.seat) problems.push('correlation receipt seat does not match runner metadata');
  if (expectations.candidateSha && hex(expectations.candidateSha) !== candidateSha) {
    problems.push('candidate SHA does not match the expected candidate');
  }
  if (expectations.runId && expectations.runId !== runId) problems.push('run id does not match the expected run');
  if (expectations.matrixId && expectations.matrixId !== matrixId) problems.push('matrix id does not match the expected matrix');
  if (expectations.traceId && hex(expectations.traceId) !== hex(correlation?.traceId)) {
    problems.push('trace id does not match the expected collected trace');
  }

  return status(problems.length === 0, { candidateSha, runId, matrixId, seat: metadata?.seat ?? null, problems });
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
    problems,
  });
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

async function buildReceipt({ args, runDir, outPath }) {
  const tempoTracePath = await findTempoTrace(runDir, args.tempoTrace);
  const correlationPath = path.resolve(args.correlation || path.join(runDir, CORRELATION_FILE));
  const metadataPath = path.resolve(args.metadata || path.join(runDir, METADATA_FILE));
  const evidencePath = path.join(runDir, 'evidence.jsonl');

  const evidence = await readEvidence(runDir);
  const trace = await readJson(tempoTracePath);
  const correlation = await readJson(correlationPath);
  const metadata = await readJson(metadataPath);

  const digests = {
    'evidence.jsonl': await sha256OrNull(evidencePath),
    [path.basename(tempoTracePath)]: await sha256OrNull(tempoTracePath),
    [CORRELATION_FILE]: await sha256OrNull(correlationPath),
    [METADATA_FILE]: await sha256OrNull(metadataPath),
    [MANIFEST_COPY]: await sha256OrNull(path.join(runDir, MANIFEST_COPY)),
    [SCENARIO_COPY]: await sha256OrNull(path.join(runDir, SCENARIO_COPY)),
  };

  const spans = collectSpans(trace);
  const workSpans = spans.filter((span) => span.name === WORK_SPAN_NAME);
  const fireSpans = spans.filter((span) => span.name === FIRE_SPAN_NAME);
  const toolSpans = spans.filter((span) => span.name === TOOL_SPAN_NAME);

  const attrs = extractAttributes(trace);
  const strings = allStrings(trace);
  const attrKeys = new Set(attrs.map((a) => a.key));
  const hasReasonPresent = attrs.some((a) => a.key === 'reason.present' && (a.value === true || a.value === 'true'));
  const hasReasonLength = attrKeys.has('reason.length');
  const hasReasonHash = attrKeys.has('reason.hash');
  const hasSafeReasonAttrs = hasReasonPresent && hasReasonLength && hasReasonHash;
  const rawSentinelHits = strings.filter((s) => s.includes(RAW_SENTINEL_PREFIX));
  const rawReasonPrefixHits = strings.filter((s) => s.includes(REASON_PREFIX));
  const rawReasonAbsent = rawSentinelHits.length === 0 && rawReasonPrefixHits.length === 0;

  const expectations = {
    candidateSha: args.expectCandidateSha || null,
    runId: args.expectRunId || null,
    matrixId: args.expectMatrixId || null,
    traceId: args.expectTraceId || null,
  };

  const checks = {
    row: status(evidence.row === ROW_ID, evidence.row || null),
    dispatchAccepted: status(evidence.dispatch_accepted === true, evidence.dispatch_accepted === true),
    scheduledSentinel: status(evidence.scheduled_sentinel === true, evidence.scheduled_sentinel === true),
    wakeObserved: status(evidence.wake_observed === true, evidence.wake_observed === true),
    publicArtifactRawReasonAbsent: status(evidence.public_artifact_raw_reason_absent === true, evidence.public_artifact_raw_reason_absent === true),
    tempoTraceJson: status(Boolean(trace), path.basename(tempoTracePath)),
    safeReasonAttrsPresent: status(hasSafeReasonAttrs, {
      'reason.present': hasReasonPresent,
      'reason.length': hasReasonLength,
      'reason.hash': hasReasonHash,
    }),
    rawReasonAbsentFromTempo: status(rawReasonAbsent, {
      rawSentinelPrefixHits: rawSentinelHits.length,
      rawReasonPrefixHits: rawReasonPrefixHits.length,
    }),
    reasonTelemetryMatchesEvidence: checkReasonTelemetryMatchesEvidence({ evidence, correlation, workSpans, fireSpans }),
    traceTopologyBound: checkTraceTopologyBound({ correlation, trace, workSpans, fireSpans, toolSpans }),
    identityBound: checkIdentityBound({ evidence, metadata, correlation, runDir, expectations }),
    sourceDigestsBound: checkSourceDigestsBound({ metadata, digests }),
  };
  const passed = Object.values(checks).every((check) => check.ok);

  return {
    receipt: {
      schema: 'openclaw.k6.r-cw-3-reason-telemetry-review.v2',
      generatedAt: new Date().toISOString(),
      runDir,
      tempoTraceJson: tempoTracePath,
      row: ROW_ID,
      nonce: evidence.nonce || null,
      // Public evidence deliberately leaves trace_id null (sanitized), so the
      // joined identity comes from the correlation receipt, not from evidence.
      traceId: hex(correlation?.traceId) || evidence.trace_id || null,
      traceIdSource: correlation?.traceId ? CORRELATION_FILE : (evidence.trace_id ? 'evidence.jsonl' : null),
      verdict: passed ? 'reason-telemetry-redaction-review-passed' : 'review-pending',
      binding: {
        candidateSha: hex(metadata?.candidateSha) || null,
        runtimeBuildSha: hex(metadata?.runtimeBuildSha) || null,
        runId: metadata?.runId || null,
        matrixId: metadata?.matrixId || null,
        seat: metadata?.seat || null,
        docsRef: metadata?.docsRef || null,
        traceId: hex(correlation?.traceId) || null,
        chainId: hex(correlation?.chainId) || null,
        expectations,
        sources: digests,
      },
      checks,
      safeReasonAttributeKeys: attrs.map((a) => a.key).filter((key) => key.startsWith('reason.')).sort(),
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
  const outPath = path.resolve(args.out || path.join(runDir, 'r-cw-3-reason-telemetry-review.json'));

  let receipt;
  let passed;
  try {
    ({ receipt, passed } = await buildReceipt({ args, runDir, outPath }));
  } catch (error) {
    // A missing or malformed input is an explicit review failure, not a silent
    // absence: the receipt is still written so the debt has a named artifact.
    passed = false;
    receipt = {
      schema: 'openclaw.k6.r-cw-3-reason-telemetry-review.v2',
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

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ out: outPath, verdict: receipt.verdict, passed, ...(receipt.error ? { error: receipt.error } : {}) }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  usage();
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
