#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  allTempoSpans as allSpans,
  projectPublicTempoTrace,
  publicTempoSpanName as publicSpanName,
  publicTempoStatusCode as publicStatusCode,
  tempoAttributeValue as attributeValue,
} from '../lib/public-tempo-trace.mjs';
import {
  establishRcd2AuthorityContext,
  isRcd2AuthorityRequired,
} from '../lib/r-cd-2-authority-context.mjs';
import {
  R_CD_2_COLLECTOR_SCHEMA,
  sealRcd2AcquisitionReceipt,
} from '../lib/r-cd-2-authoritative-receipt.mjs';
import { sanitizeEvidenceRecords } from './sanitize-k6-artifacts.mjs';
import { renderRowTaskTemplate } from '../lib/row-child-correlation.mjs';
import { escapeTraceqlString, proofsServiceName } from '../lib/proofs-service-name.mjs';

const DEFAULT_TEMPO_BASE_URL = 'http://tempo.dandelion.cult';
const CORRELATION_WINDOW_PADDING_SECONDS = 60;
const TOOL_ORIGIN_EARLY_TOLERANCE_MS = 15000;
const TOOL_ORIGIN_LATE_TOLERANCE_MS = 1000;

function usage() {
  console.error(`Usage: node collect-continuation-trace.mjs \\
  --run-dir <row-run-dir> --manifest <row-manifest.json> --seat <seat> \\
  [--evidence <private-evidence.jsonl>] \\
  [--tempo-url <base-url>] [--timeout-ms 180000] [--poll-ms 2000] \\
  [--settle-ms <defaults-to-poll-ms>] [--service-name <otel service.name>]`);
}

function parseArgs(argv, env = process.env) {
  const out = {
    tempoUrl: env.OPENCLAW_PROOFS_TEMPO_BASE_URL || env.TEMPO_BASE_URL || DEFAULT_TEMPO_BASE_URL,
    // A row finishes when its own receipts land, but the spans it caused are
    // still in flight: the batch span processor has not flushed and Tempo has
    // not ingested. A continue_work tool span was observed starting ~77s after
    // dispatch inside a ~107s root trace, so a 60s budget expired while the
    // trace was still being assembled and reported an otherwise complete trace
    // as missing its originating tool span.
    timeoutMs: 180000,
    pollMs: 2000,
    settleMs: null,
    // Isolated proof gateways may export under their own service.name; the
    // seat-name convention below only holds for a prince's live gateway.
    serviceName: env.OPENCLAW_PROOFS_SERVICE_NAME || null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!['--run-dir', '--manifest', '--seat', '--evidence', '--tempo-url', '--timeout-ms', '--poll-ms', '--settle-ms', '--root', '--matrix-id', '--service-name'].includes(arg)) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  // One source of truth for the service name: the R-CD-2 acquisition-receipt
  // validator reads OPENCLAW_PROOFS_SERVICE_NAME (lib/proofs-service-name.mjs).
  // A --service-name that differs from it (including with the env unset) would
  // produce a receipt the validator rejects as invalid-shape:query-window, so
  // refuse it here rather than emit a receipt that can never validate.
  if ((out.serviceName || null) !== (env.OPENCLAW_PROOFS_SERVICE_NAME || null)) {
    throw new Error(
      `--service-name ${out.serviceName} must equal OPENCLAW_PROOFS_SERVICE_NAME ` +
      `(${env.OPENCLAW_PROOFS_SERVICE_NAME || 'unset'}); set the env var, which both the collector and the validator read`,
    );
  }
  out.timeoutMs = Number(out.timeoutMs);
  out.pollMs = Number(out.pollMs);
  out.settleMs = out.settleMs == null ? out.pollMs : Number(out.settleMs);
  return out;
}


function safeHex(value, length, label) {
  const text = String(value ?? '').toLowerCase();
  if (!new RegExp(`^[0-9a-f]{${length}}$`).test(text) || /^0+$/.test(text)) {
    throw new Error(`invalid ${label}: ${text || '(empty)'}`);
  }
  return text;
}

function idHex(value, bytes, label) {
  const text = String(value ?? '');
  if (text.length === bytes * 2 && /^[0-9a-f]+$/i.test(text)) return safeHex(text, bytes * 2, label);
  const decoded = Buffer.from(text, 'base64');
  if (decoded.length !== bytes) throw new Error(`invalid ${label} byte length`);
  return safeHex(decoded.toString('hex'), bytes * 2, label);
}

function searchTraceId(candidate) {
  // Tempo's search API renders trace IDs without leading zeros (a trace whose
  // id starts 0x05… comes back 31 hex characters long), while /api/traces and
  // the spans carry the full 32. Restore the fixed width before validating.
  const raw = String(candidate?.traceID || candidate?.traceId || candidate?.trace_id || '');
  const padded = /^[0-9a-f]{1,31}$/i.test(raw) ? raw.padStart(32, '0') : raw;
  return safeHex(padded, 32, 'search trace id');
}

function attributes(span) {
  return new Map((span?.attributes || []).map((attribute) => [attribute.key, attributeValue(attribute)]));
}

export async function readEvidence(evidencePath) {
  const text = await readFile(evidencePath, 'utf8');
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (records.length !== 1) throw new Error(`expected exactly one evidence record, found ${records.length}`);
  return records[0];
}

// A manifest template is the dispatched reason only when the nonce alone
// renders it, through the renderer the scenarios use. Scenario-owned
// placeholders ({{marker}}, {{tag}}) and the ${VAR:-default} placeholders a
// scenario resolves from its environment describe a reason's shape, not its
// bytes, so the collector never hashes them.
const NONCE_TEMPLATE_PLACEHOLDERS = new Set(['{{nonce}}', '{{nonceSuffix16}}']);

function renderNonceTemplate(template, nonce) {
  if (typeof template !== 'string' || !template || !nonce) return undefined;
  const placeholders = template.match(/\{\{[^{}]*\}\}|\$\{[^}]*\}/gu) || [];
  if (placeholders.some((placeholder) => !NONCE_TEMPLATE_PLACEHOLDERS.has(placeholder))) return undefined;
  return renderRowTaskTemplate(template, String(nonce)) ?? undefined;
}

export function traceContract(manifest, evidence) {
  const tool = manifest?.invocation?.tool;
  const nonce = evidence?.nonce;

  let template;
  let mode;
  let acceptSpanName;
  let fireSpanName;
  let attribution;
  if (tool === 'continue_delegate') {
    template = manifest.invocation.promptTemplate;
    const manifestMode = manifest.invocation.mode;
    const evidenceMode = evidence.delegate_mode;
    if (manifestMode && evidenceMode && manifestMode !== evidenceMode) {
      throw new Error(
        `evidence delegate_mode mismatch: expected ${manifestMode}, got ${evidenceMode}`,
      );
    }
    mode = escapeTraceqlString(evidenceMode || manifestMode);
    acceptSpanName = 'continuation.delegate.dispatch';
    fireSpanName = 'continuation.delegate.fire';
    attribution = manifest?.invocation?.originSurface === 'raw-final-text'
      ? 'bracket-token-reason-hash-length-mode'
      : 'reason-hash-length-mode';
  } else if (tool === 'continue_work') {
    template = manifest.invocation.reason;
    acceptSpanName = 'continuation.work';
    fireSpanName = 'continuation.work.fire';
    attribution = 'reason-hash-length';
  } else if (tool) {
    return {
      kind: 'tool',
      tool: escapeTraceqlString(tool),
      attribution: 'seat-tool-dispatch-window',
      fingerprintSource: 'public-evidence-window',
    };
  } else {
    throw new Error('manifest invocation.tool is required for trace collection');
  }

  // One rule for every continuation row (#600): the trace is matched by the
  // fingerprint the scenario recorded for the reason it dispatched. Only the
  // scenario knows those bytes (a random child token, a bracket marker, a
  // disposable session key, a hop's own task), so a row that records none fails
  // closed here instead of searching Tempo for a reason nobody sent. The
  // manifest template is a cross-check, never the source.
  const hash = safeHex(evidence?.reason_hash, 16, 'evidence reason hash');
  const length = Number(evidence?.reason_length);
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('continuation evidence requires a positive integer reason_length');
  }
  let reason;
  let fingerprintSource = nonce ? 'scenario-evidence' : 'public-evidence';
  const rendered = renderNonceTemplate(template, nonce);
  if (rendered !== undefined) {
    const renderedHash = createHash('sha256').update(rendered).digest('hex').slice(0, 16);
    if (renderedHash !== hash) {
      throw new Error(`evidence reason_hash mismatch: expected ${renderedHash}, got ${hash}`);
    }
    if (rendered.length !== length) {
      throw new Error(`evidence reason_length mismatch: expected ${rendered.length}, got ${length}`);
    }
    reason = rendered;
    fingerprintSource = 'manifest-nonce';
  }
  // A chain row (R-CW-4) declares how many sequential continue_work hops it
  // drives; its later hops join hop 1's trace (see scopeContinueWorkChain).
  const chainDepthTarget = manifest?.invocation?.chainDepthTarget;
  if (chainDepthTarget !== undefined &&
      (tool !== 'continue_work' || !Number.isInteger(chainDepthTarget) || chainDepthTarget < 1)) {
    throw new Error('manifest invocation.chainDepthTarget must be a positive integer on a continue_work row');
  }
  return {
    kind: 'continuation',
    tool,
    hash,
    length,
    raw: reason,
    fingerprintSource,
    mode,
    acceptSpanName,
    fireSpanName,
    attribution,
    originSurface: manifest?.invocation?.originSurface,
    ...(chainDepthTarget > 1 ? { chainDepthTarget } : {}),
  };
}

function assertTraceIsPublicSafe(trace, evidence, reason) {
  const serialized = JSON.stringify(trace);
  const { orderedTokens } = sanitizeEvidenceRecords([evidence]);
  const forbidden = [reason.raw, ...orderedTokens.map(([token]) => token)]
    .filter((value) => typeof value === 'string' && value.length >= 6);

  if (serialized.toLowerCase().includes('traceparent')) {
    throw new Error('Tempo trace contains forbidden traceparent material');
  }
  if (forbidden.some((value) => serialized.includes(value))) {
    throw new Error('Tempo trace contains private proof attribution material');
  }
}


async function tempoSearch(baseUrl, query, start, end) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const params = new URLSearchParams({ q: query, start: String(start), end: String(end), limit: '20' });
  const response = await fetch(`${root}/api/search?${params}`, { headers: { accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo search failed: HTTP ${response.status} ${response.statusText}`.trim());
  const json = JSON.parse(text);
  return json.traces || [];
}

async function fetchTrace(baseUrl, traceId) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const response = await fetch(`${root}/api/traces/${encodeURIComponent(traceId)}`, {
    headers: { accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo trace fetch failed: HTTP ${response.status} ${response.statusText}`.trim());
  return JSON.parse(text);
}

function matchesContinuationSpan(span, expected, name) {
  const attrs = attributes(span);
  return span.name === name &&
    attrs.get('reason.hash') === expected.reasonHash &&
    Number(attrs.get('reason.length')) === expected.reasonLength &&
    (expected.mode === undefined || attrs.get('delegate.mode') === expected.mode);
}

function spanTimeNs(span, field) {
  const value = span?.[field];
  return typeof value === 'string' && /^[1-9]\d*$/u.test(value) ? BigInt(value) : null;
}

function hasTimingMetadata(span) {
  return Object.hasOwn(span || {}, 'startTimeUnixNano') ||
    Object.hasOwn(span || {}, 'endTimeUnixNano');
}

function positiveIntegerAttribute(spansAndKeys) {
  for (const [span, key] of spansAndKeys) {
    const attribute = (span?.attributes || []).find((entry) => entry?.key === key);
    if (!attribute) continue;
    const value = attribute.value;
    if (!value || Object.keys(value).length !== 1 ||
        typeof value.intValue !== 'string' ||
        !/^[1-9]\d*$/u.test(value.intValue)) {
      return null;
    }
    return BigInt(value.intValue);
  }
  return null;
}

function scopeDelegateToolSpans(trace, tools, accept, fires) {
  const fire = fires[0];
  const lifecycleSpans = [accept, ...fires, ...tools];
  const hasAnyTimingMetadata = lifecycleSpans.some(hasTimingMetadata);
  const anchorNs = spanTimeNs(fire, 'startTimeUnixNano');
  const deferredMs = positiveIntegerAttribute([
    [fire, 'fire.deferred_ms'],
    [fire, 'delay.ms'],
    [accept, 'delay.ms'],
  ]);
  if (trace?.schema === 'openclaw.k6.public-tempo-trace.v1' && !hasAnyTimingMetadata) {
    return { kind: 'legacy-projected', tools };
  }
  if (anchorNs === null ||
      deferredMs === null ||
      tools.some((span) => spanTimeNs(span, 'startTimeUnixNano') === null)) {
    return { kind: 'invalid-timing', tools: [] };
  }

  const expectedOriginNs = anchorNs - deferredMs * 1_000_000n;
  if (expectedOriginNs <= 0n) {
    return { kind: 'invalid-timing', tools: [] };
  }
  const earliestOriginNs =
    expectedOriginNs - BigInt(TOOL_ORIGIN_EARLY_TOLERANCE_MS) * 1_000_000n;
  const latestOriginNs =
    expectedOriginNs + BigInt(TOOL_ORIGIN_LATE_TOLERANCE_MS) * 1_000_000n;
  return {
    kind: 'scoped',
    tools: tools.filter((span) => {
      const observedNs = spanTimeNs(span, 'startTimeUnixNano');
      return observedNs >= earliestOriginNs && observedNs <= latestOriginNs;
    }),
  };
}

// A chain row's later hops run on hop 1's trace: each wake turn runs under the
// tool span that elected its work (openclaw work-dispatch-execution.ts
// driveContinuationTurn -> runWithDiagnosticTraceparent(work.traceparent)), and
// continuation.work is a child of its electing tool span (continue-work-tool.ts
// captures the live span). The row is attributed to hop 1 alone: the tool span
// that parents the fingerprint-matched continuation.work. Every other
// continue_work tool span must prove it is a later hop of that chain, or the
// trace is refused: it schedules exactly one continuation.work, OK, on the same
// chain.id, and its nearest continue_work ancestor is the previous hop, so the
// hops form one sequence from hop 1, no deeper than the row declares.
function scopeContinueWorkChain(spans, tools, accept, chainId, chainDepthTarget) {
  const toolIds = tools.map((span) => idHex(span.spanId, 8, 'tool span id'));
  // allTempoSpans drops identical re-exports; a copy that differs is ambiguous.
  const duplicate = toolIds.find((toolId, index) => toolIds.indexOf(toolId) !== index);
  if (duplicate) {
    throw new Error(`continue_work tool span ${duplicate} is exported more than once with different content`);
  }
  if (tools.length > chainDepthTarget) {
    throw new Error(
      `matched trace contains ${tools.length} continue_work tool spans, more than the row's declared chain depth ${chainDepthTarget}`,
    );
  }
  const parentOf = new Map();
  for (const span of spans) {
    if (!span?.spanId) continue;
    const spanId = idHex(span.spanId, 8, 'span id');
    const parentSpanId = span.parentSpanId ? idHex(span.parentSpanId, 8, 'parent span id') : null;
    if (parentOf.has(spanId) && parentOf.get(spanId) !== parentSpanId) {
      throw new Error(`span ${spanId} is exported with conflicting parents; continue_work chain ancestry is ambiguous`);
    }
    parentOf.set(spanId, parentSpanId);
  }
  const toolIdSet = new Set(toolIds);
  const hop1 = idHex(accept.parentSpanId, 8, 'work parent span id');
  if (!toolIdSet.has(hop1)) {
    throw new Error(
      `matched trace contains ${tools.length} continue_work tool spans and none is the parent of the hop-1 continuation.work span`,
    );
  }

  // The nearest continue_work tool ancestor of a tool span, and the spans
  // between them (the wake turn that ran the later hop).
  const previousHop = (toolId) => {
    const path = [];
    const seen = new Set([toolId]);
    let current = parentOf.get(toolId);
    while (current) {
      if (seen.has(current)) throw new Error(`continue_work tool span ${toolId} has cyclic ancestry`);
      seen.add(current);
      if (toolIdSet.has(current)) return { previous: current, path };
      if (!parentOf.has(current)) break;
      path.push(current);
      current = parentOf.get(current);
    }
    return { previous: null, path: [] };
  };

  const nextHop = new Map();
  const hopFacts = new Map();
  for (const toolId of toolIds) {
    if (toolId === hop1) continue;
    const works = spans.filter((span) =>
      span.name === 'continuation.work' &&
      span.parentSpanId &&
      idHex(span.parentSpanId, 8, 'work parent span id') === toolId);
    if (works.length !== 1 ||
        attributes(works[0]).get('chain.id') !== chainId ||
        publicStatusCode(works[0].status?.code) !== 'OK') {
      throw new Error(
        `continue_work tool span ${toolId} is not a later hop of the hop-1 chain: it must schedule exactly one OK continuation.work on chain ${chainId}`,
      );
    }
    const { previous, path } = previousHop(toolId);
    if (!previous) {
      throw new Error(`continue_work tool span ${toolId} does not descend from the hop-1 chain's wake turns`);
    }
    if (nextHop.has(previous)) {
      throw new Error(
        `continue_work tool spans ${nextHop.get(previous)} and ${toolId} both follow ${previous}: the hops branch instead of running in sequence`,
      );
    }
    nextHop.set(previous, toolId);
    hopFacts.set(toolId, {
      toolParentSpanId: parentOf.get(toolId),
      workSpanId: idHex(works[0].spanId, 8, 'work span id'),
      path,
    });
  }
  const ordered = [];
  for (let toolId = nextHop.get(hop1); toolId; toolId = nextHop.get(toolId)) ordered.push(toolId);
  if (ordered.length !== toolIds.length - 1) {
    throw new Error('continue_work tool spans do not form one sequential chain from hop 1');
  }
  return {
    attribution: tools[toolIds.indexOf(hop1)],
    chainHops: ordered.map((toolId, index) => ({
      hop: index + 2,
      toolSpanId: toolId,
      toolParentSpanId: hopFacts.get(toolId).toolParentSpanId,
      workSpanId: hopFacts.get(toolId).workSpanId,
    })),
    chainPathSpanIds: ordered.flatMap((toolId) => hopFacts.get(toolId).path),
  };
}

function projectScopedContinuationTrace(trace, traceId, topology) {
  const projected = projectPublicTempoTrace(trace, traceId);
  const spanIds = new Set([
    topology.dispatchSpanId,
    topology.workSpanId,
    ...topology.toolSpanIds,
    ...topology.fireSpanIds,
    ...topology.childSpans.map((span) => span.spanId),
    // A chain row keeps the later hops and the wake-turn spans between them,
    // so the public projection replays its own chain proof.
    ...(topology.chainHops || []).flatMap((hop) => [hop.toolSpanId, hop.workSpanId]),
    ...(topology.chainPathSpanIds || []),
  ].filter(Boolean));
  return {
    ...projected,
    spans: projected.spans.filter((span) => spanIds.has(span.spanId)),
  };
}

function validateTrace(trace, expected) {
  const spans = allSpans(trace);
  const accepts = spans.filter((span) =>
    matchesContinuationSpan(span, expected, expected.acceptSpanName));
  if (accepts.length !== 1) {
    throw new Error(accepts.length === 0
      ? `matched trace lacks the expected ${expected.acceptSpanName} span`
      : `matched trace contains ${accepts.length} ${expected.acceptSpanName} spans`);
  }
  const accept = accepts[0];
  if (publicStatusCode(accept.status?.code) !== 'OK') {
    throw new Error(`${expected.acceptSpanName} span is not status OK`);
  }
  const acceptAttrs = attributes(accept);
  const chainId = String(acceptAttrs.get('chain.id') || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(chainId)) {
    throw new Error(`${expected.acceptSpanName} span lacks a public-safe UUIDv4 chain.id`);
  }

  const fires = spans.filter((span) => {
    const attrs = attributes(span);
    return matchesContinuationSpan(span, expected, expected.fireSpanName) &&
      attrs.get('chain.id') === chainId &&
      (expected.mode === undefined || attrs.get('delegate.mode') === expected.mode);
  });
  const permitsRepeatedFireAttempts = expected.tool === 'continue_work';
  if (fires.length === 0 || (!permitsRepeatedFireAttempts && fires.length !== 1)) {
    throw new Error(fires.length === 0
      ? `matched trace lacks the expected ${expected.fireSpanName} span`
      : `matched trace contains ${fires.length} ${expected.fireSpanName} spans`);
  }
  if (fires.some((span) => publicStatusCode(span.status?.code) !== 'OK')) {
    throw new Error(`${expected.fireSpanName} span is not status OK`);
  }

  const matchingTools = spans.filter((span) => {
    const attrs = attributes(span);
    return span.name === 'openclaw.tool.execution' &&
      attrs.get('gen_ai.tool.name') === expected.tool;
  });
  const toolScope = expected.tool === 'continue_delegate'
    ? scopeDelegateToolSpans(trace, matchingTools, accept, fires)
    : null;
  if (toolScope?.kind === 'invalid-timing') {
    throw new Error('matched raw trace lacks complete causal timing for continue_delegate generation scope');
  }
  const tools = toolScope?.tools ?? matchingTools;
  const chainRow = expected.tool === 'continue_work' && expected.chainDepthTarget > 1;
  let chain = null;
  if (expected.originSurface === 'raw-final-text') {
    if (tools.length !== 0) {
      throw new Error(`bracket-token trace must not contain a typed ${expected.tool} tool span`);
    }
  } else if (chainRow && tools.length > 1) {
    chain = scopeContinueWorkChain(spans, tools, accept, chainId, expected.chainDepthTarget);
  } else if (tools.length !== 1) {
    throw new Error(
      tools.length === 0
        ? `matched trace lacks the originating ${expected.tool} tool span`
        : `matched trace contains ${tools.length} ${expected.tool} tool spans`,
    );
  }
  if (tools.some((span) => {
    const status = publicStatusCode(span.status?.code);
    const attrs = attributes(span);
    return !['UNSET', 'OK'].includes(status) || attrs.get('openclaw.outcome') === 'blocked';
  })) {
    throw new Error(`${chain ? 'a chain hop' : 'originating'} ${expected.tool} tool span is error, blocked, or has unknown status`);
  }
  const originTools = chain ? [chain.attribution] : tools;

  const traceId = idHex(accept.traceId, 16, 'trace id');
  const fireTraceIds = fires.map((span) => idHex(span.traceId, 16, 'fire trace id'));
  const toolTraceIds = tools.map((span) => idHex(span.traceId, 16, 'tool trace id'));
  if (fireTraceIds.some((value) => value !== traceId) || toolTraceIds.some((value) => value !== traceId)) {
    throw new Error('tool/fire/accept do not share one trace');
  }

  const acceptSpanId = idHex(accept.spanId, 8, 'accept span id');
  const fireSpanIds = fires.map((span) => idHex(span.spanId, 8, 'fire span id'));
  const acceptParentSpanId = idHex(accept.parentSpanId, 8, 'dispatch parent span id');
  const fireParentSpanIds = fires.map((span) => idHex(span.parentSpanId, 8, 'fire parent span id'));
  const toolParentSpanIds = originTools.map((span) => idHex(span.parentSpanId, 8, 'tool parent span id'));
  const toolSpanIds = originTools.map((span) => idHex(span.spanId, 8, 'tool span id'));
  const lifecycleSpanIds = [
    acceptSpanId,
    ...fireSpanIds,
    ...toolSpanIds,
    ...(chain?.chainHops || []).flatMap((hop) => [hop.toolSpanId, hop.workSpanId]),
  ];
  if (new Set(lifecycleSpanIds).size !== lifecycleSpanIds.length) {
    throw new Error('tool/fire/accept span IDs are not distinct');
  }

  const childSpans = spans
    .filter((span) =>
      span.parentSpanId && idHex(span.parentSpanId, 8, 'parent span id') === acceptSpanId)
    .map((span) => ({ name: publicSpanName(span.name), spanId: idHex(span.spanId, 8, 'child span id') }))
    .filter((span) => span.name !== null);

  const topology = {
    traceId,
    chainId,
    toolSpanIds,
    toolParentSpanIds,
    fireSpanId: fireSpanIds[0],
    fireParentSpanId: fireParentSpanIds[0],
    fireSpanIds,
    fireParentSpanIds,
    fireAttemptCount: fireSpanIds.length,
    childSpans,
    ...(chainRow
      ? {
          chainDepthTarget: expected.chainDepthTarget,
          chainDepth: 1 + (chain?.chainHops.length || 0),
          chainHops: chain?.chainHops || [],
          chainPathSpanIds: chain?.chainPathSpanIds || [],
        }
      : {}),
  };
  if (expected.tool === 'continue_delegate') {
    return {
      ...topology,
      dispatchSpanId: acceptSpanId,
      dispatchParentSpanId: acceptParentSpanId,
    };
  }
  return {
    ...topology,
    workSpanId: acceptSpanId,
    workParentSpanId: idHex(accept.parentSpanId, 8, 'work parent span id'),
  };
}

function validateToolTrace(trace, expected) {
  const spans = allSpans(trace);
  const tools = spans.filter((span) => {
    const attrs = attributes(span);
    return span.name === 'openclaw.tool.execution' &&
      (attrs.get('gen_ai.tool.name') === expected.tool ||
        attrs.get('openclaw.toolName') === expected.tool);
  });
  if (tools.length === 0) {
    throw new Error(`matched trace lacks the originating ${expected.tool} tool span`);
  }
  if (tools.length > 1) {
    throw new Error(`matched trace contains ${tools.length} ${expected.tool} tool spans`);
  }

  const tool = tools[0];
  const attrs = attributes(tool);
  return {
    traceId: idHex(tool.traceId, 16, 'trace id'),
    toolSpanId: idHex(tool.spanId, 8, 'tool span id'),
    toolParentSpanId: tool.parentSpanId
      ? idHex(tool.parentSpanId, 8, 'tool parent span id')
      : null,
    status: {
      code: publicStatusCode(tool.status?.code),
    },
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.runDir || !args.manifest || !args.seat) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 0 ||
      !Number.isFinite(args.pollMs) || args.pollMs < 1 ||
      !Number.isFinite(args.settleMs) || args.settleMs < 1) {
    throw new Error('timeout must be non-negative and poll/settle values must be positive numbers');
  }

  const runDir = path.resolve(args.runDir);
  const evidencePath = path.resolve(args.evidence || path.join(runDir, 'evidence.jsonl'));
  const evidence = await readEvidence(evidencePath);
  let manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
  let rCd2Context = null;
  if (isRcd2AuthorityRequired({ root: args.root, runDir, manifest, evidence })) {
    rCd2Context = establishRcd2AuthorityContext({
      root: args.root,
      runDir,
      selectedMatrixId: args.matrixId,
      manifest,
      evidence,
    });
    if (args.seat !== rCd2Context.selected.seat) {
      throw new Error('R-CD-2 authority identity mismatch for collector seat');
    }
    manifest = rCd2Context.manifest;
  }
  let rowNonceFingerprint = null;
  if (evidence.row === 'R-CD-2') {
    if (typeof evidence.nonce !== 'string' || evidence.nonce.length === 0) {
      throw new Error('R-CD-2 evidence nonce is required for row binding');
    }
    rowNonceFingerprint = createHash('sha256')
      .update(String(evidence.nonce))
      .digest('hex')
      .slice(0, 16);
    if (evidence.row_nonce_fingerprint != null &&
        evidence.row_nonce_fingerprint !== rowNonceFingerprint) {
      throw new Error(
        `evidence row_nonce_fingerprint mismatch: expected ${rowNonceFingerprint}`,
      );
    }
  }

  const contract = traceContract(manifest, evidence);
  const serviceName = proofsServiceName({ seat: args.seat, override: args.serviceName });
  const query = contract.kind === 'continuation'
    ? (() => {
        const modeClause = contract.mode === undefined
          ? ''
          : ` && .delegate.mode="${contract.mode}"`;
        return `{ resource.service.name="${serviceName}" && name="${contract.acceptSpanName}" && .reason.hash="${contract.hash}" && .reason.length=${contract.length}${modeClause} }`;
      })()
    : `{ resource.service.name="${serviceName}" && name="openclaw.tool.execution" && .gen_ai.tool.name="${contract.tool}" }`;
  const dispatchMs = Number(evidence.dispatch_accepted_at_ms || Date.parse(evidence.started));
  if (!Number.isFinite(dispatchMs)) throw new Error('evidence lacks a valid dispatch/start time');
  const dispatchSeconds = Math.floor(dispatchMs / 1000);
  const start = dispatchSeconds - CORRELATION_WINDOW_PADDING_SECONDS;
  const evidenceEndMs = Date.parse(evidence.ended);
  const evidenceEndSeconds = Number.isFinite(evidenceEndMs)
    ? Math.floor(evidenceEndMs / 1000)
    : dispatchSeconds;
  const end = Math.max(dispatchSeconds, evidenceEndSeconds) + CORRELATION_WINDOW_PADDING_SECONDS;
  const deadline = Date.now() + args.timeoutMs;
  let candidates = [];
  let traceId = '';
  let trace = null;
  let topology = null;
  let validationError = null;
  let searchQueryCount = 0;
  let stabilizationQueryCount = 0;
  let finalQueryCount = 0;

  const search = async () => {
    searchQueryCount += 1;
    return tempoSearch(args.tempoUrl, query, start, end);
  };

  do {
    candidates = await search();
    if (candidates.length > 1) {
      throw new Error(`trace correlation is ambiguous: ${candidates.length} Tempo traces matched`);
    }
    if (candidates.length === 1) {
      traceId = searchTraceId(candidates[0]);
      trace = await fetchTrace(args.tempoUrl, traceId);
      try {
        topology = contract.kind === 'continuation'
          ? validateTrace(trace, {
              tool: contract.tool,
              reasonHash: contract.hash,
              reasonLength: contract.length,
              mode: contract.mode,
              acceptSpanName: contract.acceptSpanName,
              fireSpanName: contract.fireSpanName,
              originSurface: contract.originSurface,
              chainDepthTarget: contract.chainDepthTarget,
            })
          : validateToolTrace(trace, { tool: contract.tool });
        if (topology.traceId !== traceId) throw new Error('Tempo search and trace payload IDs disagree');
        break;
      } catch (error) {
        validationError = error;
      }
    }
    if (Date.now() >= deadline) break;
    await sleep(args.pollMs);
  } while (true);

  if (candidates.length === 0 || !topology || !trace) {
    if (validationError) {
      throw new Error(`Tempo trace did not reach valid continuation topology before timeout: ${validationError.message}`);
    }
    const fingerprint = contract.kind === 'continuation'
      ? `reason hash ${contract.hash}`
      : `tool ${contract.tool} in the evidence window`;
    throw new Error(`no Tempo trace matched ${fingerprint} before timeout`);
  }

  const provisionalTraceId = traceId;
  const stabilizationDeadline = Date.now() + args.settleMs;
  while (Date.now() < stabilizationDeadline) {
    await sleep(Math.min(args.pollMs, stabilizationDeadline - Date.now()));
    candidates = await search();
    stabilizationQueryCount += 1;
    if (candidates.length !== 1) {
      throw new Error(
        candidates.length > 1
          ? `trace correlation is ambiguous: ${candidates.length} Tempo traces matched`
          : 'trace correlation candidate set changed during stabilization: no traces matched',
      );
    }
    const stableTraceId = searchTraceId(candidates[0]);
    if (stableTraceId !== provisionalTraceId) {
      throw new Error('trace correlation candidate set changed during stabilization');
    }
  }

  candidates = await search();
  finalQueryCount += 1;
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length > 1
        ? `trace correlation is ambiguous: ${candidates.length} Tempo traces matched`
        : 'final trace correlation query found no matching Tempo trace',
    );
  }
  traceId = searchTraceId(candidates[0]);
  if (traceId !== provisionalTraceId) {
    throw new Error('trace correlation candidate set changed before finality');
  }
  trace = await fetchTrace(args.tempoUrl, traceId);
  topology = contract.kind === 'continuation'
    ? validateTrace(trace, {
        tool: contract.tool,
        reasonHash: contract.hash,
        reasonLength: contract.length,
        mode: contract.mode,
        acceptSpanName: contract.acceptSpanName,
        fireSpanName: contract.fireSpanName,
        originSurface: contract.originSurface,
        chainDepthTarget: contract.chainDepthTarget,
      })
    : validateToolTrace(trace, { tool: contract.tool });
  if (topology.traceId !== traceId) {
    throw new Error('Tempo final search and trace payload IDs disagree');
  }

  assertTraceIsPublicSafe(trace, evidence, contract);
  const publicTrace = contract.kind === 'continuation'
    ? projectScopedContinuationTrace(trace, traceId, topology)
    : projectPublicTempoTrace(trace, traceId);

  const traceOut = path.join(runDir, `tempo-trace-${traceId.slice(0, 12)}.json`);
  const receiptOut = path.join(
    runDir,
    contract.kind === 'continuation'
      ? 'continuation-trace-correlation.json'
      : 'tool-trace-correlation.json',
  );
  const publicTraceBody = `${JSON.stringify(publicTrace, null, 2)}\n`;
  let receipt = {
    schema: contract.kind === 'continuation'
      ? 'openclaw.k6.continuation-trace-correlation.v1'
      : 'openclaw.k6.tool-trace-correlation.v1',
    row: evidence.row || manifest.rowId,
    seat: args.seat,
    attribution: contract.attribution,
    query,
    ...(evidence.row === 'R-CD-2'
      ? {
          collector: {
            schema: R_CD_2_COLLECTOR_SCHEMA,
            version: 1,
          },
          nonce: {
            sha256: createHash('sha256').update(evidence.nonce).digest('hex'),
            length: evidence.nonce.length,
          },
          querySha256: createHash('sha256').update(query).digest('hex'),
          finality: {
            candidateCount: candidates.length,
            snapshotFetched: true,
            stable: traceId === provisionalTraceId,
            traceId,
          },
          tempoSnapshot: {
            file: path.basename(traceOut),
            sha256: createHash('sha256').update(publicTraceBody).digest('hex'),
            traceId,
          },
          uniqueness: {
            acceptedTraceCount: candidates.length,
            resultClass: 'unique',
          },
        }
      : {}),
    searchWindow: {
      startUnixSeconds: start,
      endUnixSeconds: end,
      paddingSeconds: CORRELATION_WINDOW_PADDING_SECONDS,
      source: Number.isFinite(evidenceEndMs) ? 'dispatch-and-evidence-ended' : 'dispatch-only',
    },
    stabilization: {
      ingestionSettleMs: args.settleMs,
      pollIntervalMs: args.pollMs,
      searchQueryCount,
      stabilizationQueryCount,
      finalQueryCount,
    },
    traceJson: path.basename(traceOut),
    ...topology,
    ...(contract.kind === 'continuation'
      ? {
          reason: {
            hash: contract.hash,
            length: contract.length,
            source: contract.fingerprintSource,
            rawPersisted: false,
          },
          continuation: {
            tool: contract.tool,
            originSurface: contract.originSurface || 'typed-tool',
            acceptSpan: contract.acceptSpanName,
            fireSpan: contract.fireSpanName,
          },
          // R-CD-2's row resolver needs the same opaque row identity on both
          // the accepted sessions.send lifecycle and the Tempo topology. The
          // trace has already been selected by this evidence's nonce-derived
          // reason hash; retain only fingerprints, never raw run IDs/nonces.
          ...(evidence.row === 'R-CD-2'
            ? {
                authorityIdentity: rCd2Context.identity,
                // The resolver consumes the native continuation/delegate
                // shape emitted below plus topology.toolSpanIds.  Keep the
                // row binding public-safe and opaque, but never manufacture
                // a second top-level topology schema for a fixture to fake.
                rowBinding: {
                  acceptedSendRunFingerprint: evidence.send_run_fingerprint || null,
                  nonceFingerprint: rowNonceFingerprint,
                  acceptedSendTraceId: evidence.accepted_send_trace_id || traceId,
                  acceptedSendTraceSource: evidence.accepted_send_trace_id
                    ? 'sessions-send-response'
                    : 'unique-reason-bound-trace',
                },
              }
            : {}),
          ...(contract.mode === undefined ? {} : { delegate: { mode: contract.mode } }),
          sameTrace: true,
          sameChain: true,
          distinctSpans: true,
          resultClass: 'unique',
        }
      : {
          tool: {
            name: contract.tool,
            spanId: topology.toolSpanId,
            parentSpanId: topology.toolParentSpanId,
            status: topology.status,
          },
          uniqueTrace: true,
        }),
  };
  if (evidence.row === 'R-CD-2') {
    receipt = sealRcd2AcquisitionReceipt({
      receipt,
      signingKey: process.env.OPENCLAW_GATEWAY_TOKEN,
    });
  }
  await writeFile(traceOut, publicTraceBody);
  await writeFile(receiptOut, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({
    traceId,
    traceFile: path.basename(traceOut),
    receiptFile: path.basename(receiptOut),
    ...(contract.kind === 'continuation'
      ? {
          reasonHash: contract.hash,
          reasonLength: contract.length,
          chainId: topology.chainId,
        }
      : {
          tool: contract.tool,
          toolSpanId: topology.toolSpanId,
        }),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
